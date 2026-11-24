import { z } from "zod";
import {
  completeOnSchema,
  idSchema,
  longTextSchema,
  mediaSchema,
  moduleBaseShape,
} from "../common";

/** Reports duplicate ids inside a list at `path`. */
function uniqueIds(items: { id: string }[], path: (string | number)[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (seen.has(item.id))
      ctx.addIssue({
        code: "custom",
        path: [...path, i, "id"],
        message: `duplicate id "${item.id}"`,
      });
    seen.add(item.id);
  });
}

// ---- callout ----------------------------------------------------------------------------------

export const calloutSchema = z.object({
  ...moduleBaseShape,
  type: z.literal("callout"),
  content: z.object({
    /** Visual tone and icon. */
    variant: z.enum(["info", "tip", "warning", "success", "note"]).default("info"),
    /** Short heading inside the box. */
    title: z.string().max(200).optional().meta({ title: "Heading" }),
    /** The callout text. Supports **bold**, *italic*, `code`, [links](https://…) and lists. */
    text: longTextSchema,
  }),
});
export type CalloutConfig = z.infer<typeof calloutSchema>;
export type CalloutInput = z.input<typeof calloutSchema>;

// ---- accordion --------------------------------------------------------------------------------

export const accordionItemSchema = z.object({
  id: idSchema,
  /** Panel heading; always visible. */
  title: z.string().min(1).max(200),
  /** Panel text, shown when the panel is open. */
  text: longTextSchema,
  image: mediaSchema.optional(),
});

export const accordionSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("accordion"),
    content: z.object({
      items: z.array(accordionItemSchema).min(1).max(30),
    }),
    behavior: z
      .object({
        /** Let several panels be open at once. */
        allowMultiple: z.boolean().default(false),
        /** Panels open when the block first appears. */
        defaultOpen: z.enum(["none", "first", "all"]).default("none"),
        /** "view": complete when shown. "all-items": complete once every panel was opened. */
        completeOn: completeOnSchema,
      })
      .default({ allowMultiple: false, defaultOpen: "none", completeOn: "view" }),
  })
  .superRefine((cfg, ctx) => uniqueIds(cfg.content.items, ["content", "items"], ctx));
export type AccordionConfig = z.infer<typeof accordionSchema>;
export type AccordionInput = z.input<typeof accordionSchema>;

// ---- tabs -------------------------------------------------------------------------------------

export const tabSchema = z.object({
  id: idSchema,
  /** Tab label; keep it short. */
  label: z.string().min(1).max(40),
  /** Tab panel text. */
  text: longTextSchema,
  image: mediaSchema.optional(),
});

export const tabsSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("tabs"),
    content: z.object({
      tabs: z.array(tabSchema).min(2).max(8),
    }),
    behavior: z
      .object({
        /** "view": complete when shown. "all-items": complete once every tab was opened. */
        completeOn: completeOnSchema,
      })
      .default({ completeOn: "view" }),
  })
  .superRefine((cfg, ctx) => uniqueIds(cfg.content.tabs, ["content", "tabs"], ctx));
export type TabsConfig = z.infer<typeof tabsSchema>;
export type TabsInput = z.input<typeof tabsSchema>;

// ---- carousel ---------------------------------------------------------------------------------

export const carouselSlideSchema = z.object({
  id: idSchema,
  /** Slide heading. */
  title: z.string().max(200).optional(),
  /** Slide text. */
  text: longTextSchema.optional(),
  image: mediaSchema.optional(),
});

export const carouselSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("carousel"),
    content: z.object({
      slides: z.array(carouselSlideSchema).min(1).max(30),
    }),
    behavior: z
      .object({
        /** After the last slide, "Next" goes back to the first. */
        loop: z.boolean().default(false),
        /** Show a dot per slide for direct navigation. */
        showDots: z.boolean().default(true),
        /** "view": complete when shown. "all-items": complete once every slide was seen. */
        completeOn: completeOnSchema,
      })
      .default({ loop: false, showDots: true, completeOn: "view" }),
  })
  .superRefine((cfg, ctx) => {
    uniqueIds(cfg.content.slides, ["content", "slides"], ctx);
    cfg.content.slides.forEach((slide, i) => {
      if (!slide.title && !slide.text && !slide.image)
        ctx.addIssue({
          code: "custom",
          path: ["content", "slides", i],
          message: "a slide needs a title, text or an image",
        });
    });
  });
export type CarouselConfig = z.infer<typeof carouselSchema>;
export type CarouselInput = z.input<typeof carouselSchema>;

// ---- columns ----------------------------------------------------------------------------------

export const columnSchema = z.object({
  id: idSchema,
  /** Column heading. */
  title: z.string().max(200).optional(),
  /** Column text. */
  text: longTextSchema.optional(),
  image: mediaSchema.optional(),
});

export const columnsSchema = z
  .object({
    ...moduleBaseShape,
    type: z.literal("columns"),
    content: z.object({
      columns: z.array(columnSchema).min(2).max(4),
    }),
    layout: z
      .object({
        /** Width ratio for two columns; more columns are always equal. */
        ratio: z.enum(["equal", "1-2", "2-1"]).default("equal"),
      })
      .default({ ratio: "equal" }),
  })
  .superRefine((cfg, ctx) => uniqueIds(cfg.content.columns, ["content", "columns"], ctx));
export type ColumnsConfig = z.infer<typeof columnsSchema>;
export type ColumnsInput = z.input<typeof columnsSchema>;
