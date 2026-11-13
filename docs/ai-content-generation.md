# Generate content with AI

Nibblearn lessons are plain JSON with a strict, well-described schema. That makes them a good target for LLMs: give the model a training document and the schema cheat sheet, get back a lesson, validate it, fix what the validator flags, and ship it. This page explains the rules, gives a self-contained prompt, and shows the validation loop.

## Why the schema suits LLMs

- **Discriminated by `type`.** Every module is an object with `id`, `type`, `content` and optional `behavior`. The model only needs to learn 22 small shapes.
- **Defaults everywhere.** Only `id`, `type` and the `content` essentials are required; every behaviour flag has a sensible default, so minimal output is valid output.
- **Referential checks with messages.** Branch targets, category ids, blanks in templates and formula identifiers are all validated with a path (`modules[3].content.nodes[2].choices[0].next`) and a plain-English message the model can act on.
- **Safe text.** Fields accept only `**bold**`, `*italic*`, `` `code` `` and newlines. The model cannot inject HTML, and you do not need to sanitise.
- **Human-readable ids.** `"id": "cpa-quiz"` instead of UUIDs keeps the JSON legible and diffable.

## Authoring rules

1. **Ids**: lower-case kebab-case, unique within a lesson for modules; unique within a module for nodes, items, categories, blanks and inputs. Only `a–z A–Z 0–9 - _`.
2. **Types**: one of the 22 built-in strings below (or a type you registered). Anything else is rejected.
3. **Required fields**: see the cheat sheet. When in doubt, include `title` and `instructions` on every module.
4. **Where explanations go**: in the field designed for them, never in the prompt or option text. `options[].explanation` for per-option feedback, `questions[].explanation` for the general answer, `content.explanation` for sequence/fill-blanks, `choices[].feedback` for scenario choices, `responses[].feedback` for conversations, `mistakes[].explanation` for spot-the-mistake, `stages[].details` for process stages, `questions[].explanation` for estimates, `content.explanation` for the budget allocator.
5. **Length**: 15–90 seconds per activity. That is 3–8 flashcards, 2–4 questions, 4–6 pairs, 4–6 sequence steps, 6–10 sort items, 2–4 blanks, 3–5 hotspots, 3–6 scenario decisions.
6. **4–8 activities per lesson**, alternating learn (story-cards, flashcards, explorers) with practice (quizzes, sorting, matching) and ending with something applied (scenario, conversation, simulator).
7. **Original content**: paraphrase the source; never paste copyrighted text verbatim; invent fictional names and figures, and mark figures as illustrative.
8. **Consistent numbers**: if a flashcard says ROAS = 3.4×, the quiz and the simulator must agree.
9. **Objectives first**: 2–5 objectives phrased as "You will be able to …"; every module should serve one.
10. **Schema version**: always `"schemaVersion": 1`.

## Schema cheat sheet

Minimal valid shape per type. `…` marks optional fields worth filling (`title`, `instructions`, hints, explanations). Full field tables are in the [schema reference](./schema-reference.md).

```text
LESSON
{ "schemaVersion": 1, "id", "title", "description"?, "objectives": [..], "language": "en",
  "intro": { "show": true, "estimatedMinutes": 8 }?, "completion": { "rule": "all-modules"|"score"|"any", "threshold": 0.7 }?,
  "gamification": { "points": true, "celebration": true, "streaks": false }?, "modules": [ ...modules ] }

Every module: { "id", "type", "title"?, "instructions"?, "content": {...}, "behavior": {...}?, "feedback": { "correct"?, "incorrect"?, "complete"? }?, "scoring": { "weight": 1 }? }

story-cards            content.cards[1-60]: { "title"?, "body"? (blank lines = paragraphs), "eyebrow"?, "layout": "default"|"cover"|"quote"|"stat", "stat": {"value","label"}?, "expandable": {"label","body"}?, "check": { "question", "options": [{"text","correct"}], "explanation"? }? }
flashcards             content.cards[1-200]: { "front", "back", "hint"?, "tag"? }
choice-challenge       content.questions[1-50]: { "prompt", "context"?, "options"[2-8]: [{ "text", "correct"?, "explanation"? }], "explanation"?, "hint"? }   (≥1 correct; >1 correct = multiple select)
true-false             content.statements[1-100]: { "text", "isTrue", "explanation"?, "tag"? }
match-pairs            content.pairs[2-30]: [{ "left", "right", "explanation"? }], "leftLabel"?, "rightLabel"?
sequence-builder       content.items[2-15] IN CORRECT ORDER: [{ "id", "text", "description"? }], "explanation"?, "hint"?
category-sort          content.categories[2-6]: [{ "id", "label", "description"? }], content.items[2-40]: [{ "id", "text", "categoryId", "explanation"? }], "hint"?
fill-blanks            content.template: "text with {{blankId}}", content.blanks[1-20]: [{ "id", "answers": ["…"], "hint"?, "explanation"? }], "distractors": []?, "explanation"?; behavior.mode: "word-bank"|"typed"
hotspot-explorer       content.image: { "src", "alt" }, content.hotspots[1-30]: [{ "id", "x"(0-100), "y"(0-100), "label", "description", "title"? }]
screenshot-walkthrough content.steps[1-40]: [{ "id", "image": {"src","alt"}, "instruction", "target": {"x","y","width","height"}(0-100), "action": "click"|"type"|"observe", "input": {"placeholder","expected"}?, "note"? }], "summary"?
branching-scenario     content.start: nodeId, content.intro?, content.nodes[2-200]: [{ "id", "kind": "decision"|"ending", "speaker"?, "text", "choices": [{ "text", "next": nodeId, "feedback"?, "points": 0, "quality": "good"|"neutral"|"poor" }], "outcome": "success"|"neutral"|"failure" (endings), "summary"? (endings) }]   (≥1 ending; decisions need ≥1 choice)
conversation           content.contact: { "name", "role"?, "status"? }, content.start: nodeId, content.nodes[1-200]: [{ "id", "messages": [{ "from": "them"|"system", "text" }], "responses"[0-5]: [{ "text", "next": nodeId, "tone"?, "effectiveness": 0-1, "feedback"? }], "summary"?, "outcome"? }]   (no responses = ending)
process-explorer       content.stages[2-20]: [{ "id", "title", "summary"?, "details", "icon"? (lucide name), "owner"?, "duration"?, "dependsOn": [ids]?, "checklist": ["…"]? }]
spot-the-mistake       content.canvas: { "kind": "document", "title", "rows"[2-40]: [{ "id", "label", "value", "note"?, "section"? }] } OR { "kind": "image", "image": {"src","alt"}, "regions"[2-40]: [{ "id", "label", "x","y","width","height" }] }; content.mistakes[1-20]: [{ "targetId", "title"?, "explanation", "hint"? }]; "summary"?
what-if-simulator      content.inputs[1-8]: [{ "id", "label", "min", "max", "step", "default", "format": "number"|"currency"|"percent"|"integer", "help"? }], content.outputs[1-8]: [{ "id", "label", "formula", "format", "primary"?, "help"? }], content.insights[]: [{ "id", "when": condition, "text", "tone": "info"|"success"|"warning" }]?, content.challenge: { "description", "goal": condition, "successMessage"? }?, "currency": "USD"
                       formulas: + - * / % ( ) < <= > >= == != and or not, min max round abs floor ceil clamp; identifiers = input/output ids only
budget-allocator       content.totalBudget: number, content.currency: "USD", content.kpiLabel: "Conversions", content.channels[3-8]: [{ "id", "label", "description"?, "color"?, "efficiency" (>0: KPI per 1,000 at the first 1,000), "saturation" (0.3-1; 1 = linear), "min"? / "max"? (percent) }], content.initial: { channelId: percent } (every channel, multiples of step, sum = 100), content.goal: { "description", "minKpi"?, "maxCostPerKpi"? }?, "explanation"?; behavior: { "step": 5 (divides 100), "allowLock", "showOptimal", "scoreAgainstOptimal" }
estimate               content.questions[1-20]: [{ "id"?, "prompt", "context"?, "min", "max", "step", "answer" (within [min, max]), "format": "number"|"percent"|"currency"|"integer" (percent = fraction, 0.028 = 2.8%), "unit"?, "tolerance"? (default 5% of range), "explanation"?, "hint"? }], "currency": "USD"
label-diagram          content.image: { "src", "alt", "width", "height" }, content.targets[2-12]: [{ "id", "x"(0-100), "y"(0-100), "label" (unique), "explanation"? }], "distractors": ["…"]? (≤8, unique), "explanation"?
image-compare          content.before / content.after: { "image": { "src", "alt", "width", "height" }, "label"? }, content.annotations[0-8]: [{ "id", "x", "y", "side": "before"|"after", "title", "text" }], "question": { "prompt", "options"[2-5]: [{ "text", "correct"?, "explanation"? }], "explanation"? }? (≥1 correct), "takeaway"?; behavior: { "initialPosition": 50, "requireExplore": true }
word-builder           content.items[1-10]: [{ "id"?, "prompt", "tokens": ["correct", "order", "2-14 tiles"], "alternatives"?: [["same", "tokens", "other", "order"]], "distractors": []?, "display": "sentence"|"formula", "hint"?, "explanation"? }]
priority-matrix        content.axes: { "x": {"label","low","high"}, "y": {"label","low","high"} }, content.quadrants[exactly 4]: [{ "id", "position": "top-left"|"top-right"|"bottom-left"|"bottom-right" (each once), "label", "description"?, "color"? }], content.items[3-16]: [{ "id", "text", "quadrantId", "explanation"? }], "explanation"?
inbox-triage           content.owner: { "name", "role"? }, content.actions[2-5]: [{ "id", "label", "description"?, "icon"?: "reply"|"forward"|"calendar"|"archive"|"flag"|"alert", "tone"?: "accent"|"lime"|"pink"|"sky"|"violet" }], content.messages[3-12]: [{ "id", "from": { "name", "role"?, "email"? }, "subject", "preview", "body", "time" (label, e.g. "08:57"), "flags"?: ["vip"|"external"|"attachment"|"suspicious-link"], "correctAction": actionId, "acceptable"?: [actionIds, not correctAction], "explanation" }], "summary"?; behavior: { "feedback": "instant"|"end", "allowRetry", "showScore" }

TEXT FIELDS: plain text; only **bold**, *italic*, `code`, "\n" and blank lines. No HTML, no Markdown headings/lists/links.
```

## Reusable prompt

Paste this into any capable LLM, replacing the bracketed parts. It is self-contained; no other context is required.

```text
You are an instructional designer producing a Nibblearn lesson. Nibblearn renders interactive learning modules from JSON. Transform the training document below into ONE lesson JSON object.

OUTPUT RULES
- Output ONLY the JSON object. No prose, no Markdown fences, no comments.
- "schemaVersion" must be the number 1.
- Lesson needs: "id" (kebab-case), "title", "description" (1–2 sentences), "objectives" (3–5 strings starting with a verb), "language" ("[en]"), "intro": {"show": true, "estimatedMinutes": N}, "completion": {"rule": "score", "threshold": 0.7}, "modules": [...].
- 4–8 modules. Mix at least 4 different types: start with a learn module (story-cards or flashcards), alternate with practice (choice-challenge, true-false, match-pairs, sequence-builder, category-sort, fill-blanks, word-builder), and end with an applied module (branching-scenario, conversation, inbox-triage, priority-matrix, what-if-simulator or budget-allocator) when the material allows. Use estimate for "how big is it?" intuition about key figures; label-diagram and image-compare only when you have suitable images.
- Each module takes 15–90 seconds: 3–8 cards, 2–4 questions, 4–6 pairs, 4–6 steps, 6–10 sort items, 2–4 blanks, 3–5 scenario decisions.
- Every module has "id" (kebab-case, unique), "type", "title", "instructions" (one sentence telling the learner what to do).
- Put teaching in the right place: explanations go in "explanation" / "feedback" / "details" / "summary" fields, never inside prompts or option text. Every question, statement, pair, step and mistake should carry an explanation.
- All ids referenced across a module (next, categoryId, targetId, {{blankId}}, dependsOn, formula identifiers) must exist. Every id uses only letters, digits, "-" and "_".
- Content must be ORIGINAL: paraphrase the source, use fictional company and people names, and keep any numbers internally consistent across modules. Where you invent figures, add a phrase like "(illustrative)" in the nearby text.
- Text fields are plain text. Allowed markup: **bold**, *italic*, `code`, "\n" for line breaks and a blank line for a new paragraph. No HTML, no headings, no bullet characters, no links.
- Do not include images unless the source provides real URLs; omit hotspot-explorer, screenshot-walkthrough, label-diagram and image-compare in that case.

SCHEMA CHEAT SHEET (minimal required shape per module type; "?" = optional but recommended)
Every module: { "id", "type", "title"?, "instructions"?, "content": {...}, "behavior": {...}?, "feedback": { "correct"?, "incorrect"?, "complete"? }? }
story-cards:            content.cards[1-60]: { "title"?, "body"? (blank lines = paragraphs), "eyebrow"?, "layout": "default"|"cover"|"quote"|"stat", "stat": {"value","label"}?, "check": { "question", "options": [{"text","correct"}], "explanation"? }? }
flashcards:             content.cards[1-200]: { "front", "back", "hint"?, "tag"? }
choice-challenge:       content.questions[1-50]: { "prompt", "context"?, "options"[2-8]: [{ "text", "correct"?, "explanation"? }], "explanation"?, "hint"? }  (at least one correct option; more than one correct = multiple select)
true-false:             content.statements[1-100]: { "text", "isTrue": true|false, "explanation"?, "tag"? }
match-pairs:            content.pairs[2-30]: [{ "left", "right", "explanation"? }], "leftLabel"?, "rightLabel"?
sequence-builder:       content.items[2-15] listed IN THE CORRECT ORDER: [{ "id", "text", "description"? }], "explanation"?, "hint"?
category-sort:          content.categories[2-6]: [{ "id", "label", "description"? }], content.items[2-40]: [{ "id", "text", "categoryId", "explanation"? }], "hint"?
fill-blanks:            content.template: "sentence with {{blankId}} markers", content.blanks[1-20]: [{ "id", "answers": ["accepted", "variants"], "hint"?, "explanation"? }], "distractors": ["wrong", "words"]?, "explanation"?
branching-scenario:     content.start: "<nodeId>", content.intro?, content.nodes[2-200]: [{ "id", "kind": "decision"|"ending", "speaker"?, "text", "choices": [{ "text", "next": "<nodeId>", "feedback"?, "points": number, "quality": "good"|"neutral"|"poor" }], "outcome": "success"|"neutral"|"failure" (endings only), "summary"? (endings only) }]  (decision nodes need ≥1 choice; at least one ending)
conversation:           content.contact: { "name", "role"?, "status"? }, content.start: "<nodeId>", content.nodes[1-200]: [{ "id", "messages": [{ "from": "them"|"system", "text" }], "responses"[0-5]: [{ "text", "next": "<nodeId>", "tone"?, "effectiveness": 0..1, "feedback"? }], "summary"?, "outcome"? }]  (a node with no responses is an ending)
process-explorer:       content.stages[2-20]: [{ "id", "title", "summary"?, "details", "owner"?, "duration"?, "dependsOn": ["<stageId>"]?, "checklist": ["…"]? }]
spot-the-mistake:       content.canvas: { "kind": "document", "title", "rows"[2-40]: [{ "id", "label", "value", "note"?, "section"? }] }, content.mistakes[1-20]: [{ "targetId": "<rowId>", "title"?, "explanation", "hint"? }], "summary"?
what-if-simulator:      content.inputs[1-8]: [{ "id", "label", "min", "max", "step", "default", "format": "number"|"currency"|"percent"|"integer", "help"? }], content.outputs[1-8]: [{ "id", "label", "formula", "format", "primary"?, "help"? }], content.insights: [{ "id", "when": "<condition>", "text", "tone": "info"|"success"|"warning" }]?, content.challenge: { "description", "goal": "<condition>", "successMessage"? }?, "currency": "USD"
                        Formulas use only: numbers, input/output ids, + - * / % ( ), comparisons < <= > >= == !=, and/or/not, functions min max round abs floor ceil clamp. Outputs may reference earlier outputs. Every input needs min < default < max.
budget-allocator:       content.totalBudget: number, content.currency: "USD", content.kpiLabel: "Conversions", content.channels[3-8]: [{ "id", "label", "description"?, "color"?: "accent"|"info"|"success"|"warning"|"pink"|"violet", "efficiency": number > 0 (KPI per 1,000 spent at the first 1,000), "saturation": 0.3..1 (1 = linear, lower = diminishing returns), "min"?: percent, "max"?: percent }], content.initial: { "<channelId>": percent } (every channel listed, values are multiples of behavior.step, total exactly 100), content.goal: { "description", "minKpi"?: number, "maxCostPerKpi"?: number }?, content.explanation?; behavior: { "step": 5 }  (step must divide 100; make the goal reachable but not met by the initial split)
estimate:               content.questions[1-20]: [{ "id"?, "prompt", "context"?, "min", "max", "step", "answer" (min ≤ answer ≤ max), "format": "number"|"percent"|"currency"|"integer", "unit"? (e.g. "×"), "tolerance"? (absolute; default 5% of the range), "explanation", "hint"? }], "currency": "USD"  (percent values are fractions: 0.028 means 2.8%)
label-diagram:          content.image: { "src", "alt", "width", "height" }, content.targets[2-12]: [{ "id", "x": 0..100, "y": 0..100 (percent anchor point on the image), "label" (unique, case-insensitive), "explanation" }], "distractors": ["wrong label"]? (≤8, unique), "explanation"?
image-compare:          content.before: { "image": { "src", "alt", "width", "height" }, "label"? ("Before") }, content.after: { same, "label"? ("After") }, content.annotations[0-8]: [{ "id", "x", "y" (percent), "side": "before"|"after", "title", "text" }], content.question: { "prompt", "options"[2-5]: [{ "text", "correct"?, "explanation" }], "explanation"? }? (≥1 correct option), "takeaway"?
word-builder:           content.items[1-10]: [{ "id"?, "prompt", "tokens": ["the", "correct", "answer", "in", "order"] (2-14 tiles; one word or operator per tile), "alternatives"?: [[…]] (other accepted orders using exactly the same tokens), "distractors": ["1-2", "wrong tiles"], "display": "sentence"|"formula" (formula for equations like ["ROAS", "=", "Revenue", "÷", "Ad spend"]), "hint"?, "explanation" }]
priority-matrix:        content.axes: { "x": { "label": "Urgency", "low": "low", "high": "high" }, "y": { "label": "Importance", "low": "low", "high": "high" } }, content.quadrants: exactly 4 [{ "id", "position": "top-left"|"top-right"|"bottom-left"|"bottom-right" (each used once; top = high y, right = high x), "label" (short, e.g. "Do now"), "description"?, "color"?: "accent"|"lime"|"pink"|"sky"|"violet" }], content.items[3-16]: [{ "id", "text", "quadrantId", "explanation" }], content.explanation?
inbox-triage:           content.owner: { "name", "role"? }, content.actions[2-5]: [{ "id", "label", "description"?, "icon"?: "reply"|"forward"|"calendar"|"archive"|"flag"|"alert", "tone"?: "accent"|"lime"|"pink"|"sky"|"violet" }], content.messages[3-12]: [{ "id", "from": { "name", "role"?, "email"? }, "subject", "preview" (one line), "body" (blank lines = paragraphs), "time": "08:57", "flags"?: ["vip"|"external"|"attachment"|"suspicious-link"], "correctAction": "<actionId>", "acceptable"?: ["<actionId>"] (partial credit; never repeat correctAction), "explanation" }], "summary"?; behavior: { "feedback": "instant"|"end" }  (mix urgent, delegable, deferrable and ignorable messages; every message needs an explanation of the triage judgement)
(hotspot-explorer, screenshot-walkthrough, label-diagram and image-compare require image URLs; skip them unless the source includes usable image URLs.)

TRAINING DOCUMENT
[paste the document here]
```

## Validate and fix generated JSON

### In code

```ts
import { validateLesson, formatIssues } from "@nibblearn/core";

const res = validateLesson(JSON.parse(llmOutput));
if (!res.success) {
  console.error(formatIssues(res.issues));
  // • modules[2].content.items[4].categoryId: item "cpa" refers to unknown category "costs"
  // • modules[5].content.nodes[1].choices[0].next: choice "Blame the platform" points to unknown node "end-bad"
  // • modules[6].content.outputs[2].formula: formula references unknown id "convs"
} else {
  const lesson = res.data; // defaults applied, ready for <LessonPlayer lesson={lesson} />
}
```

A practical loop: send `formatIssues(res.issues)` back to the model with "Fix these issues and output the full corrected JSON only", then validate again. Most generations need zero or one round.

Common fixes:

| Issue message                                              | Fix                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `duplicate module id "…"`                                  | Rename one of the modules.                                                            |
| `expected one of "story-cards", "flashcards", …`           | The `type` string is misspelled.                                                      |
| `each question needs at least one correct option`          | Add `"correct": true` to the right option.                                            |
| `template uses {{x}} but no blank with id "x" is defined`  | Add the blank or fix the placeholder.                                                 |
| `start node "…" does not exist` / `points to unknown node` | Align node ids and `next` targets.                                                    |
| `the scenario needs at least one node with kind: "ending"` | Mark the final nodes `"kind": "ending"`.                                              |
| `formula references unknown id`                            | Use input/output ids exactly; outputs can only reference outputs defined before them. |
| `default must be within [min, max]`                        | Adjust the slider default.                                                            |
| `initial shares must sum to 100`                           | Make the budget-allocator starting split add up to exactly 100.                       |
| `answer must be within [min, max]`                         | Widen the estimate scale or fix the answer.                                           |
| `Too big: expected string to have <=4000 characters`       | Split long text across cards.                                                         |

### In the playground

The showcase site has two editors backed by the same validators:

- **Playground** (`/playground`): paste a single module JSON. Validation runs on every keystroke; issues appear with their path and the preview keeps showing the last valid version.
- **Lesson playground** (`/playground/lesson`): paste a whole lesson JSON to see it in `LessonPlayer` with intro, navigation, scoring and summary.

Paste the LLM output, read the issue list, fix the JSON in place (or feed the issues back to the model), and copy the validated JSON into your app. Progress in the playground is not persisted.

## Tips for better output

- Give the model the source document in sections; one lesson per section of 800–2,000 words works well.
- Ask for the objectives first in a separate turn, approve them, then ask for the lesson. Objectives anchor module selection.
- For simulators, ask the model to list the formulas in prose before writing JSON; errors are easier to catch there.
- Keep a small library of approved lessons as few-shot examples; they improve tone consistency more than longer instructions.
- Store the generating prompt and source hash in `metadata` (`"metadata": { "source": "onboarding-v3.md", "generator": "…" }`) so lessons can be regenerated later.
