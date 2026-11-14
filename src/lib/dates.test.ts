import { describe, expect, it } from "vitest";

import {
  addCycle,
  addDays,
  daysBetween,
  isIsoDate,
  monthRange,
  shiftMonth,
  todayPK,
} from "./dates";

describe("dates", () => {
  it("uses the Pakistan calendar day", () => {
    // 20:30 UTC on the 14th is 01:30 on the 15th in Karachi (UTC+5).
    expect(todayPK(new Date("2026-11-14T20:30:00Z"))).toBe("2026-11-15");
    expect(todayPK(new Date("2026-11-14T18:59:00Z"))).toBe("2026-11-14");
  });

  it("shifts months across year ends", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", -5)).toBe("2026-06");
  });

  it("gives an exclusive month range", () => {
    expect(monthRange("2026-12")).toEqual({
      start: "2026-12-01",
      end: "2027-01-01",
    });
  });

  it("validates dates", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("14/11/2026")).toBe(false);
  });

  it("clamps to the end of short months", () => {
    expect(addCycle("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(addCycle("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(addCycle("2028-02-29", "yearly")).toBe("2029-02-28");
  });

  it("returns to the billing day after a short month", () => {
    expect(addCycle("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    expect(addCycle("2026-03-31", "monthly", 31)).toBe("2026-04-30");
  });

  it("rolls over the year", () => {
    expect(addCycle("2026-12-15", "monthly")).toBe("2027-01-15");
    expect(addCycle("2026-11-14", "yearly")).toBe("2027-11-14");
  });

  it("adds and counts days", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-11-14", "2026-12-14")).toBe(30);
    expect(daysBetween("2026-11-14", "2026-11-10")).toBe(-4);
  });
});
