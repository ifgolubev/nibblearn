# @nibblearn/core

**Tiny interactions. Real learning.** — the engine behind Nibblearn.

Framework-agnostic schemas, validation, evaluation logic, progress utilities and UI messages for [Nibblearn](https://github.com/ifgolubev/nibblearn) interactive learning content. Use it on the server or in tooling to validate and score lesson JSON without React.

```ts
import { validateLesson, formatIssues } from "@nibblearn/core";

const result = validateLesson(json);
if (!result.success) console.error(formatIssues(result.issues));
```

Includes Zod schemas for all 22 module types and the lesson schema, `defineLesson` / `validateLesson` / `validateModule`, a safe formula parser for the What-If simulator, scenario and conversation engines, scoring helpers, SSR-safe localStorage progress storage, and the English message catalogue (extend or translate it via `messages`). MIT licensed.
