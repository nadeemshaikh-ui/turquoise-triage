import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Fingerprint } from "lucide-react";

interface AssetPassportCardProps {
  asset: {
    id: string;
    itemCategory: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
  } | null | undefined;
}

const AssetPassportCard = ({ asset }: AssetPassportCardProps) => {
  const { data: historyCount } = useQuery({
    queryKey: ["asset-history", asset?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("asset_id", asset!.id);
      return count || 0;
    },
    enabled: !!asset?.id,
  });

  if (!asset) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-border bg-muted/30 p-4 text-center">
        <p className="text-sm text-muted-foreground">No asset passport linked.</p>
      </div>
    );
  }

  return (
    <div className="neu-raised-sm p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Fingerprint className="h-4 w-4 icon-recessed" />
        <h3 className="text-sm font-semibold text-foreground">Asset Passport</h3>
        {historyCount !== undefined && historyCount > 1 && (
          <Badge variant="secondary" className="text-[10px]">
            {historyCount} restorations
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Category</span>
          <p className="font-medium text-foreground">{asset.itemCategory}</p>
        </div>
        {asset.brand && (
          <div>
            <span className="text-muted-foreground">Brand</span>
            <p className="font-medium text-foreground">{asset.brand}</p>
          </div>
        )}
        {asset.model && (
          <div>
            <span className="text-muted-foreground">Model</span>
            <p className="font-medium text-foreground">{asset.model}</p>
          </div>
        )}
        {asset.serialNumber && (
          <div>
            <span className="text-muted-foreground">Serial</span>
            <p className="font-medium text-foreground">{asset.serialNumber}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetPassportCard;
