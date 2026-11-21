import { useState, type CSSProperties } from "react";
import clsx from "clsx";
import { VideoOff } from "lucide-react";
import type { Video } from "@nibblearn/core";
import { useTranslator } from "../context/NibblearnProvider";
import { useResolvedSrc } from "../hooks/useResolvedSrc";

export interface SafeVideoProps {
  video: Video;
  className?: string;
  style?: CSSProperties;
  /** Called the first time playback starts. */
  onPlay?: () => void;
}

/**
 * Self-hosted video with the browser's native controls and a fallback when the file is
 * missing or blocked. Never autoplays. `src`, `poster` and the captions file go through
 * the provider's `resolveAsset` (see `useResolvedSrc`).
 */
export function SafeVideo(props: SafeVideoProps) {
  // The poster is resolved by a wrapper so the hook only runs when there is one.
  return props.video.poster ? (
    <WithPoster {...props} poster={props.video.poster} />
  ) : (
    <VideoFrame {...props} poster={undefined} />
  );
}

function WithPoster({ poster, ...props }: SafeVideoProps & { poster: string }) {
  const resolved = useResolvedSrc(poster);
  return <VideoFrame {...props} poster={resolved.src ?? undefined} />;
}

function VideoFrame({
  video,
  className,
  style,
  onPlay,
  poster,
}: SafeVideoProps & { poster: string | undefined }) {
  const t = useTranslator();
  const resolved = useResolvedSrc(video.src);
  const [failed, setFailed] = useState(false);
  const [played, setPlayed] = useState(false);
  const [prevSrc, setPrevSrc] = useState(video.src);
  if (prevSrc !== video.src) {
    setPrevSrc(video.src);
    setFailed(false);
    setPlayed(false);
  }
  const name = video.title || t("common.video");
  return (
    <div className={clsx("nb-video", className)} style={style}>
      {resolved.status === "loading" ? (
        <div className="nb-image--loading" role="img" aria-busy="true" aria-label={name} />
      ) : failed || resolved.status === "error" || !resolved.src ? (
        <div className="nb-image--fallback" role="img" aria-label={t("common.videoUnavailable")}>
          <VideoOff aria-hidden size={18} />
          <span>{t("common.videoUnavailable")}</span>
        </div>
      ) : (
        <video
          src={resolved.src}
          poster={poster}
          controls
          playsInline
          preload="metadata"
          aria-label={name}
          onError={() => {
            if (!resolved.retry()) setFailed(true);
          }}
          onPlay={() => {
            if (played) return;
            setPlayed(true);
            onPlay?.();
          }}
        >
          {video.captions && <CaptionsTrack captions={video.captions} />}
        </video>
      )}
    </div>
  );
}

function CaptionsTrack({ captions }: { captions: NonNullable<Video["captions"]> }) {
  const resolved = useResolvedSrc(captions.src);
  if (!resolved.src) return null;
  return (
    <track
      kind="captions"
      src={resolved.src}
      srcLang={captions.lang}
      label={captions.label}
      default
    />
  );
}
