import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Pencil, Trash2, Loader2, Phone, Mail, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
  leadCount: number;
}

const Customers = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers-directory"],
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch lead counts
      const { data: leads } = await supabase
        .from("leads")
        .select("customer_id");

      const countMap: Record<string, number> = {};
      (leads || []).forEach((l: any) => {
        countMap[l.customer_id] = (countMap[l.customer_id] || 0) + 1;
      });

      return (data || []).map((c: any) => ({
        ...c,
        leadCount: countMap[c.id] || 0,
      }));
    },
  });

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: string; name: string; phone: string; email: string }) => {
      if (payload.id) {
        const { error } = await supabase
          .from("customers")
          .update({ name: payload.name, phone: payload.phone, email: payload.email || null })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customers")
          .insert({ name: payload.name, phone: payload.phone, email: payload.email || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers-directory"] });
      toast({ title: editCustomer ? "Customer updated" : "Customer added" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers-directory"] });
      toast({ title: "Customer deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setForm({ name: "", phone: "", email: "" });
    setEditCustomer(null);
    setShowAdd(true);
  };

  const openEdit = (c: Customer) => {
    setForm({ name: c.name, phone: c.phone, email: c.email || "" });
    setEditCustomer(c);
    setShowAdd(true);
  };

  const closeDialog = () => {
    setShowAdd(false);
    setEditCustomer(null);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    saveMutation.mutate({ id: editCustomer?.id, ...form });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Customers</h1>
        <Button className="rounded-[28px] gap-2 shadow-md" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-[28px]"
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {search ? "No customers match your search." : "No customers yet."}
          </p>
        )}
        {filtered.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-[20px] border bg-card p-4 shadow-[0_2px_10px_-4px_hsl(174_72%_56%/0.10)] transition-all hover:shadow-[0_4px_16px_-4px_hsl(174_72%_56%/0.18)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-card-foreground truncate">{c.name}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" /> {c.phone}
                </span>
                {c.email && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" /> {c.email}
                  </span>
                )}
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {c.leadCount} {c.leadCount === 1 ? "order" : "orders"}
            </Badge>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => {
                  if (c.leadCount > 0) {
                    toast({ title: "Cannot delete", description: "This customer has active orders.", variant: "destructive" });
                    return;
                  }
                  deleteMutation.mutate(c.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{editCustomer ? "Edit Customer" : "New Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="rounded-[14px]" />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="rounded-[14px]" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="rounded-[14px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="rounded-[14px]">Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} className="rounded-[14px]">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editCustomer ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
