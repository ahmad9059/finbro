import { describe, expect, it } from "vitest";

import { KNOWLEDGE } from "./entries";
import { renderNotes, retrieveKnowledge, tokenize } from "./retrieve";

const top = (query: string) => retrieveKnowledge(query)[0]?.entry.id;
const ids = (query: string) =>
  retrieveKnowledge(query).map((row) => row.entry.id);

describe("knowledge base", () => {
  it("has unique ids and no empty entries", () => {
    const seen = new Set<string>();
    for (const entry of KNOWLEDGE) {
      expect(seen.has(entry.id), `duplicate id ${entry.id}`).toBe(false);
      seen.add(entry.id);
      expect(entry.title.length).toBeGreaterThan(5);
      expect(entry.body.length).toBeGreaterThan(80);
      expect(entry.keywords.length).toBeGreaterThan(2);
    }
  });

  it("keeps entries short enough to read several at once", () => {
    for (const entry of KNOWLEDGE) {
      expect(entry.body.split(/\s+/).length, entry.id).toBeLessThan(150);
    }
  });

  it("does not hard-code rates that change with each budget or policy meeting", () => {
    for (const entry of KNOWLEDGE) {
      // A percentage in the body is only acceptable for stable rules of thumb.
      const rates = entry.body.match(/\d+(\.\d+)?%/g) ?? [];
      const allowed = ["2.5%", "15%", "25%", "40%", "5%", "10%", "30%", "1%"];
      for (const rate of rates) {
        expect(allowed, `${entry.id}: ${rate}`).toContain(rate);
      }
    }
  });

  it("points volatile topics at a search hint", () => {
    for (const id of [
      "dividends-tax",
      "capital-gains-tax",
      "policy-rate-cycle",
      "govt-securities-nss",
    ]) {
      const entry = KNOWLEDGE.find((row) => row.id === id);
      expect(entry?.verify, id).toBeTruthy();
    }
  });
});

describe("retrieval", () => {
  it("finds tax notes from shorthand", () => {
    expect(ids("what is the CGT if I sell my shares")).toContain(
      "capital-gains-tax",
    );
    expect(ids("dividend withholding tax for non filers")).toContain(
      "dividends-tax",
    );
    expect(top("WHT on dividend")).toBe("dividends-tax");
  });

  it("finds money market guidance", () => {
    expect(
      ids("should I keep idle cash in savings or a money market fund"),
    ).toContain("money-market-vs-bank");
  });

  it("finds concentration advice", () => {
    expect(
      ids("am I too concentrated in one sector, should I diversify"),
    ).toContain("concentration-risk");
  });

  it("finds zakat", () => {
    expect(top("how do I calculate zakat on my shares")).toBe("zakat");
  });

  it("finds policy rate context", () => {
    expect(
      ids("SBP cut the policy rate, what happens to my income fund"),
    ).toContain("policy-rate-cycle");
  });

  it("finds emergency fund guidance", () => {
    expect(ids("how many months of emergency fund should I hold")).toContain(
      "emergency-fund",
    );
  });

  it("understands Roman Urdu", () => {
    expect(ids("mujhe apni bachat aur munafa ke bare mein batao")).toContain(
      "roman-urdu",
    );
    expect(ids("qarz utarun ya invest karun")).toContain("debt-first");
  });

  it("finds finbro's own method", () => {
    expect(
      ids("how is my unrealized gain and average cost calculated"),
    ).toContain("reading-finbro");
  });

  it("returns nothing for chit-chat and plain account commands", () => {
    expect(retrieveKnowledge("hello there")).toEqual([]);
    expect(retrieveKnowledge("")).toEqual([]);
    for (const command of [
      "add 2,500 for groceries",
      "add an expense of 500 for petrol",
      "mark Netflix subscription as paid",
      "delete that last expense",
      "I bought 100 MARI at 612.4 today",
      "what is my net worth",
    ]) {
      expect(retrieveKnowledge(command), command).toEqual([]);
    }
  });

  it("explains how net worth is calculated when asked, not when merely read", () => {
    expect(ids("how is my net worth calculated")).toContain("reading-finbro");
  });

  it("still finds budgeting advice when asked for it", () => {
    expect(ids("how can I cut my monthly spending and save more")).toContain(
      "budgeting-expenses",
    );
  });

  it("respects the limit and orders by score", () => {
    const rows = retrieveKnowledge(
      "tax on dividends and capital gains for filers",
      { limit: 2 },
    );
    expect(rows.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.score).toBeGreaterThanOrEqual(rows[i]!.score);
    }
  });
});

describe("rendering", () => {
  it("adds the verify hint for volatile notes only", () => {
    const [tax] = retrieveKnowledge("capital gains tax");
    const [concentration] = retrieveKnowledge(
      "single stock concentration risk",
    );
    expect(renderNotes([tax!]).join("\n")).toContain("confirm with web search");
    expect(renderNotes([concentration!]).join("\n")).not.toContain(
      "confirm with web search",
    );
  });

  it("tokenizes without stopwords", () => {
    expect(tokenize("What is the CGT?")).toEqual(["cgt"]);
  });
});
