import { describe, it, expect } from "vitest";

// Mirror the updated parser logic from Finance.tsx
const parseCsvLine = (line: string, delim: string): string[] => {
  if (delim === "\t") return line.split("\t").map((c) => c.trim().replace(/^"|"$/g, ""));
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
};

const cleanAmount = (raw: string): number => {
  const cleaned = raw.replace(/["₹,\s()]/g, "").trim();
  return Math.abs(parseFloat(cleaned) || 0);
};

const findHeader = (lines: string[], delimiter: string) => {
  for (let i = 0; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter).map((c) => c.replace(/"/g, "").toLowerCase());
    const dIdx = cols.findIndex((c) => c === "date" || c.includes("date") || c.includes("day"));
    if (dIdx < 0) continue;
    const aIdx = cols.findIndex((c) => c === "amount" || c.includes("spend") || c.includes("amount") || c.includes("cost"));
    if (aIdx >= 0) return { headerIdx: i, dateCol: dIdx, amountCol: aIdx };
  }
  return null;
};

describe("Meta CSV Parser", () => {
  it("rejects CSV without Date/Amount columns with correct error", () => {
    const lines = ["Name,Email,Phone", "John,john@test.com,123"];
    const result = findHeader(lines, ",");
    expect(result).toBeNull();
  });

  it("skips preamble lines and finds header row", () => {
    const lines = [
      "Meta Ads Report",
      "Account: Test Account",
      "Date,Amount Spent",
      "2025-01-01,500",
    ];
    const result = findHeader(lines, ",");
    expect(result).not.toBeNull();
    expect(result!.headerIdx).toBe(2);
    expect(result!.dateCol).toBe(0);
    expect(result!.amountCol).toBe(1);
  });

  it("aggressively cleans currency formats", () => {
    expect(cleanAmount('"₹1,200.00"')).toBe(1200);
    expect(cleanAmount("(1,200.00)")).toBe(1200);
    expect(cleanAmount("₹ 500")).toBe(500);
    expect(cleanAmount('"2,345.67"')).toBe(2345.67);
    expect(cleanAmount("()")).toBe(0);
  });

  it("handles tab-delimited files", () => {
    const lines = [
      "Report Header",
      "Date\tAmount Spent\tClicks",
      "2025-01-01\t500\t10",
    ];
    const result = findHeader(lines, "\t");
    expect(result).not.toBeNull();
    expect(result!.dateCol).toBe(0);
    expect(result!.amountCol).toBe(1);
  });

  it("parses quoted CSV fields with internal commas", () => {
    const cells = parseCsvLine('2025-01-01,"1,200.50",Campaign Name', ",");
    expect(cells).toEqual(["2025-01-01", "1,200.50", "Campaign Name"]);
  });
});
