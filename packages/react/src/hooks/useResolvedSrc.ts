import { useCallback, useEffect, useState } from "react";
import { isSafeImageSrc } from "@nibblearn/core";
import { useNibblearn, type AssetResolution } from "../context/NibblearnProvider";

export type ResolvedSrcStatus = "ready" | "loading" | "error";

export interface ResolvedSrc {
  /** URL to render, or null while loading / after an error (show a placeholder). */
  src: string | null;
  status: ResolvedSrcStatus;
  /**
   * Call from `<img onError>`. Asks the resolver for a fresh URL once (for expired signed
   * links). Returns false when no retry is possible; the caller should show its fallback.
   */
  retry: () => boolean;
}

interface State {
  key: string;
  value: string | null;
  status: ResolvedSrcStatus;
  /** 0 = first resolution, 1 = after one retry. */
  attempt: 0 | 1;
}

const isAssetRef = (src: string) => /^\s*asset:/i.test(src);

/** A resolved URL must be a safe, directly loadable image address (not another asset ref). */
const acceptable = (url: unknown): url is string =>
  typeof url === "string" && isSafeImageSrc(url) && !isAssetRef(url);

/**
 * Resolve an image `src` through the provider's `resolveAsset`.
 *
 * - Without a resolver, ordinary URLs render as-is and `asset:` references fail closed.
 * - With a resolver, `asset:` references show a placeholder until resolved. Ordinary URLs
 *   render immediately and switch if the resolver returns a different URL.
 * - Results are cached per provider; concurrent requests for one key share a single call.
 */
export function useResolvedSrc(src: string): ResolvedSrc {
  const { resolveAsset, assetCache } = useNibblearn();

  const initialFor = useCallback(
    (key: string): State => {
      const cached = resolveAsset ? assetCache.values.get(key) : undefined;
      if (cached) return { key, value: cached, status: "ready", attempt: 0 };
      if (isAssetRef(key))
        return { key, value: null, status: resolveAsset ? "loading" : "error", attempt: 0 };
      return { key, value: key, status: "ready", attempt: 0 };
    },
    [resolveAsset, assetCache],
  );

  const [state, setState] = useState<State>(() => initialFor(src));
  let current = state;
  if (state.key !== src) {
    // Reset when the source changes (render-time update, not an effect).
    current = initialFor(src);
    setState(current);
  }

  const { attempt } = current;
  const needsResolve = !!resolveAsset && (attempt === 1 || !assetCache.values.has(src));

  useEffect(() => {
    if (!resolveAsset || !needsResolve) return;
    let cancelled = false;
    const reason = attempt === 1 ? "retry" : "initial";
    let pending = reason === "initial" ? assetCache.pending.get(src) : undefined;
    if (!pending) {
      pending = Promise.resolve()
        .then(() => resolveAsset(src, { reason }))
        .then(
          (url): AssetResolution => (url == null ? { kind: "keep" } : { kind: "url", url }),
          (): AssetResolution => ({ kind: "failed" }),
        );
      assetCache.pending.set(src, pending);
      void pending.finally(() => {
        if (assetCache.pending.get(src) === pending) assetCache.pending.delete(src);
      });
    }
    void pending.then((res) => {
      if (res.kind === "url" && acceptable(res.url)) assetCache.values.set(src, res.url);
      if (cancelled) return;
      setState((s) => {
        if (s.key !== src) return s;
        if (res.kind === "url" && acceptable(res.url))
          return { ...s, value: res.url, status: "ready" };
        // "Leave as is" works for ordinary URLs on the first try; an asset reference has nothing
        // to fall back to, and after a retry the original URL is already known to fail.
        if (res.kind === "keep" && !isAssetRef(src) && reason === "initial")
          return { ...s, value: src, status: "ready" };
        return { ...s, value: null, status: "error" };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [src, attempt, needsResolve, resolveAsset, assetCache]);

  const retry = useCallback(() => {
    if (!resolveAsset || current.attempt === 1) {
      setState((s) => (s.key === src ? { ...s, value: null, status: "error" } : s));
      return false;
    }
    assetCache.values.delete(src);
    assetCache.pending.delete(src);
    // Unmount the failed <img> while asking again, so the new URL loads in a fresh element.
    setState((s) => (s.key === src ? { ...s, attempt: 1, value: null, status: "loading" } : s));
    return true;
  }, [resolveAsset, assetCache, src, current.attempt]);

  return { src: current.value, status: current.status, retry };
}
