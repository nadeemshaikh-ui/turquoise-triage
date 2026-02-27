import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { OrderPhoto } from "@/hooks/useOrderDetail";

interface BeforeAfterPhotosProps {
  photos: OrderPhoto[];
  onUpload: (args: { files: File[]; photoType: string }) => Promise<void>;
  onDelete: (photo: { id: string; storagePath: string }) => void;
  isUploading: boolean;
}

const BeforeAfterPhotos = ({ photos, onUpload, onDelete, isUploading }: BeforeAfterPhotosProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<string>("before");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const beforePhotos = photos.filter((p) => p.photoType === "before");
  const afterPhotos = photos.filter((p) => p.photoType === "after");

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

  const renderPhotoGrid = (items: OrderPhoto[], label: string) => (
    <div className="flex-1 space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h4>
      {items.length === 0 ? (
        <div className="flex items-center justify-center rounded-[calc(var(--radius)/2)] border border-dashed border-border bg-muted/30 aspect-square">
          <p className="text-xs text-muted-foreground">No {label.toLowerCase()} photos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {items.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-[calc(var(--radius)/2)] border border-border bg-muted">
              <button onClick={() => setSelectedPhoto(p.url)} className="h-full w-full">
                <img src={p.url} alt={p.fileName} className="h-full w-full object-cover" loading="lazy" />
              </button>
              <button
                onClick={() => onDelete({ id: p.id, storagePath: p.storagePath })}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
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
        {renderPhotoGrid(beforePhotos, "Before")}
        {renderPhotoGrid(afterPhotos, "After")}
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
