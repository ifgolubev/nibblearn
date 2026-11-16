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

`x-ui.widget` is one of `text`, `textarea`, `richtext`, `richtext-block` (paragraphs and lists), `image`, `color`, `select`, `slider`, `number`, `switch`, `icon`, `id` and `hidden`. Lists carry `itemName` ("card") and `itemLabel` (the property that names an item), and top-level groups carry `group` (`content`, `behavior`, `feedback`, `appearance`, `advanced`). The module schema itself has `x-icon`, a Lucide icon name; `ModuleIcon` renders it in React.

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
