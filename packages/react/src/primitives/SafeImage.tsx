import { useState, type CSSProperties, type ImgHTMLAttributes } from "react";
import clsx from "clsx";
import { ImageOff } from "lucide-react";
import type { Media } from "@nibblearn/core";
import { useTranslator } from "../context/NibblearnProvider";
import { useResolvedSrc } from "../hooks/useResolvedSrc";

export interface SafeImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  media: Media;
  className?: string;
  /** Called when the image loads (with natural size). */
  onLoaded?: (size: { width: number; height: number }) => void;
  rounded?: boolean;
  showCaption?: boolean;
  style?: CSSProperties;
}

/**
 * Image with graceful fallback when the asset is missing or blocked. The `src` goes through
 * the provider's `resolveAsset` (see `useResolvedSrc`).
 */
export function SafeImage({
  media,
  className,
  onLoaded,
  rounded = true,
  showCaption = true,
  style,
  ...rest
}: SafeImageProps) {
  const t = useTranslator();
  const resolved = useResolvedSrc(media.src);
  const [failed, setFailed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(media.src);
  if (prevSrc !== media.src) {
    setPrevSrc(media.src);
    setFailed(false);
  }
  const ratio = media.width && media.height ? `${media.width} / ${media.height}` : undefined;
  return (
    <figure className={clsx("nb-image", !rounded && "nb-image--square", className)} style={style}>
      {resolved.status === "loading" ? (
        <div
          className="nb-image--loading"
          role="img"
          aria-busy="true"
          aria-label={media.alt || t("common.loading")}
          style={{ aspectRatio: ratio }}
        />
      ) : failed || resolved.status === "error" || !resolved.src ? (
        <div
          className="nb-image--fallback"
          role="img"
          aria-label={media.alt || t("common.imageUnavailable")}
        >
          <ImageOff aria-hidden size={18} />
          <span>{t("common.imageUnavailable")}</span>
        </div>
      ) : (
        <img
          src={resolved.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          // The same ratio the browser derives from width/height, stated as a style so it
          // survives stylesheets that reset attribute-based hints (styles.isolated.css).
          style={
            media.width && media.height
              ? { aspectRatio: `auto ${media.width} / ${media.height}` }
              : undefined
          }
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => {
            if (!resolved.retry()) setFailed(true);
          }}
          onLoad={(e) =>
            onLoaded?.({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            })
          }
          {...rest}
        />
      )}
      {showCaption && media.caption && (
        <figcaption className="nb-image__caption">{media.caption}</figcaption>
      )}
    </figure>
  );
}
