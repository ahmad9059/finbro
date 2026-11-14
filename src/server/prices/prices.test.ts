import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseFundList, parseLastNav } from "./funds";
import { parseCompanyPage, parseTimeseries } from "./psx";

const fixture = readFileSync(
  fileURLToPath(new URL("./__fixtures__/psx-company.html", import.meta.url)),
  "utf8",
);

describe("PSX parsing", () => {
  it("reads price, name, sector and date from a company page", () => {
    expect(parseCompanyPage(fixture)).toEqual({
      ok: true,
      price: 315.87,
      asOf: "2026-11-13",
      name: "Oil & Gas Development Company Limited",
      category: "OIL & GAS EXPLORATION COMPANIES",
    });
  });

  it("fails clearly when the layout changes", () => {
    const result = parseCompanyPage("<html><body>nothing here</body></html>");
    expect(result.ok).toBe(false);
  });

  it("reads the newest row of the intraday series", () => {
    const result = parseTimeseries({
      status: 1,
      data: [[1794588540, 315.87, 100], [1794588480, 315.5, 50]],
    });
    expect(result).toMatchObject({ ok: true, price: 315.87 });
  });

  it("rejects empty or malformed series", () => {
    expect(parseTimeseries({ status: 1, data: [] }).ok).toBe(false);
    expect(parseTimeseries(null).ok).toBe(false);
    expect(parseTimeseries({ data: [["x", "y"]] }).ok).toBe(false);
  });
});

describe("fund parsing", () => {
  it("takes the last NAV line, ignoring a trailing blank line", () => {
    const text =
      '{"date":"2026-11-12","nav":10.6706,"offerPrice":10.76}\n' +
      '{"date":"2026-11-13","nav":10.6742,"offerPrice":10.77}\n\n';
    expect(parseLastNav(text)).toEqual({
      ok: true,
      price: 10.6742,
      asOf: "2026-11-13",
    });
  });

  it("skips a half-written last line", () => {
    const text = '{"date":"2026-11-12","nav":10.6706}\n{"date":"2026-11-1';
    expect(parseLastNav(text)).toMatchObject({ ok: true, price: 10.6706 });
  });

  it("fails on an empty file", () => {
    expect(parseLastNav("").ok).toBe(false);
  });

  it("keeps only well-formed funds from the list", () => {
    const funds = parseFundList({
      funds: [
        { fundId: "1", name: "A Fund", amc: "AMC", category: "Income", nav: 10.5 },
        { fundId: "2", name: "Broken" },
        null,
      ],
    });
    expect(funds).toHaveLength(1);
    expect(funds[0]).toMatchObject({ fundId: "1", shariah: false });
  });
});
