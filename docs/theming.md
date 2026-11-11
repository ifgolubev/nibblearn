# Theming

Nibblearn styles are scoped to `.nb-root` and driven entirely by `--nb-*` CSS custom properties. Change a handful of variables and every module, the player and the primitives follow.

## Light, dark and system

Three ways to pick the mode, in order of precedence:

1. **`theme` prop** on `NibblearnProvider` or `LessonPlayer` (`"light" | "dark" | "system"`, default `"system"`). The provider writes `data-nb-theme` on its `.nb-root` element; each module's `ModuleShell` mirrors it.
2. **`data-nb-theme` attribute** on any `.nb-root` you render yourself.
3. **Ancestor convention**: when any ancestor has the class `.dark` or the attribute `[data-theme="dark"]` / `[data-mode="dark"]`, every `.nb-root` inside switches to dark unless it explicitly sets `data-nb-theme="light"`. This matches Tailwind's `dark` class strategy and most site toggles with no extra wiring.

```tsx
<NibblearnProvider theme="dark">…</NibblearnProvider>
```

```html
<!-- Site-level toggle; Nibblearn follows automatically -->
<html class="dark">
  …
  <div class="nb-root">…</div>
</html>
```

`"system"` follows `prefers-color-scheme`. The theme also sets `color-scheme`, so native controls (sliders, inputs) match.

## Overriding tokens

### On `.nb-root`

```css
.nb-root {
  --nb-accent: #0ea5e9;
  --nb-accent-hover: #0284c7;
  --nb-accent-active: #0369a1;
  --nb-accent-soft: #e0f2fe;
  --nb-accent-soft-fg: #075985;
  --nb-accent-ring: rgba(14, 165, 233, 0.35);
  --nb-radius-md: 8px;
  --nb-font: "IBM Plex Sans", system-ui, sans-serif;
}

/* Dark variant of the same brand */
.nb-root[data-nb-theme="dark"],
.dark .nb-root:not([data-nb-theme="light"]) {
  --nb-accent: #38bdf8;
  --nb-accent-fg: #0b0d12;
  --nb-accent-soft: rgba(56, 189, 248, 0.16);
  --nb-accent-soft-fg: #bae6fd;
}
```

Put the rule after the Nibblearn stylesheet import so it wins on specificity ties. Scoping to a wrapper (`.my-course .nb-root`) lets different pages use different brands.

### Through `NibblearnProvider` props

For the three most common tweaks you do not need CSS:

```tsx
<NibblearnProvider accent="#0ea5e9" radius={8} fontFamily='"IBM Plex Sans", sans-serif'>
```

- `accent` sets `--nb-accent` inline on the root.
- `radius` sets `--nb-radius-sm` (radius − 4), `--nb-radius-md` (radius), `--nb-radius-lg` (radius + 4) and `--nb-radius-xl` (radius + 12).
- `fontFamily` sets `--nb-font`.

A lesson can carry the same values in `theme.accent`, `theme.radius` and `theme.fontFamily`; `LessonPlayer` passes them to its internal provider.

### Per module

`appearance.accent` on any module config overrides `--nb-accent` for that module only:

```json
{
  "id": "warning-quiz",
  "type": "true-false",
  "appearance": { "accent": "#d97706", "compact": true },
  "content": { "…": "…" }
}
```

## CSS variable reference

All values below are the light defaults. Dark mode redefines the colour and shadow groups.

### Typography

| Token                                 | Default                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `--nb-font`                           | Inter, system-ui stack                                   |
| `--nb-font-display`                   | "Bricolage Grotesque", `--nb-font`                       |
| `--nb-title-transform`                | none (set to `uppercase` for shouty titles)              |
| `--nb-title-weight`                   | 700                                                      |
| `--nb-title-tracking`                 | -0.025em                                                 |
| `--nb-font-mono`                      | ui-monospace, SF Mono, Menlo, Consolas, monospace        |
| `--nb-text-xs` … `-3xl`               | 0.75rem, 0.875rem, 1rem, 1.125rem, 1.5rem, 2rem, 2.75rem |
| `--nb-leading-tight` / `--nb-leading` | 1.1 / 1.55                                               |
| `--nb-weight-normal` … `-bold`        | 400, 500, 600, 700                                       |

Module titles, completion headings, big numbers and the lesson intro use `--nb-font-display`. Nibblearn does not ship font files. Self-host the display face (recommended: no third-party requests, GDPR-friendly):

```bash
npm i @fontsource-variable/bricolage-grotesque @fontsource-variable/inter
```

```ts
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/inter";
```

Both the static (`"Bricolage Grotesque"`) and variable (`"Bricolage Grotesque Variable"`) family names are in the default stack, so a hosted font service works too. Without it the stack falls back to Inter / the system sans.

### Spacing and layout

| Variable                         | Default                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--nb-space-1` … `--nb-space-12` | 0.25rem, 0.5rem, 0.75rem, 1rem, 1.25rem, 1.5rem, 2rem, 2.5rem, 3rem (keys 1, 2, 3, 4, 5, 6, 8, 10, 12) |
| `--nb-max-width`                 | 44rem                                                                                                  |
| `--nb-touch-target`              | 44px                                                                                                   |

### Radii

| Variable           | Default                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `--nb-radius-sm`   | 8px                                                                                      |
| `--nb-radius-md`   | 12px                                                                                     |
| `--nb-radius-lg`   | 18px                                                                                     |
| `--nb-radius-xl`   | 26px                                                                                     |
| `--nb-radius-full` | 999px                                                                                    |
| `--nb-btn-radius`  | `var(--nb-radius-full)` — pill buttons; set to `var(--nb-radius-md)` for squarer buttons |

### Motion

| Variable             | Default                           |
| -------------------- | --------------------------------- |
| `--nb-duration-fast` | 120ms                             |
| `--nb-duration`      | 200ms                             |
| `--nb-duration-slow` | 360ms                             |
| `--nb-ease`          | cubic-bezier(0.2, 0.8, 0.2, 1)    |
| `--nb-ease-out`      | cubic-bezier(0.16, 1, 0.3, 1)     |
| `--nb-ease-bounce`   | cubic-bezier(0.34, 1.56, 0.64, 1) |

### Surfaces and text

| Token                | Light   | Dark    |
| -------------------- | ------- | ------- |
| `--nb-bg`            | #ffffff | #0c0c0f |
| `--nb-surface`       | #ffffff | #131316 |
| `--nb-surface-2`     | #f7f7f8 | #1a1a1f |
| `--nb-surface-3`     | #efeff1 | #232329 |
| `--nb-fg`            | #18181b | #f4f4f5 |
| `--nb-fg-muted`      | #52525b | #a1a1aa |
| `--nb-fg-subtle`     | #5f5f69 | #8e8e98 |
| `--nb-border`        | #e7e7ea | #27272e |
| `--nb-border-strong` | #d4d4d8 | #3a3a42 |

### Accent

| Token                 | Light               | Dark                  |
| --------------------- | ------------------- | --------------------- |
| `--nb-accent`         | #3b5bdb             | #91a7ff               |
| `--nb-accent-hover`   | #364fc7             | #a5b4fc               |
| `--nb-accent-active`  | #2f44ad             | #7b93f5               |
| `--nb-accent-fg`      | #ffffff             | #0c0c0f               |
| `--nb-accent-soft`    | #eef1fd             | rgba(145,167,255,.14) |
| `--nb-accent-soft-fg` | #2f44ad             | #c5d0ff               |
| `--nb-accent-ring`    | rgba(59,91,219,.28) | rgba(145,167,255,.45) |

### Highlights and chart colours

Used for celebrations, points and charts — never as the only carrier of meaning.

| Token                              | Light                              | Dark                                     |
| ---------------------------------- | ---------------------------------- | ---------------------------------------- |
| `--nb-highlight` / `-fg` / `-soft` | #f59e0b / #3b2300 / #fff8e6        | #fbbf24 / #2a1700 / rgba(251,191,36,.12) |
| `--nb-pink`                        | #e64980                            | #f472b6                                  |
| `--nb-violet`                      | #7c6cf0                            | #a594ff                                  |
| `--nb-sky`                         | #0ea5e9                            | #38bdf8                                  |
| `--nb-glow`                        | soft accent glow for primary hover | same, dark                               |

`--nb-lime*` remain as deprecated aliases of `--nb-highlight*`.

### Feedback colours

All text pairs meet 4.5:1.

| Tokens                                                    | Light                                           | Dark                                                                        |
| --------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `--nb-success` / `-fg` / `-soft` / `-soft-fg` / `-border` | #15803d / #ffffff / #ecfdf3 / #14532d / #86efac | #4ade80 / #052e14 / rgba(74,222,128,.13) / #a7f3c4 / rgba(74,222,128,.45)   |
| `--nb-danger` / `-fg` / `-soft` / `-soft-fg` / `-border`  | #d4183d / #ffffff / #fff1f3 / #9f1239 / #fda4b4 | #fb7185 / #2b0510 / rgba(251,113,133,.14) / #fecdd6 / rgba(251,113,133,.45) |
| `--nb-warning` / `-fg` / `-soft` / `-soft-fg` / `-border` | #c2410c / #ffffff / #fff7ed / #9a3412 / #fdba74 | #fbbf24 / #2a1700 / rgba(251,191,36,.13) / #fde68a / rgba(251,191,36,.45)   |
| `--nb-info` / `-soft` / `-soft-fg` / `-border`            | #0284c7 / #effaff / #075985 / #7dd3fc           | #38bdf8 / rgba(56,189,248,.13) / #bae6fd / rgba(56,189,248,.45)             |

### Focus and shadows

| Variable            | Light                        | Dark                     |
| ------------------- | ---------------------------- | ------------------------ |
| `--nb-focus`        | #3b5bdb                      | #c5d0ff                  |
| `--nb-shadow-xs`    | 0 1px 2px rgba(16,24,40,.06) | 0 1px 2px rgba(0,0,0,.4) |
| `--nb-shadow-sm`    | two-layer 1–3px              | two-layer 1–3px          |
| `--nb-shadow-md`    | 0 4px 12px -2px …            | 0 4px 12px -2px …        |
| `--nb-shadow-lg`    | 0 16px 40px -12px …          | 0 16px 40px -12px …      |
| `--nb-shadow-xl`    | 0 28px 64px -16px …          | 0 28px 64px -16px …      |
| `--nb-shadow-press` | 0 2px 0 0 rgba(16,24,40,.08) | 0 2px 0 0 rgba(0,0,0,.5) |

Focus rings use `outline: 2px solid var(--nb-focus)` with a 2px offset on `:focus-visible`.

## Example: a complete brand theme

```css
/* brand.css — import after @nibblearn/react/styles.css */
.nb-root {
  --nb-font: "Manrope", system-ui, sans-serif;
  --nb-radius-sm: 4px;
  --nb-radius-md: 6px;
  --nb-radius-lg: 10px;
  --nb-radius-xl: 14px;

  --nb-accent: #0f766e;
  --nb-accent-hover: #115e59;
  --nb-accent-active: #134e4a;
  --nb-accent-fg: #ffffff;
  --nb-accent-soft: #ccfbf1;
  --nb-accent-soft-fg: #134e4a;
  --nb-accent-ring: rgba(15, 118, 110, 0.35);
  --nb-focus: #0f766e;

  --nb-surface-2: #f4f7f6;
  --nb-surface-3: #e8eeec;
  --nb-border: #d9e2df;
}

.nb-root[data-nb-theme="dark"],
:where(.dark, [data-theme="dark"]) .nb-root:not([data-nb-theme="light"]) {
  --nb-accent: #2dd4bf;
  --nb-accent-hover: #5eead4;
  --nb-accent-active: #14b8a6;
  --nb-accent-fg: #042f2e;
  --nb-accent-soft: rgba(45, 212, 191, 0.16);
  --nb-accent-soft-fg: #99f6e4;
  --nb-accent-ring: rgba(45, 212, 191, 0.45);
  --nb-focus: #5eead4;
}
```

If your toggle uses `theme="system"` (the default), add a matching block under `@media (prefers-color-scheme: dark) { .nb-root[data-nb-theme="system"] { … } }` so the system path picks up the dark brand too.

## Reduced motion

- When the OS reports `prefers-reduced-motion: reduce`, the three duration tokens become `0ms` and components skip entrance/exit animations (checked with `useReducedMotion()`).
- `NibblearnProvider reducedMotion` forces the same behaviour and sets `data-nb-motion="reduced"` on the root, which you can target in your own CSS.
- Confetti and card-flip animations are replaced by instant state changes; nothing in the experience depends on animation.

## Layout notes

- `.nb-root` is a CSS container named `nb`; modules switch to wider layouts with `@container nb (min-width: 640px)`, so a module in a narrow sidebar renders its mobile layout even on a desktop viewport.
- `appearance.compact: true` tightens paddings for embedding in constrained spaces.
- `LessonPlayer framed={false}` removes the outer card so the player sits flush in your own container.
