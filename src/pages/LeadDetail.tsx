import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Clock, Phone, Mail, Camera, MessageSquare, CheckCircle2, Loader2, Upload, ImagePlus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useLeadDetail } from "@/hooks/useLeadDetail";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";

const statusColor: Record<string, string> = {
  New: "bg-primary/15 text-primary border-primary/30",
  Assigned: "bg-accent text-accent-foreground border-accent",
  "In Progress": "bg-gold/15 text-gold-foreground border-gold/30",
  QC: "bg-secondary text-secondary-foreground border-border",
  "Ready for Pickup": "bg-green-100 text-green-800 border-green-300",
  Completed: "bg-muted text-muted-foreground border-border",
};

const actionIcons: Record<string, typeof CheckCircle2> = {
  status_change: CheckCircle2,
  note: MessageSquare,
  photo_upload: Camera,
};

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lead, photos, activity, isLoading, updateStatus, addNote, uploadPhotos, deletePhoto, STATUS_FLOW } = useLeadDetail(id!);
  const [note, setNote] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: leadItems } = useQuery({
    queryKey: ["lead-items", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lead_items")
        .select("*, service_categories(name), brands(name, tier)")
        .eq("lead_id", id!)
        .order("sort_order");
      return (data as any[]) || [];
    },
    enabled: !!id,
  });

  if (isLoading || !lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentIdx = STATUS_FLOW.indexOf(lead.status);
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

  const handleAdvance = () => {
    if (!nextStatus) return;
    updateStatus.mutate(nextStatus, {
      onSuccess: () => toast({ title: `Status updated to ${nextStatus}` }),
    });
  };

  const handleAddNote = () => {
    if (!note.trim()) return;
    addNote.mutate(note.trim(), {
      onSuccess: () => {
        setNote("");
        toast({ title: "Note added" });
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    uploadPhotos.mutate(files, {
      onSuccess: () => toast({ title: `${files.length} photo${files.length > 1 ? "s" : ""} uploaded` }),
      onError: () => toast({ title: "Upload failed", variant: "destructive" }),
    });
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold text-foreground">{lead.customerName}</h1>
              {lead.isGoldTier && <Crown className="h-4 w-4 shrink-0 text-gold" />}
            </div>
            <p className="truncate text-sm text-muted-foreground">{lead.serviceName}</p>
          </div>
          <Badge variant="outline" className={`shrink-0 rounded-full text-xs ${statusColor[lead.status] || ""}`}>
            {lead.status}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCard label="Quoted Price" value={`₹${lead.quotedPrice.toLocaleString("en-IN")}`} />
          <InfoCard label="TAT" value={`${lead.tatDaysMin}–${lead.tatDaysMax} days`} icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />} />
          <InfoCard label="Phone" value={lead.customerPhone} icon={<Phone className="h-3.5 w-3.5 text-muted-foreground" />} />
          <InfoCard label="Category" value={lead.category} />
        </div>

        {lead.notes && (
          <div className="rounded-[var(--radius)] border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">{lead.notes}</p>
          </div>
        )}

        {/* Lead Items */}
        {leadItems && leadItems.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Items</h2>
            {leadItems.map((item: any) => {
              const tierBadge: Record<string, string> = {
                standard: "bg-muted text-muted-foreground",
                luxury: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                ultra_luxury: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
              };
              const tierLabel: Record<string, string> = { standard: "Standard", luxury: "Luxury", ultra_luxury: "Ultra-Luxury" };
              return (
                <div key={item.id} className="rounded-[var(--radius)] border border-border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{item.service_categories?.name || "Item"}</p>
                      {item.brands && (
                        <>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-xs font-medium text-foreground">{item.brands.name}</span>
                          <Badge className={`text-[9px] ${tierBadge[item.brands.tier] || ""}`}>{tierLabel[item.brands.tier] || item.brands.tier}</Badge>
                        </>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-foreground">₹{Number(item.manual_price).toLocaleString()}</span>
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  <Badge variant="outline" className="text-[10px]">{item.mode}</Badge>
                </div>
              );
            })}
          </section>
        )}

        {/* Status Stepper */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Order Progress</h2>
          <div className="flex items-center gap-1">
            {STATUS_FLOW.map((s, i) => {
              const done = i <= currentIdx;
              return (
                <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className={`h-2 w-full rounded-full transition-colors ${done ? "bg-primary" : "bg-border"}`} />
                  <span className={`text-[10px] font-medium ${done ? "text-primary" : "text-muted-foreground"}`}>{s}</span>
                </div>
              );
            })}
          </div>
          {nextStatus && (
            <Button
              onClick={handleAdvance}
              disabled={updateStatus.isPending}
              className="w-full rounded-[var(--radius)] gap-2"
            >
              {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Move to {nextStatus}
            </Button>
          )}
        </section>

        {/* Photo Gallery */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Photos</h2>
              <span className="text-xs text-muted-foreground">({photos.length})</span>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-[var(--radius)]"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadPhotos.isPending}
              >
                {uploadPhotos.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Upload
              </Button>
            </div>
          </div>
          {photos.length === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-[var(--radius)] border border-dashed border-border bg-muted/30 p-8 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50"
            >
              <ImagePlus className="h-8 w-8" />
              <span className="text-sm">Click to upload photos</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p) => (
                <div key={p.id} className="group relative aspect-square overflow-hidden rounded-[calc(var(--radius)/2)] border border-border bg-muted transition-shadow hover:shadow-md">
                  <button
                    onClick={() => setSelectedPhoto(p.url)}
                    className="h-full w-full"
                  >
                    <img src={p.url} alt={p.fileName} className="h-full w-full object-cover" loading="lazy" />
                  </button>
                  <button
                    onClick={() => deletePhoto.mutate({ id: p.id, storagePath: p.storagePath }, {
                      onSuccess: () => toast({ title: "Photo deleted" }),
                    })}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Photo Lightbox */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <img
              src={selectedPhoto}
              alt="Lead photo"
              className="max-h-[85vh] max-w-full rounded-[var(--radius)] object-contain"
            />
          </div>
        )}

        {/* Add Note */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Add a Note</h2>
          <div className="flex gap-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Type a note…"
              className="min-h-[60px] rounded-[calc(var(--radius)/2)]"
            />
            <Button
              onClick={handleAddNote}
              disabled={!note.trim() || addNote.isPending}
              size="icon"
              className="shrink-0 self-end rounded-[var(--radius)]"
            >
              {addNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            </Button>
          </div>
        </section>

        {/* Activity Timeline */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-0">
              {activity.map((item, i) => {
                const Icon = actionIcons[item.action] || MessageSquare;
                return (
                  <div key={item.id} className="relative flex gap-3 pb-4">
                    {/* Timeline line */}
                    {i < activity.length - 1 && (
                      <div className="absolute left-[13px] top-7 h-full w-px bg-border" />
                    )}
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm text-foreground">{item.details || item.action}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.userName && `${item.userName} · `}
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Created date */}
        <p className="text-center text-xs text-muted-foreground">
          Created {format(new Date(lead.createdAt), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </main>
    </div>
  );
};

const InfoCard = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div className="rounded-[var(--radius)] border border-border bg-card p-3">
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
    <p className="mt-1 text-sm font-semibold text-card-foreground">{value}</p>
  </div>
);

export default LeadDetail;
