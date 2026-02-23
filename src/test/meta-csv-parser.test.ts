import { describe, it, expect } from "vitest";

// Mirror the updated parser logic from Finance.tsx
const parseCells = (line: string, delimiter: string): string[] => {
  if (delimiter === "\t") return line.split("\t").map((c) => c.trim().replace(/^"|"$/g, ""));
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

const findHeader = (lines: string[]) => {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/^["'\s]+/, "");
    if (/^date\b/i.test(trimmed)) {
      const delimiter = lines[i].includes("\t") ? "\t" : ",";
      const cols = parseCells(lines[i], delimiter).map((c) => c.replace(/"/g, "").toLowerCase());
      const dateCol = cols.findIndex((c) => c === "date" || c.includes("date"));
      const amountCol = cols.findIndex((c) => c === "amount" || c.includes("spend") || c.includes("amount") || c.includes("cost"));
      if (dateCol >= 0 && amountCol >= 0) return { headerIdx: i, dateCol, amountCol, delimiter };
    }
  }
  return null;
};

const skipPhrases = ["total", "gst", "tds", "vat", "funds added"];

describe("Meta CSV Parser", () => {
  it("rejects CSV without a row starting with Date", () => {
    const lines = ["Name,Email,Phone", "John,john@test.com,123"];
    expect(findHeader(lines)).toBeNull();
  });

  it("skips preamble and finds header starting with Date", () => {
    const lines = [
      "Meta Ads Report",
      "Account: Test",
      "Date\tTransaction ID\tAmount",
      "31-01-2026\tTXN1\t848.96",
    ];
    const result = findHeader(lines);
    expect(result).not.toBeNull();
    expect(result!.headerIdx).toBe(2);
    expect(result!.delimiter).toBe("\t");
  });

  it("aggressively cleans currency formats", () => {
    expect(cleanAmount('"₹1,200.00"')).toBe(1200);
    expect(cleanAmount("(1,200.00)")).toBe(1200);
    expect(cleanAmount("₹ 500")).toBe(500);
  });

  it("skips Total/GST/TDS rows", () => {
    const lines = [
      "\tTotal amount billed\t26629.55\tINR",
      "GST Amount in INR: 4062.14",
      "TDS Rate: 2%",
    ];
    for (const line of lines) {
      expect(skipPhrases.some((p) => line.toLowerCase().includes(p))).toBe(true);
    }
  });

  it("parses tab-delimited Meta billing export", () => {
    const lines = [
      "Meta information\t\t",
      "Date\tTransaction ID\tAmount",
      '31-01-2026\tTXN1\t848.96',
      '30-01-2026\tTXN2\t"1,200.00"',
      '\tTotal amount billed\t"26,629.55"',
    ];
    const header = findHeader(lines);
    expect(header).not.toBeNull();
    const dataLines = lines.slice(header!.headerIdx + 1);
    const rows = dataLines
      .filter((l) => !skipPhrases.some((p) => l.toLowerCase().includes(p)))
      .map((l) => {
        const cells = parseCells(l, header!.delimiter);
        const rawDate = (cells[header!.dateCol] || "").replace(/"/g, "").trim();
        const amount = cleanAmount(cells[header!.amountCol] || "");
        if (!/^\d{1,2}-\d{1,2}-\d{4}$/.test(rawDate)) return null;
        if (amount <= 0) return null;
        return { rawDate, amount };
      })
      .filter(Boolean);
    expect(rows).toHaveLength(2);
    expect(rows[1]!.amount).toBeCloseTo(1200);
  });
});
