import { X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Viewer = { open: (src: string, alt?: string) => void };

const PhotoViewerContext = createContext<Viewer>({ open: () => {} });

export function usePhotoViewer() {
  return useContext(PhotoViewerContext);
}

export function PhotoViewerProvider({ children }: { children: ReactNode }) {
  const [photo, setPhoto] = useState<{ src: string; alt: string } | null>(null);

  const open = useCallback((src: string, alt = "Photo") => setPhoto({ src, alt }), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <PhotoViewerContext.Provider value={value}>
      {children}
      {photo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={photo.alt}
          onClick={() => setPhoto(null)}
          className="fixed inset-0 z-[100] grid place-items-center bg-foreground/95 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            aria-label="Fermer"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-background/15 text-background"
            onClick={() => setPhoto(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={photo.src}
            alt={photo.alt}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </PhotoViewerContext.Provider>
  );
}
