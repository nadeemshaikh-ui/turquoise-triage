import { describe, it, expect } from "vitest";

// Extracted parsing logic from Finance.tsx for testing
function parseMetaCsv(text: string) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV is empty");

  const cols = lines[0].toLowerCase().split(",").map((c) => c.trim().replace(/"/g, ""));
  const dateIdx = cols.findIndex((c) => c.includes("date") || c.includes("day"));
  const spendIdx = cols.findIndex((c) => c.includes("spend") || c.includes("amount") || c.includes("cost"));
  if (dateIdx < 0 || spendIdx < 0) throw new Error("CSV must have 'date' and 'spend/amount/cost' columns");

  const summaryPhrases = ["total amount billed", "total funds added", "gst amount", "tds amount"];

  const parsedRows = lines.slice(1).map((line) => {
    if (summaryPhrases.some((phrase) => line.toLowerCase().includes(phrase))) return null;

    const firstComma = line.indexOf(",");
    if (firstComma < 0) return null;
    const rawDate = line.substring(0, firstComma).trim().replace(/"/g, "");

    const isDdMmYyyy = /^\d{1,2}-\d{1,2}-\d{4}$/.test(rawDate);
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
    if (!isDdMmYyyy && !isIsoDate) return null;

    const rawSpend = line.substring(firstComma + 1).replace(/[₹",\s]/g, "").trim();
    const amount = parseFloat(rawSpend) || 0;

    let normalizedDate = rawDate;
    if (isDdMmYyyy) {
      const m = rawDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (m) normalizedDate = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }

    return { date: normalizedDate, amount_spent: amount };
  }).filter((r): r is { date: string; amount_spent: number } => r !== null && !!r.date && !isNaN(new Date(r.date).getTime()) && r.amount_spent > 0);

  const byDate = new Map<string, number>();
  parsedRows.forEach((r) => {
    byDate.set(r.date, (byDate.get(r.date) || 0) + r.amount_spent);
  });

  return Array.from(byDate.entries()).map(([date, amount_spent]) => ({ date, amount_spent }));
}

describe("Meta CSV Parser", () => {
  it("parses DD-MM-YYYY dates with ₹-formatted spend", () => {
    const csv = `date,spend
01-02-2026,"₹1,500.50"
02-02-2026,"₹2,300.00"
02-02-2026,"₹700.25"
03-02-2026,₹950
05-02-2026,"₹3,100.75"`;

    const result = parseMetaCsv(csv);

    // Should have 4 unique dates (02-02 rows summed)
    expect(result).toHaveLength(4);

    // Check date conversion DD-MM-YYYY → YYYY-MM-DD
    expect(result[0].date).toBe("2026-02-01");
    expect(result[1].date).toBe("2026-02-02");
    expect(result[2].date).toBe("2026-02-03");
    expect(result[3].date).toBe("2026-02-05");

    // Check amounts: ₹1,500.50 → 1500.50
    expect(result[0].amount_spent).toBeCloseTo(1500.50);
    // ₹2,300 + ₹700.25 = 3000.25
    expect(result[1].amount_spent).toBeCloseTo(3000.25);
    expect(result[2].amount_spent).toBeCloseTo(950);
    expect(result[3].amount_spent).toBeCloseTo(3100.75);
  });

  it("handles YYYY-MM-DD dates without conversion", () => {
    const csv = `date,amount
2026-01-15,1234.56
2026-01-16,789.00`;

    const result = parseMetaCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2026-01-15");
    expect(result[0].amount_spent).toBeCloseTo(1234.56);
  });

  it("filters out Meta summary rows (Total amount billed, GST, TDS, etc.)", () => {
    const csv = `date,amount
01-01-2026,"₹500.00"
02-01-2026,"₹600.00"
Total amount billed,"₹26,629.55"
Total funds added,"₹26,629.55"
GST Amount,"₹4,073.40"
TDS Amount,"₹500.00"`;

    const result = parseMetaCsv(csv);
    // Only 2 valid transaction rows
    expect(result).toHaveLength(2);
    const total = result.reduce((s, r) => s + r.amount_spent, 0);
    expect(total).toBeCloseTo(1100);
  });
});
