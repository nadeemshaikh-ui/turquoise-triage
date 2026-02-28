import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface InvoiceSectionProps {
  orderId: string;
}

const InvoiceSection = ({ orderId }: InvoiceSectionProps) => {
  const { data: invoice } = useQuery({
    queryKey: ["invoice", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, public_url, issued_at")
        .eq("order_id", orderId)
        .maybeSingle();
      return data;
    },
    enabled: !!orderId,
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ["invoice-lines", invoice?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_line_items")
        .select("id, label, qty, unit_price, amount, order_item_id")
        .eq("invoice_id", invoice!.id)
        .order("label");
      return data || [];
    },
    enabled: !!invoice?.id,
  });

  if (!invoice) return null;

  const total = lineItems.reduce((sum, li: any) => sum + Number(li.amount), 0);

  return (
    <section className="rounded-[var(--radius)] border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Invoice</h3>
        {invoice.issued_at && (
          <Badge variant="outline" className="text-[10px]">Issued</Badge>
        )}
      </div>

      {lineItems.length > 0 ? (
        <div className="space-y-1">
          {lineItems.map((li: any) => (
            <div key={li.id} className="flex items-center justify-between text-xs">
              <span className="text-foreground">{li.label} {li.qty > 1 && `×${li.qty}`}</span>
              <span className="text-muted-foreground">₹{Number(li.amount).toLocaleString()}</span>
            </div>
          ))}
          <div className="border-t border-border pt-1 flex items-center justify-between text-sm font-semibold">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">₹{total.toLocaleString()}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No line items yet.</p>
      )}
    </section>
  );
};

export default InvoiceSection;
