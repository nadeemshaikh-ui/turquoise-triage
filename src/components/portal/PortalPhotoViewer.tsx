import { useState, useRef, useCallback } from "react";

interface DamagePin {
  id: string;
  x: number;
  y: number;
  label: string | null;
}

interface PortalPhotoViewerProps {
  photoUrl: string;
  markers?: DamagePin[];
}

const PortalPhotoViewer = ({ photoUrl, markers = [] }: PortalPhotoViewerProps) => {
  return (
    <div className="relative w-full overflow-hidden rounded-xl">
      <img src={photoUrl} alt="Order photo" className="w-full object-cover" />
      {markers.map((m, i) => (
        <div
          key={m.id}
          className="absolute w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            transform: "translate(-50%, -50%)",
            background: "hsl(37 40% 60%)",
            color: "hsl(0 0% 4%)",
            boxShadow: "0 0 8px hsl(37 40% 60% / 0.5)",
          }}
        >
          {i + 1}
        </div>
      ))}
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
      {/* After (full) */}
      <img src={afterUrl} alt="After" className="absolute inset-0 w-full h-full object-cover" />
      {/* Before (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <img src={beforeUrl} alt="Before" className="absolute inset-0 w-full h-full object-cover" style={{ minWidth: containerRef.current?.offsetWidth || "100%" }} />
      </div>
      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 cursor-ew-resize"
        style={{ left: `${position}%`, background: "hsl(37 40% 60%)" }}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            background: "hsl(37 40% 60%)",
            color: "hsl(0 0% 4%)",
            boxShadow: "0 0 12px hsl(37 40% 60% / 0.5)",
          }}
        >
          ↔
        </div>
      </div>
      {/* Labels */}
      <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "hsl(0 0% 4% / 0.7)", color: "hsl(37 40% 60%)" }}>
        BEFORE
      </span>
      <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "hsl(0 0% 4% / 0.7)", color: "hsl(37 40% 60%)" }}>
        AFTER
      </span>
    </div>
  );
};

export default PortalPhotoViewer;
