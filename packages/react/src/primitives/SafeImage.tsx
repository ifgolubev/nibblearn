import { useState, type CSSProperties, type ImgHTMLAttributes } from "react";
import clsx from "clsx";
import { ImageOff } from "lucide-react";
import type { Media } from "@nibblearn/core";
import { useTranslator } from "../context/NibblearnProvider";

export interface SafeImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  media: Media;
  className?: string;
  /** Called when the image loads (with natural size). */
  onLoaded?: (size: { width: number; height: number }) => void;
  rounded?: boolean;
  showCaption?: boolean;
  style?: CSSProperties;
}

/** Image with graceful fallback when the asset is missing or blocked. */
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
  const [failed, setFailed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(media.src);
  if (prevSrc !== media.src) {
    setPrevSrc(media.src);
    setFailed(false);
  }
  return (
    <figure className={clsx("nb-image", !rounded && "nb-image--square", className)} style={style}>
      {failed ? (
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
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
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
