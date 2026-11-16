# @nibblearn/editor

Authoring UI for [Nibblearn](https://github.com/ifgolubev/nibblearn): forms for every built-in module, generated from the module schemas, with a live preview that follows the item you are editing, a block picker and a lesson editor.

```bash
npm install @nibblearn/editor @nibblearn/react @nibblearn/core
```

```tsx
import "@nibblearn/react/styles.css";
import "@nibblearn/editor/styles.css";
import { useState } from "react";
import { ModuleEditor } from "@nibblearn/editor";
import { createExample } from "@nibblearn/core/examples";

export function EditBlock() {
  const [block, setBlock] = useState<Record<string, unknown>>(createExample("flashcards"));
  return <ModuleEditor value={block} onChange={setBlock} />;
}
```

- `ModuleForm`: the form alone, fully controlled.
- `ModuleEditor`: form plus live preview (`mode="preview"` with `focus`).
- `BlockPicker`: a searchable catalogue that creates example or blank blocks.
- `LessonEditor`: the list of blocks, each block's editor and the lesson settings.

Field labels, help texts and widgets come from the `x-ui` metadata in `getModuleJsonSchema()`. Override any label with `NibblearnProvider messages`, using keys like `field.flashcards.content.cards.front`. See the [authoring guide](https://github.com/ifgolubev/nibblearn/blob/main/docs/authoring.md).

MIT licensed.
