/** Mulberry32 seeded PRNG. Deterministic across platforms. */
export function createRandom(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], seed?: number): T[] {
  const rnd = createRandom(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Shuffle but guarantee the result differs from the input order when possible. */
export function shuffleDerangement<T>(items: readonly T[], seed?: number): T[] {
  if (items.length < 2) return items.slice();
  let out = shuffle(items, seed);
  let tries = 0;
  while (tries < 10 && out.every((v, i) => v === items[i])) {
    out = shuffle(items, seed === undefined ? undefined : seed + tries + 1);
    tries++;
  }
  if (out.every((v, i) => v === items[i])) {
    // rotate as a last resort
    out = [...out.slice(1), out[0]!];
  }
  return out;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Normalise free-text answers for comparison. */
export function normalizeAnswer(
  value: string,
  options: { caseSensitive?: boolean; lenient?: boolean } = {},
): string {
  let v = value.normalize("NFKC");
  if (!options.caseSensitive) v = v.toLowerCase();
  if (options.lenient !== false) {
    v = v
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[.,;:!?'"()[\]{}]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return v;
}

let counter = 0;
/** Stable-ish unique id for runtime use (not for persistence). */
export function uid(prefix = "nb"): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `${prefix}-${counter.toString(36)}`;
}

export function roundTo(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Deterministic seed from a string and a run counter (FNV-1a). Used for shuffles so
 * that server-rendered HTML and the first client render agree (no hydration mismatch),
 * while each retry (`run`) still gets a different order.
 */
export function seedFromString(value: string, run = 0): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) + Math.imul(run + 1, 0x9e3779b1)) >>> 0;
}
