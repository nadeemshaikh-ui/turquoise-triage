import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, ImagePlus, Loader2, X, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { OrderPhoto } from "@/hooks/useOrderDetail";

interface BeforeAfterPhotosProps {
  photos: OrderPhoto[];
  onUpload: (args: { files: File[]; photoType: string }) => Promise<void>;
  onDelete: (photo: { id: string; storagePath: string }) => void;
  isUploading: boolean;
}

interface PhotoMarker {
  id: string;
  photoId: string;
  x: number;
  y: number;
  label: string | null;
}

const BeforeAfterPhotos = ({ photos, onUpload, onDelete, isUploading }: BeforeAfterPhotosProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<string>("before");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [markerPhotoId, setMarkerPhotoId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const beforePhotos = photos.filter((p) => p.photoType === "before");
  const afterPhotos = photos.filter((p) => p.photoType === "after");

  // Fetch markers for all before photos
  const beforePhotoIds = beforePhotos.map((p) => p.id);
  const { data: markersData } = useQuery({
    queryKey: ["photo-markers", beforePhotoIds],
    queryFn: async () => {
      if (beforePhotoIds.length === 0) return [];
      const { data, error } = await supabase
        .from("photo_markers")
        .select("*")
        .in("photo_id", beforePhotoIds);
      if (error) throw error;
      return (data || []).map((m: any) => ({
        id: m.id,
        photoId: m.photo_id,
        x: Number(m.x_coordinate),
        y: Number(m.y_coordinate),
        label: m.label,
      })) as PhotoMarker[];
    },
    enabled: beforePhotoIds.length > 0,
  });

  const addMarker = useMutation({
    mutationFn: async ({ photoId, x, y }: { photoId: string; x: number; y: number }) => {
      const markers = (markersData || []).filter((m) => m.photoId === photoId);
      const label = String(markers.length + 1);
      const { error } = await supabase.from("photo_markers").insert({
        photo_id: photoId,
        x_coordinate: x,
        y_coordinate: y,
        label,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photo-markers"] });
    },
  });

  const deleteMarker = useMutation({
    mutationFn: async (markerId: string) => {
      const { error } = await supabase.from("photo_markers").delete().eq("id", markerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photo-markers"] });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      await onUpload({ files, photoType: uploadType });
      toast({ title: `${files.length} ${uploadType} photo(s) uploaded` });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleMarkerClick = (photoId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    addMarker.mutate({ photoId, x, y });
  };

  const renderPhotoGrid = (items: OrderPhoto[], label: string, isBeforeSection: boolean) => (
    <div className="flex-1 space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h4>
      {items.length === 0 ? (
        <div className="flex items-center justify-center rounded-[calc(var(--radius)/2)] border border-dashed border-border bg-muted/30 aspect-square">
          <p className="text-xs text-muted-foreground">No {label.toLowerCase()} photos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {items.map((p) => {
            const photoMarkers = isBeforeSection ? (markersData || []).filter((m) => m.photoId === p.id) : [];
            const isMarkerMode = markerPhotoId === p.id;
            return (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-[calc(var(--radius)/2)] border border-border bg-muted">
                {isBeforeSection && isMarkerMode ? (
                  <div
                    className="relative h-full w-full cursor-crosshair"
                    onClick={(e) => handleMarkerClick(p.id, e)}
                  >
                    <img src={p.url} alt={p.fileName} className="h-full w-full object-cover" />
                    {photoMarkers.map((m) => (
                      <button
                        key={m.id}
                        onClick={(e) => { e.stopPropagation(); deleteMarker.mutate(m.id); }}
                        className="absolute flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white border border-white shadow-md -translate-x-1/2 -translate-y-1/2 hover:bg-destructive transition-colors"
                        style={{ left: `${m.x}%`, top: `${m.y}%` }}
                        title="Click to remove"
                      >
                        {m.label}
                      </button>
                    ))}
                    <div className="absolute bottom-1 left-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-center text-[9px] text-white">
                      Click to pin · Click pin to delete
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (isBeforeSection) {
                        setMarkerPhotoId(isMarkerMode ? null : p.id);
                      } else {
                        setSelectedPhoto(p.url);
                      }
                    }}
                    className="h-full w-full relative"
                  >
                    <img src={p.url} alt={p.fileName} className="h-full w-full object-cover" loading="lazy" />
                    {photoMarkers.map((m) => (
                      <div
                        key={m.id}
                        className="absolute flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white border border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ left: `${m.x}%`, top: `${m.y}%` }}
                      >
                        {m.label}
                      </div>
                    ))}
                    {isBeforeSection && (
                      <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MapPin className="h-4 w-4 text-amber-500 drop-shadow" />
                      </div>
                    )}
                  </button>
                )}
                <button
                  onClick={() => onDelete({ id: p.id, storagePath: p.storagePath })}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 icon-recessed" />
          <h2 className="text-sm font-semibold text-foreground">Before / After</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={uploadType} onValueChange={setUploadType}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="before">Before</SelectItem>
              <SelectItem value="after">After</SelectItem>
            </SelectContent>
          </Select>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            Upload
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        {renderPhotoGrid(beforePhotos, "Before", true)}
        {renderPhotoGrid(afterPhotos, "After", false)}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} alt="Order photo" className="max-h-[85vh] max-w-full rounded-[var(--radius)] object-contain" />
        </div>
      )}
    </section>
  );
};

export default BeforeAfterPhotos;
