import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STEPS = ["triage", "consult", "quoted", "workshop", "qc", "delivered"];
const LABELS: Record<string, string> = {
  triage: "Triage",
  consult: "Consult",
  quoted: "Quoted",
  workshop: "Workshop",
  qc: "QC",
  delivered: "Delivered",
};

interface OrderStepperProps {
  currentStatus: string;
  onAdvance: (nextStatus: string) => void;
  isPending: boolean;
}

const OrderStepper = ({ currentStatus, onAdvance, isPending }: OrderStepperProps) => {
  const currentIdx = STEPS.indexOf(currentStatus);
  const nextStatus = currentIdx < STEPS.length - 1 ? STEPS[currentIdx + 1] : null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Order Progress</h2>
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const done = i <= currentIdx;
          return (
            <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
              <div className={`h-2 w-full rounded-full transition-colors ${done ? "bg-primary" : "bg-border"}`} />
              <span className={`text-[10px] font-medium ${done ? "text-primary" : "text-muted-foreground"}`}>
                {LABELS[s]}
              </span>
            </div>
          );
        })}
      </div>
      {nextStatus && (
        <Button
          onClick={() => onAdvance(nextStatus)}
          disabled={isPending}
          className="w-full rounded-[var(--radius)] gap-2"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Move to {LABELS[nextStatus]}
        </Button>
      )}
    </section>
  );
};

export default OrderStepper;
