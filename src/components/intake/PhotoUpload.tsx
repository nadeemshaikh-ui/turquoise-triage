import { useRef, useState } from "react";
import { Camera, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  required: boolean;
  minPhotos?: number;
  error?: string;
};

const PhotoUpload = ({ files, onFilesChange, required, minPhotos = 3, error }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const newFiles = [...files, ...selected];
    onFilesChange(newFiles);

    const newPreviews = selected.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);

    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    onFilesChange(files.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Photo Upload</h2>
        <p className="text-sm text-muted-foreground">
          {required
            ? `Upload at least ${minPhotos} photos of the item`
            : "Photos are optional for this service"}
        </p>
      </div>

      {/* Grid of previews */}
      <div className="grid grid-cols-3 gap-2">
        {previews.map((src, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border">
            <img src={src} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground shadow"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Add button */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition-colors",
            "border-border text-muted-foreground hover:border-primary hover:text-primary"
          )}
        >
          <ImagePlus className="h-6 w-6" />
          <span className="text-[10px] font-medium">Add Photo</span>
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleAdd}
      />

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="h-4 w-4" />
        Take or Choose Photos
      </Button>
    </div>
  );
};

export default PhotoUpload;
