import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PhoneLookupResult =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "no_match" }
  | { status: "match"; customerId: string; dbName: string; leadCount: number }
  | { status: "conflict"; dbName: string; customerId: string; leadCount: number };

const normalize10 = (raw: string): string | null => {
  const digits = raw.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  return last10.length === 10 ? last10 : null;
};

export const usePhoneLookup = () => {
  const [result, setResult] = useState<PhoneLookupResult>({ status: "idle" });
  const [normalized, setNormalized] = useState<string | null>(null);

  const lookup = useCallback(async (phone: string, enteredName: string) => {
    const norm = normalize10(phone);
    setNormalized(norm);

    if (!norm) {
      setResult({ status: "idle" });
      return;
    }

    setResult({ status: "checking" });

    const { data: customers } = await supabase
      .from("customers")
      .select("id, name")
      .eq("phone", norm)
      .limit(1);

    if (!customers || customers.length === 0) {
      setResult({ status: "no_match" });
      return;
    }

    const existing = customers[0];

    // Count leads for this customer
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", existing.id);

    const leadCount = count ?? 0;
    const namesMatch =
      existing.name.trim().toLowerCase() === enteredName.trim().toLowerCase();

    if (namesMatch || !enteredName.trim()) {
      setResult({
        status: "match",
        customerId: existing.id,
        dbName: existing.name,
        leadCount,
      });
    } else {
      setResult({
        status: "conflict",
        dbName: existing.name,
        customerId: existing.id,
        leadCount,
      });
    }
  }, []);

  const reset = useCallback(() => {
    setResult({ status: "idle" });
    setNormalized(null);
  }, []);

  return { result, normalized, lookup, reset };
};
