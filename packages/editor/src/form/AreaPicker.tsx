import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SafeImage } from "@nibblearn/react";
import { useEditorT } from "../messages";
import { fieldId, useForm } from "./context";
import { getAt, type Path } from "./path";
import type { FormField } from "./schema";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isPercent = (f: FormField | undefined) =>
  f !== undefined && f.node.kind === "number" && f.node.min === 0 && f.node.max === 100;

const srcOf = (media: unknown) =>
  isRecord(media) && typeof media.src === "string" && media.src !== "" ? media.src : undefined;

/**
 * The image the coordinates at `path` refer to: the nearest `image` on the way up, or for an
 * item with a `side` ("before" / "after") the image of that side.
 */
function imageFor(root: unknown, path: Path, item: Record<string, unknown>): string | undefined {
  for (let n = path.length; n >= 0; n--) {
    const holder = getAt(root, path.slice(0, n));
    if (!isRecord(holder)) continue;
    const own = srcOf(holder.image);
    if (own) return own;
    const side = typeof item.side === "string" ? holder[item.side] : undefined;
    const sided = isRecord(side) ? srcOf(side.image) : undefined;
    if (sided) return sided;
  }
  return undefined;
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const round = (n: number) => Math.round(n * 10) / 10;
const num = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback);

/**
 * Sets `x` / `y` (and `width` / `height`) of an object by pointing at its image. Shown above
 * the number fields, which stay as the precise and keyboard-only way to edit the same values.
 * Renders nothing when the object has no percentage coordinates or no image is set yet.
 */
export function AreaPicker({
  fields,
  path,
  value,
}: {
  fields: FormField[];
  path: Path;
  value: Record<string, unknown>;
}) {
  const { formId, root, update, showHelp } = useForm();
  const t = useEditorT();
  const frame = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const field = (key: string) => fields.find((f) => f.key === key);
  if (!isPercent(field("x")) || !isPercent(field("y"))) return null;
  // An area has a required size. An optional size (a hotspot's hit area) leaves `x` / `y` a point.
  const region =
    isPercent(field("width")) &&
    isPercent(field("height")) &&
    field("width")!.required &&
    field("height")!.required;
  const src = imageFor(root, path, value);
  if (!src) return null;

  const x = num(value.x, 50);
  const y = num(value.y, 50);
  const width = num(value.width, 20);
  const height = num(value.height, 20);
  const set = (next: { x?: number; y?: number; width?: number; height?: number }) => {
    for (const key of ["x", "y", "width", "height"] as const) {
      const v = next[key];
      if (v !== undefined && round(v) !== value[key]) update([...path, key], round(v));
    }
  };
  const at = (e: PointerEvent) => {
    const box = frame.current!.getBoundingClientRect();
    return {
      x: clamp(box.width ? ((e.clientX - box.left) / box.width) * 100 : 0),
      y: clamp(box.height ? ((e.clientY - box.top) / box.height) * 100 : 0),
    };
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = at(e);
    setDrag(p);
    if (!region) set(p);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const p = at(e);
    if (!region) return set(p);
    const w = Math.abs(p.x - drag.x);
    const h = Math.abs(p.y - drag.y);
    // A drag draws the area between the two corners.
    if (w >= 1 && h >= 1)
      set({ x: Math.min(p.x, drag.x), y: Math.min(p.y, drag.y), width: w, height: h });
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!drag) return;
    const p = at(e);
    // A click without a drag moves the area so that its centre is under the pointer.
    if (region && Math.abs(p.x - drag.x) < 1 && Math.abs(p.y - drag.y) < 1)
      set({
        x: clamp(p.x - width / 2, 0, 100 - width),
        y: clamp(p.y - height / 2, 0, 100 - height),
      });
    setDrag(null);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = Object.prototype.hasOwnProperty.call(move, e.key) ? move[e.key] : undefined;
    if (!d) return;
    e.preventDefault();
    set({
      x: clamp(x + d[0], 0, region ? 100 - width : 100),
      y: clamp(y + d[1], 0, region ? 100 - height : 100),
    });
  };

  const id = `${fieldId(formId, path)}-area`;
  return (
    <div className="nbe-field nbe-area">
      <span className="nbe-field__label" id={`${id}-label`}>
        {t(region ? "editor.area.region" : "editor.area.point")}
      </span>
      <div
        ref={frame}
        className="nbe-area__frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      >
        <SafeImage media={{ src, alt: "" }} showCaption={false} draggable={false} />
        <button
          type="button"
          className={region ? "nbe-area__region" : "nbe-area__marker"}
          style={
            region
              ? { left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%` }
              : { left: `${x}%`, top: `${y}%` }
          }
          aria-labelledby={`${id}-label ${id}-value`}
          aria-describedby={showHelp ? `${id}-help` : undefined}
          onKeyDown={onKeyDown}
        >
          <span className="nbe-sr-only" id={`${id}-value`}>
            {t("editor.area.marker", { x: round(x), y: round(y) })}
          </span>
        </button>
      </div>
      {showHelp && (
        <p className="nbe-field__help" id={`${id}-help`}>
          {t(region ? "editor.area.regionHelp" : "editor.area.pointHelp")}
        </p>
      )}
    </div>
  );
}
