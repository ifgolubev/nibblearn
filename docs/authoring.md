# Build an authoring UI

`@nibblearn/editor` gives products a block editor for every built-in module, so you do not have to write 27 settings forms yourself. Everything it uses is also available on its own: field metadata in the JSON Schemas, starter content, and a preview mode for modules.

## The editor components

```tsx
import "@nibblearn/react/styles.css";
import "@nibblearn/editor/styles.css";
import { useState } from "react";
import { LessonEditor } from "@nibblearn/editor";

export function CourseEditor({ initial }: { initial: Record<string, unknown> }) {
  const [lesson, setLesson] = useState(initial);
  return <LessonEditor value={lesson} onChange={setLesson} onPickImage={openMediaLibrary} />;
}
```

| Component      | What it does                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `ModuleForm`   | The settings form of one block, generated from its schema. Fully controlled (`value` / `onChange`). |
| `ModuleEditor` | `ModuleForm` plus a live preview. The preview shows the list item you are editing.                  |
| `BlockPicker`  | Searchable catalogue of block types; creates a block with example content or blank placeholders.    |
| `LessonEditor` | Block list (reorder, duplicate, delete, add), the selected block's editor, and lesson settings.     |

- Validation runs on every change. Problems appear under the affected field and in a summary whose entries move focus to the field.
- While a block is invalid, the preview keeps showing the last valid version.
- `onPickImage` adds a "Choose image" button to image fields; return `{ src, alt }` from your media library (an `asset:<key>` value works too, see [Embedding](./embedding.md#images-from-private-storage)).
- Custom modules registered in your `ModuleRegistry` get a form too, from their Zod schema.
- Content blocks (callout, accordion, tabs, carousel, columns) show no Feedback or Scoring settings: they are read, not answered. For your own module, list such fields in `unusedFields` of its definition.
- `hideIds` leaves out every ID field when your application assigns ids itself; new list items still get generated ids. `hideFields` leaves out any other field by path, with `*` for one key or list index:

```tsx
<ModuleForm
  value={block}
  onChange={setBlock}
  hideIds
  hideFields={["appearance", "behavior.completeOn", "content.items.*.image"]}
/>
```

Hidden fields keep the values they already have. A validation problem in a hidden field still appears in the summary above the form.

- `hideDescriptions` leaves out the help text under fields. Labels, "optional" marks and validation messages stay.
- An id that points at another item of the block (a sort item's category, the next node of a scenario, the stage a step depends on) is chosen from a list of those items by title, so it works with `hideIds` too. An id that matches nothing stays selected and is marked "not found".
- Coordinates on an image (hotspots, diagram targets, walkthrough targets, regions of spot the mistake, annotations of before / after) can be set on the image itself: click to place a point, drag to draw an area, or move it with the arrow keys (Shift for bigger steps). The number fields remain for exact values.
- A list shows how full it is ("3 of 8") and its Add button is disabled at the limit. To enforce the same limits outside the form, read them with `getModuleLimits(type)`:

```ts
import { getModuleLimits } from "@nibblearn/core";

getModuleLimits("choice-challenge")?.["content.questions"]; // { min: 1, max: 50 }
getModuleLimits("choice-challenge")?.["content.questions.*.options"]; // per question
```

- Labels can be overridden through `NibblearnProvider messages`: editor strings use `editor.*` keys (`editorMessages` lists them all), field labels use `field.<type>.<path>`, e.g. `field.flashcards.content.cards.front`.

## Field metadata for your own forms

If you build forms with another stack, read the same metadata the editor uses. Every property of `getModuleJsonSchema(type)` has a `title`, usually a `description`, and an `x-ui` hint:

```json
"front": {
  "type": "string",
  "maxLength": 4000,
  "title": "Front",
  "description": "Term or question on the front of the card.",
  "x-ui": { "widget": "richtext" }
}
```

`x-ui.widget` is one of `text`, `textarea`, `richtext`, `richtext-block` (paragraphs and lists), `image`, `color`, `select`, `slider`, `number`, `switch`, `icon`, `id` and `hidden`. An id that refers to another item of the block carries `ref`, the names of the lists that item may be in (`["categories"]`, `["regions", "rows", "targets"]`). Lists carry `itemName` ("card") and `itemLabel` (the property that names an item), and top-level groups carry `group` (`content`, `behavior`, `feedback`, `appearance`, `advanced`). The module schema itself has `x-icon`, a Lucide icon name; `ModuleIcon` renders it in React.

## Starter content

```ts
import { createEmpty, createExample } from "@nibblearn/core/examples";

const blank = createEmpty("flashcards", { id: "deck-1" }); // smallest valid config
const sample = createExample("flashcards"); // realistic example content
```

Both return fresh copies that pass `validateModule()`. `moduleExamples` holds all examples keyed by type. This entry point is separate from `@nibblearn/core` so apps that only play lessons do not ship the example data.

## Preview mode

Render any module with `mode="preview"` to show it inside an editor:

```tsx
<ModuleRenderer config={draft} mode="preview" focus={{ path: ["content", "cards", 4] }} />
```

- No events, no `onComplete`, no state snapshots.
- `focus` brings that part of the config into view: the fifth card, the third question, an accordion panel, a tab. Step-based modules support it; the others ignore it.
- Editing text keeps the module where it is. Adding, removing or relinking items starts the module over, so it never points at an item that no longer exists.

If a module jumps back to the start on every keystroke in your own editor, check that you are not changing its `key` or `resetKey` with the content: both remount or reset the module on purpose.

## Searching and summarising content

`moduleToText(config)` and `lessonToText(lesson)` turn blocks into plain text (or Markdown with `format: "markdown"`) for search indexes, previews in lists, or an AI assistant that answers questions about a lesson. Answers and explanations are left out unless you pass `includeAnswers` / `includeFeedback`.
