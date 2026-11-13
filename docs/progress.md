# Save learner progress

`LessonPlayer` records which module the learner is on and the result of every completed module. By default this lives in the browser's `localStorage`; nothing is sent anywhere. Swap in your own adapter to persist to a server.

## Default: localStorage

```tsx
<LessonPlayer lesson={lesson} />
```

With no `storage` prop the player calls `createLocalStorage()` from `@nibblearn/core`:

- Key: `nibblearn:progress:<lessonId>`.
- SSR-safe: every call probes `window.localStorage`; when it is missing (server render), throws (private mode, quota, disabled storage) or fails a write, the adapter silently falls back to an in-memory map. The player never throws because of storage.
- Entries written by a different `lessonId` or a different `version` are ignored.

Customise the key prefix or back it with `sessionStorage`:

```tsx
import { createLocalStorage } from "@nibblearn/core";

const storage = createLocalStorage({ prefix: "acme:lesson:", storage: window.sessionStorage });

<LessonPlayer lesson={lesson} storage={storage} />;
```

Create the adapter once (module scope or `useMemo`) so the player does not re-initialise on every render.

## Disable persistence

```tsx
<LessonPlayer lesson={lesson} storage={false} />
```

Progress is kept in component state only. Useful for demos, previews and the playground. `noopStorage` (never saves, always loads `null`) and `createMemoryStorage()` (keeps progress for the page lifetime, with a `dump()` helper for tests) are also exported.

## `LessonProgress`

```ts
interface LessonProgress {
  version: 1;
  lessonId: string;
  /** Index of the current module, or -1 on the intro screen. */
  currentIndex: number;
  /** Keyed by module id. */
  results: Record<string, ModuleResult>;
  startedAt: string; // ISO
  updatedAt: string; // ISO
  completedAt?: string; // ISO, set when the lesson is finished
}
```

`ModuleResult` is described in [Events](./events.md). Everything is JSON-serialisable; the `details` field of each result is module-specific but always plain data.

The player saves on every change: start, navigation, module completion, finish, review. Each save receives the whole object, so an adapter can simply overwrite.

## Custom adapter

Implement the three-method `ProgressStorage` interface. Methods may be sync or async.

```ts
import type { ProgressStorage, LessonProgress } from "@nibblearn/core";

export function createApiStorage(baseUrl: string, userId: string): ProgressStorage {
  const url = (lessonId: string) => `${baseUrl}/users/${userId}/progress/${lessonId}`;

  return {
    async load(lessonId) {
      const res = await fetch(url(lessonId), { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) return null; // treat errors as "no saved progress"
      const data = (await res.json()) as LessonProgress;
      return data.version === 1 && data.lessonId === lessonId ? data : null;
    },

    async save(progress) {
      await fetch(url(progress.lessonId), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(progress),
      });
    },

    async clear(lessonId) {
      await fetch(url(lessonId), { method: "DELETE", credentials: "include" });
    },
  };
}
```

```tsx
const storage = useMemo(() => createApiStorage("/api", user.id), [user.id]);

<LessonPlayer lesson={lesson} storage={storage} />;
```

Notes:

- `load` is awaited once per `lesson.id` on mount. The player shows an empty, `aria-busy` container until it resolves, so return quickly or resolve from a cache first. If `load` throws or rejects, the player treats it as "nothing saved" and starts normally — a broken adapter never blocks the lesson.
- `save` is fire-and-forget (`void storage.save(p)`); failures are not surfaced. Debounce or queue writes inside the adapter if you expect rapid navigation.
- `clear` is called by "Retry lesson" and "Start over".
- To combine local and remote (offline-first), wrap `createLocalStorage()` and write through to the API in `save`.

## Resume behaviour

On mount the player loads progress for `lesson.id` and decides:

| Saved state                                                       | Behaviour                                                                                                                                                                                                |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing saved                                                     | Intro screen (or first module when `autoStart` or `intro.show: false`).                                                                                                                                  |
| In progress (`currentIndex >= 0` or any result, no `completedAt`) | Intro shows "Resume where you left off · Activity N of M · Completed: K" with **Continue** and **Start over**. With `autoStart` or `intro.show: false` it resumes immediately and emits `lesson:resume`. |
| Completed (`completedAt` set)                                     | Opens on the summary with the saved score; the learner can review modules or retry.                                                                                                                      |

Resuming restores completed modules' results, so the summary and points are correct, but a resumed module itself starts fresh (module-internal state such as which flashcard was showing is not persisted).

## Clearing progress

- From the UI: "Retry lesson" (summary) or "Start over" (intro).
- Programmatically: `storage.clear(lessonId)`, e.g. in a "reset my training" button. Remount the player afterwards (change its `key`) so it reloads.

```tsx
const storage = useMemo(() => createLocalStorage(), []);
const [key, setKey] = useState(0);

<button onClick={async () => { await storage.clear(lesson.id); setKey((k) => k + 1); }}>Reset</button>
<LessonPlayer key={key} lesson={lesson} storage={storage} />;
```

## Privacy

Nibblearn collects nothing. The default adapter writes only to the learner's own browser, there is no telemetry, no network calls, and no analytics unless you wire an `onEvent` handler yourself ([Events](./events.md)). If you build a server-side adapter, the data you store is exactly the `LessonProgress` object above: module ids, scores, attempts, durations and timestamps. There is no free text from the learner except what your own custom modules might add to `details`.
