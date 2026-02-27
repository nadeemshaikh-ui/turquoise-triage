import { useState, useRef, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";

interface DamagePin {
  id: string;
  x: number;
  y: number;
  label: string | null;
  photoId?: string;
}

interface PortalPhotoViewerProps {
  photos: { id: string; url: string }[];
  markers?: DamagePin[];
}

const PortalPhotoViewer = ({ photos, markers = [] }: PortalPhotoViewerProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [activeIndex, setActiveIndex] = useState(0);

  // Properly track active slide via useEffect
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  if (photos.length === 0) return null;

  const activePhoto = photos[activeIndex];
  const activeMarkers = activePhoto
    ? markers.filter((m) => m.photoId === activePhoto.id)
    : [];

  return (
    <div className="space-y-2">
      <div className="relative w-full overflow-hidden rounded-xl">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex" style={{ scrollSnapType: "x mandatory" }}>
            {photos.map((photo, i) => (
              <div
                key={photo.id}
                className="relative flex-[0_0_100%] min-w-0"
                style={{ scrollSnapAlign: "start" }}
              >
                <img src={photo.url} alt={`Photo ${i + 1}`} className="w-full object-cover rounded-xl" />
                {/* Markers for this specific photo */}
                {i === activeIndex && activeMarkers.map((m, mi) => (
                  <div
                    key={m.id}
                    className="absolute w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      left: `${m.x}%`,
                      top: `${m.y}%`,
                      transform: "translate(-50%, -50%)",
                      background: "hsl(37 40% 60%)",
                      color: "hsl(215 25% 33%)",
                      boxShadow: "0 0 8px hsl(37 40% 60% / 0.5)",
                    }}
                  >
                    {mi + 1}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === activeIndex
                  ? "bg-[hsl(var(--portal-gold))] w-4"
                  : "bg-[hsl(var(--portal-border))]"
              }`}
            />
          ))}
        </div>
      )}

      {/* Pin legend */}
      {activeMarkers.length > 0 && (
        <div className="space-y-1 px-1">
          {activeMarkers.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2 text-xs text-[hsl(var(--portal-muted))]">
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold bg-[hsl(var(--portal-gold)/0.2)] text-[hsl(var(--portal-gold))]">
                {i + 1}
              </span>
              <span>{m.label || "Damage point"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Before/After slider using pure CSS/JS drag
export const BeforeAfterSlider = ({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) => {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current || !dragging.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  const handleStart = () => { dragging.current = true; };
  const handleEnd = () => { dragging.current = false; };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] overflow-hidden rounded-xl cursor-ew-resize select-none"
      onMouseMove={(e) => handleMove(e.clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onMouseUp={handleEnd}
      onTouchEnd={handleEnd}
      onMouseLeave={handleEnd}
    >
      <img src={afterUrl} alt="After" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <img src={beforeUrl} alt="Before" className="absolute inset-0 w-full h-full object-cover" style={{ minWidth: containerRef.current?.offsetWidth || "100%" }} />
      </div>
      <div
        className="absolute top-0 bottom-0 w-0.5 cursor-ew-resize bg-[hsl(var(--portal-gold))]"
        style={{ left: `${position}%` }}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-[hsl(var(--portal-gold))] text-[hsl(215_25%_33%)]"
          style={{ boxShadow: "0 0 12px hsl(37 40% 60% / 0.5)" }}
        >
          ↔
        </div>
      </div>
      <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[hsl(215_25%_33%/0.7)] text-[hsl(var(--portal-gold))]">
        BEFORE
      </span>
      <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[hsl(215_25%_33%/0.7)] text-[hsl(var(--portal-gold))]">
        AFTER
      </span>
    </div>
  );
};

export default PortalPhotoViewer;
