import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  const [showMore, setShowMore] = useState(false);
  const set = (key: keyof CustomerData, value: string) =>
    onChange({ ...data, [key]: value });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="name" className="text-[11px]">Name *</Label>
          <Input
            id="name"
            placeholder="Priya Mehta"
            value={data.name}
            onChange={(e) => set("name", e.target.value)}
            className="h-9 text-sm"
          />
          {errors.name && <p className="text-[10px] text-destructive">{errors.name}</p>}
        </div>
        <div>
          <Label htmlFor="phone" className="text-[11px]">Phone *</Label>
          <Input
            id="phone"
            placeholder="10-digit number"
            value={data.phone}
            onChange={(e) => set("phone", e.target.value)}
            className="h-9 text-sm"
          />
          {errors.phone && <p className="text-[10px] text-destructive">{errors.phone}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowMore(!showMore)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showMore ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {showMore ? "Less details" : "Add email & notes"}
      </button>

      {showMore && (
        <div className="space-y-2">
          <div>
            <Label htmlFor="email" className="text-[11px]">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="customer@email.com"
              value={data.email}
              onChange={(e) => set("email", e.target.value)}
              className="h-9 text-sm"
            />
            {errors.email && <p className="text-[10px] text-destructive">{errors.email}</p>}
          </div>
          <div>
            <Label htmlFor="notes" className="text-[11px]">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Special instructions…"
              value={data.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="min-h-[50px] text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDetails;
export type { CustomerData };
