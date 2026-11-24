# Embed a standalone lesson page in another application

Two ways to put a Nibblearn lesson into a product that is not your React app:

1. **Render `LessonPlayer` directly** when the host is a React app (preferred: no iframe, shared theme, direct callbacks).
2. **Embed a standalone lesson page in an `<iframe>`** when the host is a different stack, a CMS, an LMS, or a page you do not control. Events cross the frame boundary with `postMessage`.

## 1. Direct rendering (React hosts)

```tsx
import "@nibblearn/react/styles.css";
import { LessonPlayer } from "@nibblearn/react";

export function TrainingPanel({ lesson, onDone }) {
  return (
    <LessonPlayer
      lesson={lesson}
      framed={false}
      header={<button onClick={onDone}>Close</button>}
      onComplete={(c) => onDone(c)}
    />
  );
}
```

Use `framed={false}` inside your own card or modal, `header` for a close button, and `theme` or the `.dark` ancestor convention to match the host theme ([Theming](./theming.md)).

### Images from private storage

When lesson files live in a private bucket, store a file key in the content and resolve it to a (temporary) URL at render time:

```json
{ "image": { "src": "asset:courses/42/funnel.png", "alt": "Marketing funnel" } }
```

```tsx
import { NibblearnProvider } from "@nibblearn/react";

<NibblearnProvider
  resolveAsset={async (src, { reason }) => {
    if (!src.startsWith("asset:")) return undefined; // keep ordinary URLs
    const res = await fetch(`/api/files/sign?key=${encodeURIComponent(src.slice(6))}`);
    return res.ok ? (await res.json()).url : null;
  }}
>
  <LessonPlayer lesson={lesson} />
</NibblearnProvider>;
```

- The resolver runs for every image inside the provider. Return `null` or `undefined` to keep the original value.
- `asset:` images show a placeholder until resolved. Results are cached per provider, and one key is only requested once at a time.
- An inline resolver function is fine: a new function on every render keeps the cache. To drop the cache (for example, after switching to another storage backend), remount the provider with a new `key`.
- When an image fails to load (for example, an expired signed link), the resolver is called once more with `reason: "retry"`. A second failure shows the "Image unavailable" placeholder.
- Returned URLs are checked like content URLs: only `http(s)`, relative, `blob:` and `data:image/*` are used.
- `asset:` keys may contain letters, digits and `. _ ~ / % : @ + = -` (up to 512 characters).

### Save and restore a single module

When modules sit inside your own pages (not in `LessonPlayer`), save each module's session and pass it back on the next visit, so a returning learner sees a finished quiz as finished and an unfinished one where they left it:

```tsx
import { ModuleRenderer } from "@nibblearn/react";
import type { ModuleState } from "@nibblearn/core";

function Block({ config, saved }: { config: { id: string; type: string }; saved?: ModuleState }) {
  return (
    <ModuleRenderer
      config={config}
      initialState={saved}
      onStateChange={(state) => api.saveBlockState(config.id, state)} // debounce if you like
    />
  );
}
```

- `onStateChange` receives a JSON-serialisable `ModuleState` after every meaningful change (an answer, a move, a completed module). Identical snapshots are not sent twice.
- `initialState` is read once, on mount. It is ignored when it belongs to another module, or when the module's structure changed since it was saved: items added, removed or reordered, ids or links changed, or answers changed (the state carries `configHash`, a structural fingerprint). Editing wording and updating Nibblearn keep saved sessions.
- A restored completed module shows its result and does not call `onComplete` again or emit `module:start`.
- Saved state is treated as untrusted input: every restored value is checked, and anything unexpected falls back to the start.
- `LessonPlayer` does this for you: module sessions are stored in `LessonProgress.moduleStates` through your `storage` adapter.

What is restored: every built-in module restores its progress and its result. A few transient moments start over instead: an unanswered question in image-compare, the guess you were still adjusting in estimate, the short pause after an answer in true-false when explanations are off, and conversations driven by a custom `provider` (only the built-in scripted provider can be replayed).

### Quizzes graded by your server

When your backend is the only grader, keep the correct answers out of the page. Set `behavior.evaluation: "external"` on a `choice-challenge`: the config needs no `correct` flags, nothing is checked in the browser, the learner can move back and forth between questions, and the answers are handed over once.

```tsx
import { ChoiceChallenge, NibblearnProvider, defineModule } from "@nibblearn/react";

const quiz = defineModule({
  id: "quiz-42",
  type: "choice-challenge",
  title: "Metric check",
  content: {
    questions: [
      {
        prompt: "ROAS compares revenue to…",
        mode: "single", // set it: it cannot be inferred without correct options
        options: [
          { id: "spend", text: "Ad spend" },
          { id: "clicks", text: "Clicks" },
        ],
      },
    ],
  },
  behavior: { evaluation: "external" },
});

<NibblearnProvider completion="hidden">
  <ChoiceChallenge config={quiz} onSubmit={(responses) => api.submitAttempt(responses)} />
</NibblearnProvider>;
```

- `onSubmit(responses)` is called once with a `string[][]`: the selected option ids of every question, in config order (`[]` is impossible for a submitted question; the learner must pick something). Give options your own `id`s; without them ids are `q<question>-opt<option>`. The same data arrives in `onComplete` as `details.responses`, with no `score`.
- Each answer is also emitted as `module:answer` with `response` (the selected ids) and no `correct`.
- Single choice, multiple choice and true/false are all questions of this one module; set `mode` on every question.
- To show a graded attempt, pass `review`. The module then renders every question read-only, with the learner's choice, the correct options and explanations from your data, and emits nothing:

```tsx
<ChoiceChallenge
  config={quiz}
  review={{
    items: [
      {
        selected: ["clicks"],
        correct: ["spend"], // omit to show only what was chosen
        isCorrect: false, // optional; derived from selected/correct when omitted
        explanation: "ROAS is revenue divided by ad spend.",
        optionExplanations: { clicks: "Clicks feed CTR and CPC." },
      },
    ],
  }}
/>
```

`review` also works with an ordinary (locally checked) config; missing `correct` and explanations then come from the config. In a locally checked quiz, `onComplete` reports `details.responses` and `details.records[].selected` as well.

### Your own completion screen

Every module ends with a built-in completion card. `NibblearnProvider` can hide or replace it for all modules inside (an outer provider's setting is inherited):

```tsx
<NibblearnProvider completion="hidden">…</NibblearnProvider>;

const Result = (info: CompletionInfo) => <MyResult passed={info.passed} onRetry={info.onRetry} />;
<NibblearnProvider completion={Result}>…</NibblearnProvider>;
```

`CompletionInfo` carries `title`, `text`, `score` (0–1 when scored), `passed`, `stats` and `onRetry`. With `"hidden"`, act on `onComplete` and render your own result. Pass a stable function, not an inline arrow. In `@nibblearn/embed`, set it through `hydrate(root, { provider: { completion: "hidden" } })`.

Flashcards report which cards were seen: `details.reviewedCards` and `details.masteredCards` hold card ids (`card-<index>` for cards without an `id`).

### Blocks inside HTML (no React on the page)

When lesson text is stored as HTML with blocks inside it, mark each block and let `@nibblearn/embed` bring them to life. Keep a text fallback inside the element for search engines and readers without JavaScript; `moduleToText()` produces one on the server:

```ts
import { moduleToText } from "@nibblearn/core";

const html = `<nibblearn-module>
  <p>${escapeHtml(moduleToText(block))}</p>
  <script type="application/json">${JSON.stringify(block).replace(/</g, "\\u003c")}</script>
</nibblearn-module>`;
```

```ts
import "@nibblearn/embed/styles.css";
import { hydrate } from "@nibblearn/embed";

const { unmount } = hydrate(document.querySelector("article")!, {
  provider: { theme: "light", resolveAsset },
  getInitialState: (moduleId) => savedStates[moduleId],
  onStateChange: (state) => saveBlockState(state),
});
```

- `hydrate(root)` mounts every `<nibblearn-module>` and `[data-nibblearn-module]` under `root` and skips elements it already mounted. The config comes from a child `<script type="application/json">` or a `config` attribute; there is no loading by URL.
- `defineNibblearnElement()` registers `<nibblearn-module>` as a custom element instead (the standalone script does this for you). It accepts a `config` property, re-renders when it changes, and unmounts when the element is removed.
- Both dispatch `nibblearn:event`, `nibblearn:complete` and `nibblearn:statechange` DOM events from the element.
- Invalid JSON, a missing config or an unknown type show an inline error instead of throwing.
- Escape `<` as `\u003c` when you write JSON into a `<script>` element, so content cannot close the script tag.

### When the page's own styles get in the way

Article and rich-text styles (`.prose p`, `.content h3`, `.article ul li`, a global `button` rule) are written for plain HTML and also match the elements inside a block. With the regular stylesheet they win over Nibblearn's rules: headings change font, lists get bullets back, buttons pick up borders. Load the isolated stylesheet instead; no Shadow DOM is needed:

```ts
import "@nibblearn/embed/styles.isolated.css"; // or "@nibblearn/react/styles.isolated.css"
```

It holds the same rules as `styles.css`, each raised by one id of specificity (`:not(#\#)`), so page rules written with element, class and attribute selectors no longer override them, whichever stylesheet is loaded first. Properties Nibblearn does not set itself (a page's `img { object-fit: contain }`, `a { font-weight: 700 }`, `p { hyphens: auto }`) fall back to the browser default instead of the page's value. Use one of the two files, not both.

- Theming is unchanged: tokens set on `.nb-root` or through `NibblearnProvider` work as before (token definitions keep their normal specificity).
- To restyle a `.nb-*` class yourself, match the specificity: `.nb-btn:not(#\#) { … }`.
- What still gets through: page rules with `!important` and rules that use an id selector (`#content p`). Scope those to your own content, or exclude blocks with `:not(.nb-root *)`.
- The block's root element (`.nb-root`) stays yours to size and place. Inside it, elements with a class of your own (a custom module, a completion screen you render) keep your styles; your elements without a class get browser defaults, like the library's.

### Any activity graded by your server

`onComplete` reports a `score`, but that number was computed in the learner's browser. When a result has to be trusted (a certificate, a dashboard, a gate before the next step), send the learner's answers to your server and compute the score there.

Every scored activity reports what the learner submitted as `result.response`: the answers in order, without verdicts. `gradeModule()` from `@nibblearn/core` scores such a response against the config with the same rules the component uses, and needs no browser:

```tsx
// Browser: send the answers, not the score.
<SequenceBuilder
  config={config}
  onComplete={(result) => api.submitAttempt(config.id, result.response)}
/>
```

```ts
// Server: the config comes from your own storage, never from the request.
import { gradeModule } from "@nibblearn/core";

const graded = gradeModule(storedConfig, request.body.response);
if (!graded.success) return reply.code(400).send(graded.issues); // graded.reason says why
const { score, correct, total, passed, complete, items } = graded.grade;
```

- `score` is 0–1 and counts retries the way the component does, so for an untampered response it equals `result.score`. `passed` compares it with `scoring.passThreshold`; `complete` is false when part of the activity was left unanswered (those parts score 0). `items` holds the verdict, the learner's answer and the expected answer per question, blank or message; decide yourself how much of it to send back.
- While `complete` is false the `score` is 0, whatever the answers so far would be worth: an activity that was not finished has no result yet.
- `passed` compares the score with the module's pass threshold: `scoring.passThreshold`, or 0.7 when it is `0` or not set (the same rule as `modulePassThreshold()` and the lesson player). Set the threshold you gate on in the config.
- Nothing is thrown for bad input. `reason` is `"invalid-config"`, `"invalid-response"` (an answer does not fit the config: an unknown option, a step the scenario cannot reach, budget shares outside the limits) or `"not-gradable"`.
- Gradable types are listed in `gradableModuleTypes` (`isGradable(type)` checks one): choice challenge, true / false, match pairs, sequence builder, category sort, fill in the blanks, spot the mistake, estimation, word builder, label the diagram, inbox triage, priority matrix, branching scenario, conversation and budget allocator. For your own module type pass `graders: { "my-type": (config, answers) => … }`.
- A response is the list of `module:answer` payloads (`itemId`, `itemIndex`, `response`) in the order they happened. It is saved with the session, so it survives `initialState`. A session saved by a version before 0.5 has no such list; if it is restored halfway, the result carries no `response`.
- The correct answers are still in the config the browser receives, except for a `choice-challenge` with `evaluation: "external"` (above). Server grading makes the stored score independent of what the page claims; it does not hide the answers from someone who reads the page source.

**Servers that are not written in JavaScript.** `@nibblearn/core/global` is the whole core as one script with no dependencies (`dist/nibblearn-core.global.js`, zod included). It defines `NibblearnCore` and uses no DOM, no Node API, no `Intl` and no `eval`, so it runs in an embedded engine such as GraalJS on the JVM. Pass JSON strings in and out:

```js
// Evaluated once per engine context, after loading nibblearn-core.global.js.
function grade(configJson, responseJson) {
  return JSON.stringify(
    NibblearnCore.gradeModule(JSON.parse(configJson), JSON.parse(responseJson)),
  );
}
```

`NibblearnCore.validateModule`, `validateLesson`, `getModuleLimits` and the rest of the core API are available the same way. `NibblearnCore.version` (also `version` from `@nibblearn/core` and `@nibblearn/react`) is the package version; all `@nibblearn/*` packages are released with the same number, so a server can check that its script matches what the browser runs.

**Keeping the right answers back until the learner passes.** `scoring.revealAnswers` decides when an activity may show correct answers:

| Value        | Correct answers are shown                                                         |
| ------------ | --------------------------------------------------------------------------------- |
| `always`     | As soon as an answer is checked (the default).                                    |
| `after-pass` | Only once the activity is completed with a score that reaches the pass threshold. |
| `never`      | Not at all.                                                                       |

The learner always sees which of their own answers are wrong, and the explanation of an answer they got right. What is held back: missed options, the correct order or placement, the true value of an estimate, the expert's call in an inbox, the optimal budget split, mistakes that were not found, and explanations that give those away. Buttons that used to reveal the answer become "Finish without solving". Scores do not change. It applies to choice challenge, sequence builder, category sort, priority matrix, label the diagram, fill in the blanks, word builder, estimation, spot the mistake, inbox triage and budget allocator. A true / false statement has only two answers, so marking one wrong gives the other away.

This is a display rule: the answers are still part of the config in the page.

## 2. Build a standalone lesson page

The showcase ships an `/embed/:id` route that is exactly this: a page with no site chrome that renders one lesson and relays events to the parent window. Copy the pattern into your own app.

```tsx
// src/pages/Embed.tsx — React Router example
import { useParams } from "react-router";
import { LessonPlayer } from "@nibblearn/react";
import { getLesson } from "./lessons"; // your lookup: id -> lesson JSON

export function EmbedPage() {
  const { id = "" } = useParams();
  const lesson = getLesson(id);
  if (!lesson) return <div className="p-6 text-sm">Lesson not found.</div>;

  return (
    <div style={{ minHeight: "100vh", padding: 16 }}>
      <LessonPlayer
        lesson={lesson}
        onEvent={(event) => {
          // Never post to "*": send events only to the origin you expect to embed this page.
          if (window.parent !== window) {
            window.parent.postMessage({ source: "nibblearn", event }, HOST_ORIGIN);
          }
        }}
      />
    </div>
  );
}
```

```tsx
<Route path="/embed/:id" element={<EmbedPage />} />
```

Harden it for production:

- Set `HOST_ORIGIN` to the origin you expect (`const HOST_ORIGIN = "https://host.example.com"`), or derive it from `document.referrer` as the showcase does. Never use `"*"`: events contain learner answers and scores.
- Read optional query parameters (`?theme=dark&locale=en-GB`) and pass them as `theme` / `locale` props.
- Decide what the page does when loaded outside an iframe (the `window.parent !== window` guard above keeps it harmless).
- Progress is still saved in the iframe's own `localStorage` (partitioned per embedding site in modern browsers). Pass `storage={false}` or a server adapter if that is not what you want ([Progress](./progress.md)).

## 3. The iframe snippet

```html
<iframe
  src="https://learn.example.com/embed/metrics-101"
  title="Media metrics in 10 minutes"
  width="100%"
  height="720"
  style="border: 0; border-radius: 16px; max-width: 48rem"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  sandbox="allow-scripts allow-same-origin allow-forms"
  allow="fullscreen"
></iframe>
```

- `allow-scripts` is required. `allow-same-origin` is required for `localStorage` progress and for the page to use its own cookies; omit it only if you also disable storage. `allow-forms` matters for typed-input modules (fill-blanks, screenshot-walkthrough `type` steps). `allow-popups` is only needed if your lesson links out.
- Always set `title` for screen readers.
- `allow="fullscreen"` is optional; Nibblearn does not request other permissions (no camera, microphone or autoplay).

## 4. Listen to events in the host page

Messages have the shape `{ source: "nibblearn", event: NibblearnEvent }`. See [Events](./events.md) for event types.

```html
<script>
  window.addEventListener("message", (e) => {
    // 1. Trust only your lesson origin.
    if (e.origin !== "https://learn.example.com") return;
    // 2. Ignore unrelated messages from the same origin.
    if (!e.data || e.data.source !== "nibblearn") return;

    const { event } = e.data;
    if (event.type === "lesson:complete") {
      console.log("passed:", event.payload.passed, "score:", event.payload.score);
      // mark the course complete in your LMS, unlock the next step, etc.
    }
    if (event.type === "module:complete") {
      console.log(event.moduleId, event.payload.score);
    }
  });
</script>
```

Node/TypeScript hosts can import the `NibblearnEvent` type from `@nibblearn/core` for typing the message.

## 5. Sizing

A lesson's height changes as the learner moves between activities. Options, from simplest to best:

- **Fixed height with internal scroll**: set `height="720"`; the player scrolls inside the frame. Works everywhere.
- **Viewport-relative**: `style="height: min(90vh, 900px)"` for a near-full-screen feel.
- **Auto-resize**: post the document height from the embed page and set the iframe height in the host.

```ts
// in the embed page
const ro = new ResizeObserver(() => {
  window.parent.postMessage(
    {
      source: "nibblearn",
      event: { type: "embed:resize", height: document.documentElement.scrollHeight },
    },
    "https://host.example.com",
  );
});
ro.observe(document.body);
```

```js
// in the host
if (e.data.event?.type === "embed:resize") iframe.style.height = e.data.event.height + "px";
```

(`embed:resize` is your own message, not a Nibblearn event type; keep the `source` check.)

Keep the frame at least 320px wide; modules are built mobile-first and switch to wider layouts at 640px of container width.

## 6. Theme and locale across the boundary

The iframe cannot see the host's `.dark` class. Pass the mode explicitly in the URL and map it to the `theme` prop, or default to `"system"` so the learner's OS preference applies. Do the same for `locale`.

```tsx
const params = new URLSearchParams(location.search);
<LessonPlayer
  lesson={lesson}
  theme={params.get("theme") ?? "system"}
  locale={params.get("locale") ?? undefined}
/>;
```

## Checklist

- [ ] Embed page has no site navigation and sets a document `<title>`.
- [ ] `postMessage` target origin and `message` listener origin are both pinned.
- [ ] `sandbox` includes `allow-scripts allow-same-origin`.
- [ ] Decide where progress lives (iframe localStorage, server adapter, or none).
- [ ] Height strategy chosen; tested at 320px width.
