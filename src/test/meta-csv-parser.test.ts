import { describe, it, expect } from "vitest";

// Extracted parsing logic from Finance.tsx for testing
function parseMetaCsv(text: string) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV is empty");

  const delimiter = lines.some((l) => l.includes("\t")) ? "\t" : ",";

  let headerIdx = -1;
  let dateCol = -1;
  let amountCol = -1;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/"/g, "").toLowerCase());
    const dIdx = cols.findIndex((c) => c === "date" || c.includes("date") || c.includes("day"));
    const aIdx = cols.findIndex((c) => c === "amount" || c.includes("spend") || c.includes("amount") || c.includes("cost"));
    if (dIdx >= 0 && aIdx >= 0) {
      headerIdx = i;
      dateCol = dIdx;
      amountCol = aIdx;
      break;
    }
  }
  if (headerIdx < 0) throw new Error("CSV must have 'date' and 'amount/spend/cost' columns");

  const summaryPhrases = ["total amount billed", "total funds added", "gst amount", "tds amount", "vat rate", "tds rate"];

  const parsedRows = lines.slice(headerIdx + 1).map((line) => {
    if (summaryPhrases.some((phrase) => line.toLowerCase().includes(phrase))) return null;

    const cells = delimiter === "\t"
      ? line.split("\t").map((c) => c.trim().replace(/"/g, ""))
      : (() => {
          const firstComma = line.indexOf(",");
          if (firstComma < 0) return [line.trim()];
          return [line.substring(0, firstComma).trim().replace(/"/g, ""), line.substring(firstComma + 1).replace(/"/g, "").trim()];
        })();

    const rawDate = cells[dateCol]?.trim() || "";
    const rawAmount = (cells[amountCol] || "").replace(/[₹,\s]/g, "").trim();

    const isDdMmYyyy = /^\d{1,2}-\d{1,2}-\d{4}$/.test(rawDate);
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
    if (!isDdMmYyyy && !isIsoDate) return null;

    const amount = parseFloat(rawAmount) || 0;
    if (amount <= 0) return null;

    let normalizedDate = rawDate;
    if (isDdMmYyyy) {
      const m = rawDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (m) normalizedDate = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }

    return { date: normalizedDate, amount_spent: amount };
  }).filter((r): r is { date: string; amount_spent: number } => r !== null && !!r.date && !isNaN(new Date(r.date).getTime()));

  const byDate = new Map<string, number>();
  parsedRows.forEach((r) => {
    byDate.set(r.date, (byDate.get(r.date) || 0) + r.amount_spent);
  });

  return Array.from(byDate.entries()).map(([date, amount_spent]) => ({ date, amount_spent }));
}

describe("Meta CSV Parser", () => {
  it("parses comma-separated DD-MM-YYYY dates with ₹-formatted spend", () => {
    const csv = `date,spend
01-02-2026,"₹1,500.50"
02-02-2026,"₹2,300.00"
02-02-2026,"₹700.25"
03-02-2026,₹950
05-02-2026,"₹3,100.75"`;

    const result = parseMetaCsv(csv);
    expect(result).toHaveLength(4);
    expect(result[0].date).toBe("2026-02-01");
    expect(result[1].date).toBe("2026-02-02");
    expect(result[1].amount_spent).toBeCloseTo(3000.25);
  });

  it("parses real Meta billing CSV (tab-delimited, with metadata headers)", () => {
    const csv = [
      "Meta information\t\t\t\t\t",
      "Facebook India\tAddress\tCity\tIndia\tGSTIN\tPAN",
      "\t\t\t\t\t",
      "Advertiser Information\t\t\t\t\t",
      "Account: 123\tGSTIN: ABC\t\t\t\t",
      "\t\t\t\t\t",
      "Billing report: 01/01/2026 - 01/02/2026\t\t\t\t\t",
      "\t\t\t\t\t",
      "Meta ads payment\t\t\t\t\t",
      "Payment Method: N/A\t\t\t\t\t",
      "Date\tTransaction ID\tAmount\tCurrency\t\t",
      '31-01-2026\tTXN1\t848.96\tINR\t\t',
      '30-01-2026\tTXN2\t"1,200.00"\tINR\t\t',
      '30-01-2026\tTXN3\t200\tINR\t\t',
      '\tTotal amount billed\t"26,629.55"\tINR\t\t',
      '\tTotal funds added\t"27,300.00"\tINR\t\t',
      "\t\t\t\t\t",
      "VAT Rate: 18%\t\t\t\t\t",
      '"GST Amount in INR: 4,062.14"\t\t\t\t\t',
      "TDS Rate: 2%\t\t\t\t\t",
      "TDS Amount in INR: 532.59\t\t\t\t\t",
    ].join("\n");

    const result = parseMetaCsv(csv);
    // Only 3 transaction rows (2 on Jan 30 summed)
    expect(result).toHaveLength(2); // Jan 31 + Jan 30 (summed)
    
    const jan31 = result.find((r) => r.date === "2026-01-31");
    expect(jan31).toBeDefined();
    expect(jan31!.amount_spent).toBeCloseTo(848.96);

    const jan30 = result.find((r) => r.date === "2026-01-30");
    expect(jan30).toBeDefined();
    expect(jan30!.amount_spent).toBeCloseTo(1400); // 1200 + 200
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
});
