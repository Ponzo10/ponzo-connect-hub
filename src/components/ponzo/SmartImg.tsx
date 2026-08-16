import { memo, useState, type ImgHTMLAttributes } from "react";

import { optimizedImage } from "@/lib/image";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  /** Largeur d'affichage réelle (px CSS) : sert à demander une image adaptée. */
  width?: number | undefined;
  quality?: number | undefined;
};

/**
 * Image légère : demande la variante compressée du stockage et retombe
 * automatiquement sur l'original si la transformation est indisponible.
 */
function SmartImgBase({ src, width, quality, alt = "", loading = "lazy", ...rest }: Props) {
  const [fallback, setFallback] = useState(false);
  if (!src) return null;
  const finalSrc = fallback
    ? src
    : (optimizedImage(src, { ...(width ? { width: width * 2 } : {}), ...(quality ? { quality } : {}) }) ?? src);

  return (
    <img
      {...rest}
      src={finalSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFallback(true)}
    />
  );
}

export const SmartImg = memo(SmartImgBase);
