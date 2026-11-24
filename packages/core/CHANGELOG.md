# @nibblearn/core

## 0.5.0

### Minor Changes

- Server-side grading: `gradeModule(config, response)` in `@nibblearn/core` scores a learner's answers without a browser for 15 activity types, every scored activity reports `ModuleResult.response`, and `@nibblearn/core/global` is the core as one dependency-free script for engines embedded in other servers. Editor: pick linked items by title, set coordinates on the image, `hideDescriptions`, list limits (`getModuleLimits`). Callout no longer renders the block title and instructions above the box and its accent recolours every variant; carousel slides can be dragged with the mouse; accordion panels have top spacing. New `scoring.revealAnswers` (`always`, `after-pass`, `never`) holds correct answers back until the learner passes. `version` is exported from core and the global script.

## 0.4.2

### Patch Changes

- `styles.isolated.css`: images can no longer be dragged out of a module. The `all: revert` rule added in 0.4.1 also discarded what the `draggable` attribute does in Chromium and Safari, so dragging a carousel slide by its image picked the image up instead.

## 0.4.1

### Patch Changes

- `styles.isolated.css`: properties Nibblearn does not set itself now fall back to browser defaults inside a block instead of taking the host page's value, so page rules on links, images, `code`, paragraphs and headings no longer show through. Wider base reset in both stylesheets.

## 0.4.0

### Minor Changes

- Embedding in pages with their own typography: new `styles.isolated.css` in `@nibblearn/react` and `@nibblearn/embed` (the same rules with higher specificity, so article styles of the host page no longer override them), and a wider base reset (inherited typography, tables, definition lists, images). Editor: `ModuleForm` gains `hideFields` and `hideIds`; content blocks no longer show Feedback and Scoring settings (`unusedFields` in a module definition).

## 0.3.0

### Minor Changes

- Choice challenge: `behavior.evaluation: "external"` for quizzes graded by the host (`onSubmit`, `details.responses`), and a read-only `review` view of a graded attempt. Flashcards: optional `explanation` on the back, `reviewedCards` / `masteredCards` in the result. `NibblearnProvider` gains `completion` to hide or replace the completion card. All additions are optional; existing lesson JSON keeps working unchanged.

- Story cards: optional per-card `video`, `mediaPosition`, `imageFit`, `align` and an `action` link button. New `videoSchema` / `linkHrefSchema` in core and a `SafeVideo` primitive in react. All additions are optional; existing lesson JSON keeps working unchanged.

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
