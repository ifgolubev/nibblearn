import { z } from "zod";
import { idSchema, mediaSchema, moduleBaseShape, textSchema } from "../common";

const pct = z.number().min(0).max(100);

export const hotspotSchema = z.object({
  id: idSchema,
  /** Horizontal position as a percentage of image width (0–100). */
  x: pct,
  /** Vertical position as a percentage of image height (0–100). */
  y: pct,
  /** For "rect" hotspots: size as percentage of the image. */
  width: pct.optional(),
  height: pct.optional(),
  shape: z.enum(["dot", "rect"]).default("dot"),
  /** Short label used in the accessible list and tooltip. */
  label: z.string().max(80),
  title: z.string().max(120).optional(),
  description: textSchema,
  /** Where to place the info panel relative to the hotspot on large screens. */
  placement: z.enum(["auto", "top", "bottom", "left", "right"]).default("auto"),
});
export type Hotspot = z.infer<typeof hotspotSchema>;

export const hotspotExplorerSchema = z.object({
  ...moduleBaseShape,
  type: z.literal("hotspot-explorer"),
  content: z.object({
    image: mediaSchema,
    hotspots: z.array(hotspotSchema).min(1).max(30),
  }),
  behavior: z
    .object({
      /** The module completes only after every hotspot has been opened. */
      requireAll: z.boolean().default(true),
      /** Show numbered markers instead of plain dots. */
      numbered: z.boolean().default(true),
      /** Pulse unvisited hotspots to invite exploration. */
      pulse: z.boolean().default(true),
    })
    .default({ requireAll: true, numbered: true, pulse: true }),
});
export type HotspotExplorerConfig = z.infer<typeof hotspotExplorerSchema>;
export type HotspotExplorerInput = z.input<typeof hotspotExplorerSchema>;
