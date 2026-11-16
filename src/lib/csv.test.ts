import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv(["a", "b"], [['x,"y"', "line\nbreak"]])).toBe(
      'a,b\r\n"x,""y""","line\nbreak"',
    );
  });

  it("neutralises formula-looking text but keeps numbers intact", () => {
    expect(toCsv(["t", "n"], [["=SUM(A1)", -5]])).toBe("t,n\r\n'=SUM(A1),-5");
  });

  it("writes empty cells for null and undefined", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,");
  });
});
