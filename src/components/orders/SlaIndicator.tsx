import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

interface SlaIndicatorProps {
  orderStatus: string;
  consultationStartTime: string | null;
}

const SlaIndicator = ({ orderStatus, consultationStartTime }: SlaIndicatorProps) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (orderStatus !== "consult") return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [orderStatus]);

  // Patch 3: Only show timer during consult
  if (orderStatus === "triage") return null;

  const consultIdx = ["triage", "consult", "quoted", "workshop", "qc", "delivered"].indexOf(orderStatus);
  if (consultIdx > 1) {
    return (
      <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
        SLA Completed
      </Badge>
    );
  }

  if (!consultationStartTime) return null;

  const hours = (now - new Date(consultationStartTime).getTime()) / 3_600_000;

  if (hours > 6) {
    return (
      <Badge className="text-[10px] bg-destructive/15 text-destructive border-destructive/30 animate-pulse">
        OVERDUE ({Math.floor(hours)}h)
      </Badge>
    );
  }
  if (hours > 4) {
    return (
      <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 animate-pulse">
        WARNING ({Math.floor(hours)}h)
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] bg-green-100 text-green-800 border-green-300">
      OK ({Math.floor(hours)}h)
    </Badge>
  );
};

export default SlaIndicator;
