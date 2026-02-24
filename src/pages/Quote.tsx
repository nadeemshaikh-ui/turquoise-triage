import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Crown, Check, Truck, Shield, Clock, Star, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type QuoteItem = {
  categoryName: string;
  description: string;
  manualPrice: number;
  mode: string;
};

type QuoteData = {
  quote: any;
  lead: any;
  photos: { url: string }[];
  items: QuoteItem[];
};

const Quote = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchQuote();
  }, [token]);

  const fetchQuote = async () => {
    try {
      const res = await supabase.functions.invoke("serve-quote", { body: { token } });
      if (res.error) throw res.error;
      setData(res.data);
      if (res.data?.quote?.accepted_tier) setAccepted(res.data.quote.accepted_tier);
      if (res.data?.quote?.id && !res.data?.quote?.viewed_at) {
        await supabase.functions.invoke("serve-quote", { body: { token, action: "view" } });
      }
    } catch {
      toast({ title: "Quote not found", description: "This quote link may be invalid or expired.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (tier: "Premium" | "Elite") => {
    if (!data?.quote?.id) return;
    setAccepting(true);
    try {
      await supabase.functions.invoke("serve-quote", { body: { token, action: "accept", tier } });
      setAccepted(tier);
      toast({ title: `${tier} selected!`, description: "We'll be in touch shortly." });
    } catch {
      toast({ title: "Error", description: "Could not process selection.", variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center"><h1 className="text-2xl font-bold text-foreground">Quote Not Found</h1><p className="text-muted-foreground mt-2">This quote link may be invalid.</p></div>;

  const { quote, lead, photos, items } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-xl font-bold text-foreground">Restoree 360</h1>
        <p className="text-sm text-muted-foreground">Your Personalized Restoration Quote</p>
      </div>

      <div className="mx-auto max-w-2xl p-4 space-y-6">
        {photos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Before Photos</p>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((p, i) => (
                <img key={i} src={p.url} alt={`Before ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border border-border" />
              ))}
            </div>
          </div>
        )}

        {/* Items breakdown */}
        {items && items.length > 0 && (
          <Card className="p-4 border-border space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</p>
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1">
                    <Package className="h-3 w-3 text-primary" /> {item.categoryName}
                  </p>
                  {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                </div>
                <span className="text-sm font-semibold text-foreground">₹{item.manualPrice?.toLocaleString()}</span>
              </div>
            ))}
          </Card>
        )}

        {accepted && (
          <Card className="p-4 border-primary bg-primary/5 text-center">
            <Check className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-lg font-bold text-foreground">You selected {accepted}</p>
            <p className="text-sm text-muted-foreground">Our team will reach out shortly to proceed.</p>
          </Card>
        )}

        {!accepted && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="p-5 border-primary bg-primary/5 space-y-3 relative">
              <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground text-[10px]">RECOMMENDED</Badge>
              <div className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /><h3 className="text-lg font-bold text-foreground">Elite Artisan</h3></div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> 8–12 Day Express</li>
                <li className="flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Master Artisan Check</li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Premium Materials</li>
                <li className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> FREE Pan-India Shipping</li>
              </ul>
              <p className="text-2xl font-bold text-primary">₹{quote.elite_price?.toLocaleString()}</p>
              <Button className="w-full min-h-[48px] text-base" onClick={() => handleAccept("Elite")} disabled={accepting}>
                {accepting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />} Choose Elite
              </Button>
            </Card>

            <Card className="p-5 border-border space-y-3">
              <div className="flex items-center gap-2"><Crown className="h-5 w-5 text-muted-foreground" /><h3 className="text-lg font-bold text-foreground">Premium</h3></div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2"><Clock className="h-4 w-4" /> 15–20 Day Standard</li>
                <li className="flex items-center gap-2"><Star className="h-4 w-4" /> Professional Grade</li>
                <li className="flex items-center gap-2"><Shield className="h-4 w-4" /> Standard Materials</li>
                <li className="flex items-center gap-2"><Truck className="h-4 w-4" /> +₹200 Shipping</li>
              </ul>
              <p className="text-2xl font-bold text-foreground">₹{quote.premium_price?.toLocaleString()}</p>
              <Button variant="outline" className="w-full min-h-[48px] text-base" onClick={() => handleAccept("Premium")} disabled={accepting}>
                {accepting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crown className="mr-2 h-4 w-4" />} Choose Premium
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Quote;
