# @nibblearn/core

## 0.2.0

### Minor Changes

- Authoring, embedding and content blocks.
  
  New packages:
  
  - `@nibblearn/editor`: `ModuleForm`, `ModuleEditor`, `BlockPicker` and `LessonEditor`, generated from the module schemas.
  - `@nibblearn/embed`: `hydrate()`, the `<nibblearn-module>` custom element and a standalone script with React included.
  
  New in `@nibblearn/core`:
  
  - Optional `schemaVersion` on every module, `migrateModule()` and `migrateLesson()`.
  - JSON Schemas for every module and the lesson (`getModuleJsonSchema()`, `@nibblearn/core/schemas/*.json`) with field titles, descriptions and `x-ui` hints.
  - `@nibblearn/core/examples`: `createExample()`, `createEmpty()`, `moduleExamples`. Module definitions have an `icon`.
  - `moduleToText()`, `lessonToText()` for search, previews and AI.
  - Typed event payloads (`isEventOfType`, `validateEventPayload`); xAPI and cmi5 statements (`eventToXapiStatements`, `createXapiAdapter`).
  - `asset:<key>` image references; links (`[label](https://…)`) and lists in text.
  - Five content blocks: `callout`, `accordion`, `tabs`, `carousel`, `columns` (new category `present`).
  
  New in `@nibblearn/react`:
  
  - `initialState` / `onStateChange` on every module; `LessonPlayer` stores module sessions in `LessonProgress.moduleStates`.
  - `mode="preview"` and `focus` for editors.
  - `resolveAsset` on `NibblearnProvider`; `wrapper={false}`.
  - `ModuleIcon`; components for the five content blocks.
  
  Behaviour changes:
  
  - `NibblearnProvider` and modules rendered without a provider default to the `light` theme (was `system`). `LessonPlayer` still follows the lesson's `theme.mode`.
  - The provider's wrapper element no longer applies Nibblearn's base styles and reset to your content (it carries design tokens only).
  - Provider `accent`, `radius` and `fontFamily` now reach every module (they were overridden by each module's default tokens), and the lesson player root follows the theme mode.
  - Accent hover, active, soft and ring shades are derived from `--nb-accent`; the text colour on custom accents is chosen for contrast.
  - Lines starting with `- ` or `1. ` in paragraph text now render as lists, and `[label](https://…)` renders as a link.
  - `module:answer` and `module:interact` events carry canonical keys (`itemId` / `itemIndex`, `response`, `correct`, `action`); `module:complete` carries `durationMs`.
  - `@nibblearn/react` type declarations now import from `@nibblearn/core` instead of embedding a copy, so classes such as `SchemaRegistry` are compatible across the two packages.
  - The lesson intro no longer overflows 320px-wide screens when the title contains a long word.
  - Module and player roots carry `data-nb-theme` only when a provider sets `theme`, so a `.dark` ancestor switches default modules to dark again.
  - `LessonPlayer` keeps the surrounding provider's `resolveAsset`, `messages`, accent, radius and font (the lesson's own theme values win).
  - Links in text that is itself a control (answer options, flip cards, draggable items, buttons) render as their label only.
  - Carousel arrows use `aria-disabled` at the first and last slide, so they keep keyboard focus.
  - `lesson:complete` carries `durationMs`. With `cmi5`, only lesson statements carry the cmi5 and moveon categories; `passed` / `failed` carry `masteryscore`; `cmi5.activityId` sets the AU object id.
  - Text export without `includeAnswers` no longer reveals match-pairs pairs, the sequence order or label positions.
  - Custom-accent text on soft accent backgrounds is computed for contrast (`accentTextColors`).
