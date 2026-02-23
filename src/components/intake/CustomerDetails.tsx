import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CustomerData = {
  name: string;
  phone: string;
  email: string;
  notes: string;
};

type Props = {
  data: CustomerData;
  onChange: (data: CustomerData) => void;
  errors: Partial<Record<keyof CustomerData, string>>;
};

const CustomerDetails = ({ data, onChange, errors }: Props) => {
  const set = (key: keyof CustomerData, value: string) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Customer Details</h2>
        <p className="text-sm text-muted-foreground">New or returning customer info</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            placeholder="e.g. Priya Mehta"
            value={data.name}
            onChange={(e) => set("name", e.target.value)}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            placeholder="10-digit mobile number"
            value={data.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email (optional)</Label>
          <Input
            id="email"
            type="email"
            placeholder="customer@email.com"
            value={data.email}
            onChange={(e) => set("email", e.target.value)}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any special instructions or details…"
            value={data.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="min-h-[60px]"
          />
        </div>
      </div>
    </div>
  );
};

export default CustomerDetails;
export type { CustomerData };
