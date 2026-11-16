/** A location inside a config: object keys and array indices. */
export type Path = ReadonlyArray<string | number>;

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

function assertSafe(path: Path) {
  for (const seg of path)
    if (typeof seg === "string" && FORBIDDEN.has(seg))
      throw new TypeError(`unsafe path segment "${seg}"`);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Read the value at `path` (own properties only). */
export function getAt(root: unknown, path: Path): unknown {
  let cur: unknown = root;
  for (const seg of path) {
    if (typeof seg === "number") {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[seg];
    } else {
      if (!isRecord(cur) || !Object.prototype.hasOwnProperty.call(cur, seg)) return undefined;
      cur = cur[seg];
    }
  }
  return cur;
}

/**
 * Return a copy of `root` with `value` at `path`; containers along the path are copied, the
 * rest is shared. `undefined` removes an object key.
 */
export function setAt<T>(root: T, path: Path, value: unknown): T {
  assertSafe(path);
  const rec = (node: unknown, i: number): unknown => {
    if (i === path.length) return value;
    const seg = path[i]!;
    if (typeof seg === "number") {
      const arr = Array.isArray(node) ? [...node] : [];
      arr[seg] = rec(arr[seg], i + 1);
      return arr;
    }
    const obj: Record<string, unknown> = isRecord(node) ? { ...node } : {};
    const next = rec(Object.prototype.hasOwnProperty.call(obj, seg) ? obj[seg] : undefined, i + 1);
    if (next === undefined) delete obj[seg];
    else obj[seg] = next;
    return obj;
  };
  return rec(root, 0) as T;
}

/** Remove the array item or object key at `path`. */
export function removeAt<T>(root: T, path: Path): T {
  if (path.length === 0) return root;
  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1]!;
  const parent = getAt(root, parentPath);
  if (typeof last === "number" && Array.isArray(parent))
    return setAt(
      root,
      parentPath,
      parent.filter((_, i) => i !== last),
    );
  return setAt(root, path, undefined);
}

/** Insert `value` into the array at `path` before `index` (default: at the end). */
export function insertAt<T>(root: T, path: Path, value: unknown, index?: number): T {
  const arr = getAt(root, path);
  const list = Array.isArray(arr) ? [...arr] : [];
  list.splice(index ?? list.length, 0, value);
  return setAt(root, path, list);
}

/** Move the array item at `path` from `from` to `to`. */
export function moveItem<T>(root: T, path: Path, from: number, to: number): T {
  const arr = getAt(root, path);
  if (
    !Array.isArray(arr) ||
    from === to ||
    to < 0 ||
    to >= arr.length ||
    from < 0 ||
    from >= arr.length
  )
    return root;
  const list = [...arr];
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return setAt(root, path, list);
}
