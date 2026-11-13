# Schema reference

Every module config is validated by a Zod schema exported from `@nibblearn/core` (`flashcardsSchema`, `choiceChallengeSchema`, …) with matching `XxxInput` (what you write) and `XxxConfig` (what you get back, defaults applied) types. This page is derived from those schemas. Lesson-level fields are in [Build a multi-step lesson](./lessons.md).

Field paths are relative to the module object. "text" means a string up to 4,000 characters that may contain [inline markup](#inline-markup). "id" means 1–120 characters of `A–Z a–z 0–9 - _`.

## Common fields (every module)

| Path                    | Type           | Default  | Description                                                                                         |
| ----------------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `id`                    | id             | required | Unique within the lesson. Used for progress and events.                                             |
| `type`                  | string literal | required | The module type, e.g. `"flashcards"`.                                                               |
| `title`                 | string (≤ 200) | —        | Module heading.                                                                                     |
| `instructions`          | text           | —        | Short line under the title.                                                                         |
| `feedback.correct`      | text           | —        | Shown on a correct answer (where the module has one).                                               |
| `feedback.incorrect`    | text           | —        | Shown on an incorrect answer.                                                                       |
| `feedback.complete`     | text           | —        | Shown on the completion card.                                                                       |
| `scoring.weight`        | number ≥ 0     | `1`      | Relative weight in the lesson score.                                                                |
| `scoring.passThreshold` | number 0–1     | `0`      | Score that counts as a pass for this module (summary icons, streaks). `0` means the default of 0.7. |
| `appearance.accent`     | CSS color      | —        | Accent override for this module.                                                                    |
| `appearance.compact`    | boolean        | `false`  | Denser layout.                                                                                      |
| `appearance.hideHeader` | boolean        | `false`  | Hide title and instructions.                                                                        |
| `meta`                  | object         | —        | Free-form, ignored by Nibblearn.                                                                    |

> **Colour and URL fields are validated.** Colour fields accept plain CSS colours only (names, tokens, `#hex`, `rgb()`, `hsl()`, `oklch()` …); `url()` and `var()` are rejected. `fontFamily` accepts a plain font list. Image `src` accepts `http(s)`, relative, `blob:` and `data:image/*` URLs. See [SECURITY.md](https://github.com/ifgolubev/nibblearn/blob/main/SECURITY.md).

### Media

Used wherever a field is typed "media".

| Path              | Type       | Default  | Description                                           |
| ----------------- | ---------- | -------- | ----------------------------------------------------- |
| `src`             | string     | required | Absolute or relative URL, or data URI.                |
| `alt`             | string     | `""`     | Alternative text. Empty for decorative images.        |
| `width`, `height` | number > 0 | —        | Intrinsic size, reserves space to avoid layout shift. |
| `caption`         | string     | —        | Rendered under the image.                             |

### Retry behaviour (shared by several practice modules)

| Path                       | Type        | Default | Description                                              |
| -------------------------- | ----------- | ------- | -------------------------------------------------------- |
| `behavior.allowRetry`      | boolean     | `true`  | Let the learner try again after a wrong answer.          |
| `behavior.maxAttempts`     | integer ≥ 0 | `0`     | Attempts before the answer is revealed. `0` = unlimited. |
| `behavior.showExplanation` | boolean     | `true`  | Show explanations after checking.                        |

### Inline markup

Text fields accept a tiny, safe subset: `**bold**`, `*italic*`, `` `code` ``, `\n` for a line break, and a blank line (`\n\n`) to start a new paragraph where the field renders as paragraphs (card bodies, explanations). HTML is never interpreted; anything else is shown literally.

## story-cards

Card-based micro lesson with progressive reveal and optional embedded checks.

| Path                                | Type                                        | Default   | Description                                           |
| ----------------------------------- | ------------------------------------------- | --------- | ----------------------------------------------------- |
| `content.cards[]`                   | 1–60                                        | required  |                                                       |
| `content.cards[].id`                | id                                          | —         |                                                       |
| `content.cards[].eyebrow`           | string ≤ 60                                 | —         | Small label above the title.                          |
| `content.cards[].title`             | string ≤ 200                                | —         |                                                       |
| `content.cards[].body`              | text                                        | —         | Blank lines separate paragraphs, revealed one by one. |
| `content.cards[].image`             | media                                       | —         |                                                       |
| `content.cards[].layout`            | `default` \| `cover` \| `quote` \| `stat`   | `default` | Visual treatment.                                     |
| `content.cards[].stat`              | `{ value ≤ 24, label ≤ 80 }`                | —         | Big figure for the `stat` layout.                     |
| `content.cards[].expandable`        | `{ label ≤ 80 = "Learn more", body: text }` | —         | Collapsible extra section.                            |
| `content.cards[].check`             | object                                      | —         | Embedded quick check.                                 |
| `content.cards[].check.question`    | text                                        | required  |                                                       |
| `content.cards[].check.options[]`   | 2–6 of `{ text, correct = false }`          | required  |                                                       |
| `content.cards[].check.explanation` | text                                        | —         |                                                       |
| `behavior.progressiveReveal`        | boolean                                     | `true`    | Stagger paragraph reveal.                             |
| `behavior.allowBack`                | boolean                                     | `true`    |                                                       |
| `behavior.showProgress`             | boolean                                     | `true`    |                                                       |
| `behavior.requireChecks`            | boolean                                     | `true`    | Checks must be answered before moving on.             |

```json
{
  "id": "why-metrics",
  "type": "story-cards",
  "title": "Why metrics matter",
  "content": {
    "cards": [
      {
        "layout": "cover",
        "eyebrow": "Chapter 1",
        "title": "Numbers tell the story",
        "body": "Every campaign report is a story.\n\nMetrics are its vocabulary."
      },
      {
        "layout": "stat",
        "stat": { "value": "3.4×", "label": "ROAS on the Northwind account" },
        "body": "For every dollar spent, $3.40 came back."
      },
      {
        "title": "Quick check",
        "check": {
          "question": "ROAS compares revenue to…",
          "options": [{ "text": "Spend", "correct": true }, { "text": "Clicks" }],
          "explanation": "Return **on ad spend**."
        }
      }
    ]
  }
}
```

Score: fraction of checks answered correctly on the first try; unscored when no card has a check.

## flashcards

| Path                                      | Type        | Default  | Description                                              |
| ----------------------------------------- | ----------- | -------- | -------------------------------------------------------- |
| `content.cards[]`                         | 1–200       | required |                                                          |
| `content.cards[].id`                      | id          | —        |                                                          |
| `content.cards[].front`                   | text        | required |                                                          |
| `content.cards[].back`                    | text        | required |                                                          |
| `content.cards[].frontImage`, `backImage` | media       | —        |                                                          |
| `content.cards[].hint`                    | text        | —        | Revealed on demand on the front.                         |
| `content.cards[].tag`                     | string ≤ 40 | —        | Small label.                                             |
| `behavior.shuffle`                        | boolean     | `false`  | Shuffle on start.                                        |
| `behavior.allowShuffle`                   | boolean     | `true`   | Show a shuffle button.                                   |
| `behavior.requireMastery`                 | boolean     | `true`   | Loop over "practice again" cards until all are "got it". |
| `behavior.autoFlip`                       | boolean     | `false`  | Show the back immediately (reading mode).                |

```json
{
  "id": "metric-deck",
  "type": "flashcards",
  "title": "Metric deck",
  "content": {
    "cards": [
      {
        "front": "CPM",
        "back": "**Cost per mille** — spend ÷ impressions × 1,000.",
        "tag": "Cost",
        "hint": "M is Roman for 1,000."
      },
      { "front": "CTR", "back": "**Click-through rate** — clicks ÷ impressions.", "tag": "Rate" }
    ]
  }
}
```

Score: cards marked "got it" on the first pass ÷ total.

## choice-challenge

| Path                                                    | Type                   | Default  | Description                                         |
| ------------------------------------------------------- | ---------------------- | -------- | --------------------------------------------------- |
| `content.questions[]`                                   | 1–50                   | required |                                                     |
| `content.questions[].id`                                | id                     | —        |                                                     |
| `content.questions[].prompt`                            | text                   | required |                                                     |
| `content.questions[].context`                           | text                   | —        | Secondary line under the prompt.                    |
| `content.questions[].image`                             | media                  | —        |                                                     |
| `content.questions[].mode`                              | `single` \| `multiple` | inferred | Inferred from the number of correct options.        |
| `content.questions[].options[]`                         | 2–8                    | required | At least one must be `correct`.                     |
| `content.questions[].options[].id`                      | id                     | —        |                                                     |
| `content.questions[].options[].text`                    | text                   | required |                                                     |
| `content.questions[].options[].image`                   | media                  | —        |                                                     |
| `content.questions[].options[].correct`                 | boolean                | `false`  |                                                     |
| `content.questions[].options[].explanation`             | text                   | —        | Per-option explanation after checking.              |
| `content.questions[].explanation`                       | text                   | —        | General explanation after checking.                 |
| `content.questions[].hint`                              | text                   | —        |                                                     |
| `behavior.allowRetry`, `maxAttempts`, `showExplanation` | retry behaviour        |          |                                                     |
| `behavior.shuffleOptions`                               | boolean                | `false`  |                                                     |
| `behavior.partialCredit`                                | boolean                | `true`   | Partial credit for partly correct multiple answers. |
| `behavior.showCounter`                                  | boolean                | `true`   | "Question 2 of 5".                                  |

```json
{
  "id": "kpi-quiz",
  "type": "choice-challenge",
  "content": {
    "questions": [
      {
        "prompt": "Which KPI best measures **efficiency**?",
        "options": [
          { "text": "Impressions", "explanation": "Reach, not efficiency." },
          {
            "text": "Cost per acquisition",
            "correct": true,
            "explanation": "What each result costs."
          }
        ],
        "explanation": "Efficiency is outcomes per unit of spend.",
        "hint": "Look for the word *cost*."
      }
    ]
  }
}
```

## true-false

| Path                               | Type        | Default   | Description                                |
| ---------------------------------- | ----------- | --------- | ------------------------------------------ |
| `content.statements[]`             | 1–100       | required  |                                            |
| `content.statements[].id`          | id          | —         |                                            |
| `content.statements[].text`        | text        | required  |                                            |
| `content.statements[].isTrue`      | boolean     | required  |                                            |
| `content.statements[].explanation` | text        | —         |                                            |
| `content.statements[].image`       | media       | —         |                                            |
| `content.statements[].tag`         | string ≤ 40 | —         |                                            |
| `behavior.swipe`                   | boolean     | `true`    | Swipe gestures (buttons always available). |
| `behavior.trueLabel`               | string ≤ 24 | `"True"`  |                                            |
| `behavior.falseLabel`              | string ≤ 24 | `"False"` |                                            |
| `behavior.showExplanation`         | boolean     | `true`    | Pause after each answer.                   |
| `behavior.shuffle`                 | boolean     | `false`   |                                            |

```json
{
  "id": "metric-myths",
  "type": "true-false",
  "content": {
    "statements": [
      {
        "text": "A higher CTR always means a better campaign.",
        "isTrue": false,
        "explanation": "CTR measures relevance, not outcomes."
      },
      { "text": "ROAS is revenue divided by spend.", "isTrue": true }
    ]
  }
}
```

## match-pairs

| Path                              | Type         | Default  | Description                                  |
| --------------------------------- | ------------ | -------- | -------------------------------------------- |
| `content.pairs[]`                 | 2–30         | required |                                              |
| `content.pairs[].id`              | id           | —        |                                              |
| `content.pairs[].left`            | text         | required | Term.                                        |
| `content.pairs[].right`           | text         | required | Definition.                                  |
| `content.pairs[].explanation`     | text         | —        |                                              |
| `content.leftLabel`, `rightLabel` | string ≤ 40  | —        | Column headings.                             |
| `behavior.shuffle`                | boolean      | `true`   |                                              |
| `behavior.timer`                  | boolean      | `false`  | Elapsed-time counter.                        |
| `behavior.pairsPerRound`          | integer 2–12 | `6`      | Pairs visible at once.                       |
| `behavior.drag`                   | boolean      | `true`   | Drag-and-drop in addition to tap-to-connect. |

```json
{
  "id": "metric-match",
  "type": "match-pairs",
  "content": {
    "leftLabel": "Metric",
    "rightLabel": "Meaning",
    "pairs": [
      { "left": "CPM", "right": "Cost of 1,000 impressions" },
      { "left": "CPC", "right": "Cost of one click" },
      { "left": "ROAS", "right": "Revenue per unit of spend" }
    ]
  }
}
```

Score: `1 − mistakes ÷ (pairs × 2)`, floored at 0.

## sequence-builder

| Path                                                    | Type            | Default  | Description                                         |
| ------------------------------------------------------- | --------------- | -------- | --------------------------------------------------- |
| `content.items[]`                                       | 2–15            | required | **In the correct order**; shuffled for the learner. |
| `content.items[].id`                                    | id              | required |                                                     |
| `content.items[].text`                                  | text            | required |                                                     |
| `content.items[].description`                           | text            | —        | Shown in the solution view.                         |
| `content.explanation`                                   | text            | —        | Shown with the correct sequence.                    |
| `content.hint`                                          | text            | —        |                                                     |
| `behavior.allowRetry`, `maxAttempts`, `showExplanation` | retry behaviour |          |                                                     |
| `behavior.shuffleSeed`                                  | integer         | —        | Deterministic shuffle.                              |
| `behavior.showPositions`                                | boolean         | `true`   | Numbered positions.                                 |

```json
{
  "id": "launch-steps",
  "type": "sequence-builder",
  "content": {
    "items": [
      { "id": "brief", "text": "Agree the brief" },
      { "id": "build", "text": "Build the campaign" },
      { "id": "qa", "text": "QA tracking" },
      { "id": "launch", "text": "Launch" }
    ],
    "explanation": "Tracking must be verified before anything goes live."
  }
}
```

## category-sort

| Path                                                    | Type            | Default  | Description                                              |
| ------------------------------------------------------- | --------------- | -------- | -------------------------------------------------------- |
| `content.categories[]`                                  | 2–6             | required |                                                          |
| `content.categories[].id`                               | id              | required |                                                          |
| `content.categories[].label`                            | string ≤ 80     | required |                                                          |
| `content.categories[].description`                      | text            | —        |                                                          |
| `content.categories[].color`                            | string ≤ 40     | —        | `accent`, `success`, `info`, `warning` or any CSS color. |
| `content.items[]`                                       | 2–40            | required |                                                          |
| `content.items[].id`                                    | id              | required |                                                          |
| `content.items[].text`                                  | text            | required |                                                          |
| `content.items[].categoryId`                            | id              | required | Must match a category.                                   |
| `content.items[].explanation`                           | text            | —        |                                                          |
| `content.hint`                                          | text            | —        |                                                          |
| `behavior.allowRetry`, `maxAttempts`, `showExplanation` | retry behaviour |          |                                                          |
| `behavior.shuffle`                                      | boolean         | `true`   |                                                          |
| `behavior.shuffleSeed`                                  | integer         | —        |                                                          |

```json
{
  "id": "metric-buckets",
  "type": "category-sort",
  "content": {
    "categories": [
      { "id": "cost", "label": "Cost metrics", "color": "warning" },
      { "id": "rate", "label": "Rate metrics", "color": "info" }
    ],
    "items": [
      { "id": "cpc", "text": "CPC", "categoryId": "cost" },
      { "id": "ctr", "text": "CTR", "categoryId": "rate" },
      { "id": "cpa", "text": "CPA", "categoryId": "cost" }
    ]
  }
}
```

## fill-blanks

| Path                                                    | Type                   | Default     | Description                                                       |
| ------------------------------------------------------- | ---------------------- | ----------- | ----------------------------------------------------------------- |
| `content.template`                                      | string 1–4000          | required    | Text with blanks written as `{{blankId}}`. Inline markup allowed. |
| `content.blanks[]`                                      | 1–20                   | required    | Every blank must appear in the template and vice versa.           |
| `content.blanks[].id`                                   | id                     | required    |                                                                   |
| `content.blanks[].answers[]`                            | string[] (1+)          | required    | Accepted answers; the first is shown in the bank and solution.    |
| `content.blanks[].hint`                                 | text                   | —           |                                                                   |
| `content.blanks[].explanation`                          | text                   | —           |                                                                   |
| `content.distractors[]`                                 | string[]               | `[]`        | Extra wrong words in the bank.                                    |
| `content.explanation`                                   | text                   | —           |                                                                   |
| `behavior.allowRetry`, `maxAttempts`, `showExplanation` | retry behaviour        |             |                                                                   |
| `behavior.mode`                                         | `word-bank` \| `typed` | `word-bank` |                                                                   |
| `behavior.caseSensitive`                                | boolean                | `false`     |                                                                   |
| `behavior.lenient`                                      | boolean                | `true`      | Ignore punctuation and extra whitespace in typed answers.         |
| `behavior.shuffleBank`                                  | boolean                | `true`      |                                                                   |

```json
{
  "id": "formulas",
  "type": "fill-blanks",
  "content": {
    "template": "**ROAS** is revenue divided by {{spend}}. **CTR** is clicks divided by {{imp}}.",
    "blanks": [
      { "id": "spend", "answers": ["ad spend", "spend"], "hint": "It's in the name." },
      { "id": "imp", "answers": ["impressions"] }
    ],
    "distractors": ["sessions", "followers"]
  }
}
```

## hotspot-explorer

| Path                                 | Type                                             | Default  | Description                                  |
| ------------------------------------ | ------------------------------------------------ | -------- | -------------------------------------------- |
| `content.image`                      | media                                            | required |                                              |
| `content.hotspots[]`                 | 1–30                                             | required |                                              |
| `content.hotspots[].id`              | id                                               | required |                                              |
| `content.hotspots[].x`, `y`          | number 0–100                                     | required | Position as % of the image.                  |
| `content.hotspots[].width`, `height` | number 0–100                                     | —        | For `rect` shape.                            |
| `content.hotspots[].shape`           | `dot` \| `rect`                                  | `dot`    |                                              |
| `content.hotspots[].label`           | string ≤ 80                                      | required | Accessible name and tooltip.                 |
| `content.hotspots[].title`           | string ≤ 120                                     | —        |                                              |
| `content.hotspots[].description`     | text                                             | required |                                              |
| `content.hotspots[].placement`       | `auto` \| `top` \| `bottom` \| `left` \| `right` | `auto`   | Info panel position on wide screens.         |
| `behavior.requireAll`                | boolean                                          | `true`   | Complete only after every hotspot is opened. |
| `behavior.numbered`                  | boolean                                          | `true`   |                                              |
| `behavior.pulse`                     | boolean                                          | `true`   | Pulse unvisited markers.                     |

```json
{
  "id": "dashboard-tour",
  "type": "hotspot-explorer",
  "content": {
    "image": {
      "src": "/img/dashboard.png",
      "alt": "Campaign dashboard overview",
      "width": 1600,
      "height": 900
    },
    "hotspots": [
      {
        "id": "spend",
        "x": 18,
        "y": 22,
        "label": "Spend",
        "description": "Total media cost for the period."
      },
      { "id": "roas", "x": 72, "y": 22, "label": "ROAS", "description": "Revenue ÷ spend." }
    ]
  }
}
```

Unscored.

## screenshot-walkthrough

| Path                                | Type                                             | Default  | Description                                              |
| ----------------------------------- | ------------------------------------------------ | -------- | -------------------------------------------------------- |
| `content.steps[]`                   | 1–40                                             | required |                                                          |
| `content.steps[].id`                | id                                               | required |                                                          |
| `content.steps[].image`             | media                                            | required | Reuse the same image when nothing changes.               |
| `content.steps[].title`             | string ≤ 120                                     | —        |                                                          |
| `content.steps[].instruction`       | text                                             | required | What to do.                                              |
| `content.steps[].target`            | `{ x, y, width, height }` (0–100)                | required | Region as % of the image.                                |
| `content.steps[].action`            | `click` \| `type` \| `observe`                   | `click`  |                                                          |
| `content.steps[].input.placeholder` | string ≤ 80                                      | —        | For `type` actions.                                      |
| `content.steps[].input.expected`    | string ≤ 120                                     | —        | Expected text (case-insensitive); any text when omitted. |
| `content.steps[].note`              | text                                             | —        | Extra context in the tooltip.                            |
| `content.steps[].tooltipPlacement`  | `auto` \| `top` \| `bottom` \| `left` \| `right` | `auto`   |                                                          |
| `content.summary`                   | text                                             | —        | Completion message.                                      |
| `behavior.allowHint`                | boolean                                          | `true`   | "Show me" button after a miss.                           |
| `behavior.autoHintAfterMisses`      | integer ≥ 0                                      | `2`      | `0` = never.                                             |
| `behavior.showStepNumbers`          | boolean                                          | `true`   |                                                          |
| `behavior.allowBack`                | boolean                                          | `true`   |                                                          |

```json
{
  "id": "create-campaign",
  "type": "screenshot-walkthrough",
  "content": {
    "steps": [
      {
        "id": "open",
        "image": { "src": "/img/home.png", "alt": "Ads manager home" },
        "instruction": "Click **New campaign**.",
        "target": { "x": 80, "y": 8, "width": 15, "height": 6 }
      },
      {
        "id": "name",
        "image": { "src": "/img/new.png", "alt": "New campaign form" },
        "instruction": "Type the campaign name and press Enter.",
        "action": "type",
        "target": { "x": 20, "y": 30, "width": 40, "height": 6 },
        "input": { "placeholder": "Campaign name", "expected": "Spring launch" }
      }
    ]
  }
}
```

Score: 1 minus a penalty per miss.

## branching-scenario

| Path                                 | Type                                | Default    | Description                            |
| ------------------------------------ | ----------------------------------- | ---------- | -------------------------------------- |
| `content.start`                      | id                                  | required   | First node.                            |
| `content.intro`                      | text                                | —          | Setup shown before the first decision. |
| `content.nodes[]`                    | 2–200                               | required   | At least one node must be an `ending`. |
| `content.nodes[].id`                 | id                                  | required   |                                        |
| `content.nodes[].kind`               | `decision` \| `ending`              | `decision` | Decision nodes need ≥ 1 choice.        |
| `content.nodes[].speaker`            | string ≤ 60                         | —          | Role label.                            |
| `content.nodes[].title`              | string ≤ 140                        | —          |                                        |
| `content.nodes[].text`               | text                                | required   |                                        |
| `content.nodes[].image`              | media                               | —          |                                        |
| `content.nodes[].choices[]`          | 0–6                                 | `[]`       |                                        |
| `content.nodes[].choices[].id`       | id                                  | —          |                                        |
| `content.nodes[].choices[].text`     | text                                | required   |                                        |
| `content.nodes[].choices[].next`     | id                                  | required   | Target node.                           |
| `content.nodes[].choices[].feedback` | text                                | —          | Shown right after choosing.            |
| `content.nodes[].choices[].points`   | number                              | `0`        | May be negative.                       |
| `content.nodes[].choices[].quality`  | `good` \| `neutral` \| `poor`       | `neutral`  | Colours the history.                   |
| `content.nodes[].outcome`            | `success` \| `neutral` \| `failure` | —          | For endings.                           |
| `content.nodes[].summary`            | text                                | —          | For endings.                           |
| `behavior.showScore`                 | boolean                             | `true`     |                                        |
| `behavior.allowRetry`                | boolean                             | `true`     |                                        |
| `behavior.showHistory`               | boolean                             | `true`     |                                        |
| `behavior.maxPoints`                 | number                              | computed   | Normalises the score.                  |
| `behavior.maxSteps`                  | integer 2–500                       | `60`       | Loop guard.                            |

```json
{
  "id": "angry-client",
  "type": "branching-scenario",
  "content": {
    "start": "call",
    "nodes": [
      {
        "id": "call",
        "speaker": "Client",
        "text": "ROAS dropped 30% this week. What happened?",
        "choices": [
          {
            "text": "Let me pull the numbers and call you back in an hour.",
            "next": "good-end",
            "points": 10,
            "quality": "good"
          },
          {
            "text": "The platform has been buggy lately.",
            "next": "bad-end",
            "points": -5,
            "quality": "poor",
            "feedback": "Blaming tools erodes trust."
          }
        ]
      },
      {
        "id": "good-end",
        "kind": "ending",
        "outcome": "success",
        "text": "You found a tracking gap and fixed it.",
        "summary": "Own the problem, then investigate."
      },
      {
        "id": "bad-end",
        "kind": "ending",
        "outcome": "failure",
        "text": "The client asks for a review of the contract."
      }
    ]
  }
}
```

## conversation

| Path                                        | Type                                | Default            | Description                     |
| ------------------------------------------- | ----------------------------------- | ------------------ | ------------------------------- |
| `content.contact.name`                      | string ≤ 80                         | required           |                                 |
| `content.contact.role`                      | string ≤ 80                         | —                  |                                 |
| `content.contact.avatar`                    | media                               | —                  |                                 |
| `content.contact.status`                    | string ≤ 40                         | —                  | e.g. "Online".                  |
| `content.start`                             | id                                  | required           |                                 |
| `content.nodes[]`                           | 1–200                               | required           |                                 |
| `content.nodes[].id`                        | id                                  | required           |                                 |
| `content.nodes[].messages[]`                | array                               | `[]`               | Shown on entering the node.     |
| `content.nodes[].messages[].from`           | `them` \| `system`                  | `them`             | `system` = neutral status line. |
| `content.nodes[].messages[].text`           | text                                | required           |                                 |
| `content.nodes[].messages[].delayMs`        | integer 0–10000                     | scaled by length   | Typing delay.                   |
| `content.nodes[].responses[]`               | 0–5                                 | `[]`               | Empty = ending.                 |
| `content.nodes[].responses[].id`            | id                                  | —                  |                                 |
| `content.nodes[].responses[].text`          | text                                | required           |                                 |
| `content.nodes[].responses[].next`          | id                                  | required           |                                 |
| `content.nodes[].responses[].tone`          | string ≤ 40                         | —                  | e.g. "Empathetic".              |
| `content.nodes[].responses[].effectiveness` | number 0–1                          | `0.5`              | Averaged into the score.        |
| `content.nodes[].responses[].feedback`      | text                                | —                  | Coaching note.                  |
| `content.nodes[].summary`                   | text                                | —                  | For endings.                    |
| `content.nodes[].outcome`                   | `success` \| `neutral` \| `failure` | derived from score |                                 |
| `behavior.typingIndicator`                  | boolean                             | `true`             |                                 |
| `behavior.showFeedback`                     | boolean                             | `true`             |                                 |
| `behavior.allowRetry`                       | boolean                             | `true`             |                                 |
| `behavior.maxSteps`                         | integer 1–500                       | `60`               |                                 |

```json
{
  "id": "budget-chat",
  "type": "conversation",
  "content": {
    "contact": { "name": "Dana Ruiz", "role": "Marketing lead, Northwind", "status": "Online" },
    "start": "open",
    "nodes": [
      {
        "id": "open",
        "messages": [{ "text": "Can we cut the budget 20% without losing leads?" }],
        "responses": [
          {
            "text": "Yes, no problem.",
            "next": "end",
            "tone": "Overpromising",
            "effectiveness": 0.2,
            "feedback": "You committed before checking."
          },
          {
            "text": "Possibly — let me model it and share two options tomorrow.",
            "next": "end",
            "tone": "Consultative",
            "effectiveness": 0.9
          }
        ]
      },
      {
        "id": "end",
        "messages": [{ "text": "Great, thanks." }],
        "summary": "Model before you promise."
      }
    ]
  }
}
```

Score: mean effectiveness of chosen responses.

## process-explorer

| Path                           | Type                                 | Default  | Description                                     |
| ------------------------------ | ------------------------------------ | -------- | ----------------------------------------------- |
| `content.stages[]`             | 2–20                                 | required |                                                 |
| `content.stages[].id`          | id                                   | required |                                                 |
| `content.stages[].title`       | string ≤ 100                         | required |                                                 |
| `content.stages[].summary`     | string ≤ 200                         | —        | One line on the node.                           |
| `content.stages[].details`     | text                                 | required | Detail panel.                                   |
| `content.stages[].icon`        | string ≤ 40                          | —        | Lucide icon name (kebab-case); number fallback. |
| `content.stages[].owner`       | string ≤ 80                          | —        |                                                 |
| `content.stages[].duration`    | string ≤ 40                          | —        | e.g. "2–3 days".                                |
| `content.stages[].dependsOn[]` | id[]                                 | `[]`     | Must reference existing stages.                 |
| `content.stages[].branches[]`  | `{ label ≤ 80, to: id }[]`           | `[]`     | Alternative paths.                              |
| `content.stages[].checklist[]` | string[] (≤ 160 each)                | `[]`     |                                                 |
| `content.stages[].image`       | media                                | —        |                                                 |
| `behavior.layout`              | `auto` \| `horizontal` \| `vertical` | `auto`   |                                                 |
| `behavior.requireAll`          | boolean                              | `true`   | Complete only after every stage is opened.      |

```json
{
  "id": "campaign-process",
  "type": "process-explorer",
  "content": {
    "stages": [
      {
        "id": "brief",
        "title": "Brief",
        "icon": "file-text",
        "owner": "Account team",
        "duration": "1 day",
        "details": "Agree goals, budget and KPIs with the client."
      },
      {
        "id": "build",
        "title": "Build",
        "icon": "hammer",
        "dependsOn": ["brief"],
        "details": "Set up campaigns, audiences and tracking.",
        "checklist": ["Pixels verified", "UTMs applied"]
      },
      {
        "id": "launch",
        "title": "Launch",
        "icon": "rocket",
        "dependsOn": ["build"],
        "details": "Go live and monitor the first 48 hours."
      }
    ]
  }
}
```

Unscored.

## spot-the-mistake

| Path                             | Type                                              | Default                 | Description                           |
| -------------------------------- | ------------------------------------------------- | ----------------------- | ------------------------------------- |
| `content.canvas.kind`            | `image` \| `document`                             | required                |                                       |
| `content.canvas.image`           | media                                             | required for `image`    |                                       |
| `content.canvas.regions[]`       | 2–40 of `{ id, label ≤ 80, x, y, width, height }` | required for `image`    | Percent coordinates.                  |
| `content.canvas.title`           | string ≤ 120                                      | required for `document` |                                       |
| `content.canvas.subtitle`        | string ≤ 160                                      | —                       |                                       |
| `content.canvas.rows[]`          | 2–40                                              | required for `document` |                                       |
| `content.canvas.rows[].id`       | id                                                | required                |                                       |
| `content.canvas.rows[].label`    | string ≤ 80                                       | required                |                                       |
| `content.canvas.rows[].value`    | string ≤ 200                                      | required                |                                       |
| `content.canvas.rows[].note`     | string ≤ 160                                      | —                       |                                       |
| `content.canvas.rows[].section`  | string ≤ 80                                       | —                       | Visual grouping.                      |
| `content.mistakes[]`             | 1–20                                              | required                |                                       |
| `content.mistakes[].targetId`    | id                                                | required                | A region or row id.                   |
| `content.mistakes[].title`       | string ≤ 100                                      | —                       |                                       |
| `content.mistakes[].explanation` | text                                              | required                |                                       |
| `content.mistakes[].hint`        | text                                              | —                       |                                       |
| `content.summary`                | text                                              | —                       |                                       |
| `behavior.maxWrong`              | integer ≥ 0                                       | `0`                     | Wrong picks allowed; `0` = unlimited. |
| `behavior.allowHints`            | boolean                                           | `true`                  |                                       |
| `behavior.allowRetry`            | boolean                                           | `true`                  |                                       |
| `behavior.checkMode`             | `instant` \| `submit`                             | `instant`               |                                       |

```json
{
  "id": "bad-invoice",
  "type": "spot-the-mistake",
  "content": {
    "canvas": {
      "kind": "document",
      "title": "Invoice #2041",
      "rows": [
        { "id": "client", "label": "Client", "value": "Northwind Outdoor" },
        { "id": "currency", "label": "Currency", "value": "EUR", "note": "Contract is in USD" },
        { "id": "total", "label": "Total", "value": "12,400" }
      ]
    },
    "mistakes": [
      {
        "targetId": "currency",
        "title": "Wrong currency",
        "explanation": "The contract is billed in USD."
      }
    ]
  }
}
```

Score: found ÷ total minus 0.15 per wrong pick.

## what-if-simulator

| Path                               | Type                                             | Default         | Description                                        |
| ---------------------------------- | ------------------------------------------------ | --------------- | -------------------------------------------------- |
| `content.inputs[]`                 | 1–8                                              | required        | Sliders.                                           |
| `content.inputs[].id`              | id                                               | required        | Referenced in formulas.                            |
| `content.inputs[].label`           | string ≤ 80                                      | required        |                                                    |
| `content.inputs[].min`, `max`      | number                                           | required        | `max` > `min`.                                     |
| `content.inputs[].step`            | number > 0                                       | `1`             |                                                    |
| `content.inputs[].default`         | number                                           | required        | Within `[min, max]`.                               |
| `content.inputs[].format`          | `number` \| `currency` \| `percent` \| `integer` | `number`        |                                                    |
| `content.inputs[].help`            | string ≤ 200                                     | —               |                                                    |
| `content.outputs[]`                | 1–8                                              | required        | Evaluated in order; may reference earlier outputs. |
| `content.outputs[].id`             | id                                               | required        |                                                    |
| `content.outputs[].label`          | string ≤ 80                                      | required        |                                                    |
| `content.outputs[].formula`        | string 1–400                                     | required        | See formula syntax below.                          |
| `content.outputs[].format`         | as above                                         | `number`        |                                                    |
| `content.outputs[].primary`        | boolean                                          | `false`         | Headline metric.                                   |
| `content.outputs[].help`           | string ≤ 200                                     | —               |                                                    |
| `content.insights[]`               | 0–12                                             | `[]`            | Conditional callouts.                              |
| `content.insights[].id`            | id                                               | required        |                                                    |
| `content.insights[].when`          | formula                                          | required        | Boolean condition.                                 |
| `content.insights[].text`          | text                                             | required        |                                                    |
| `content.insights[].tone`          | `info` \| `success` \| `warning`                 | `info`          |                                                    |
| `content.challenge.description`    | text                                             | required if set |                                                    |
| `content.challenge.goal`           | formula                                          | required if set | Must become true to complete.                      |
| `content.challenge.successMessage` | text                                             | —               |                                                    |
| `content.currency`                 | 3-letter code                                    | `"USD"`         |                                                    |
| `behavior.chart`                   | `bars` \| `none`                                 | `bars`          |                                                    |
| `behavior.completeOnInteract`      | boolean                                          | `true`          | Without a challenge, complete on first change.     |

```json
{
  "id": "cpa-explorer",
  "type": "what-if-simulator",
  "content": {
    "currency": "USD",
    "inputs": [
      {
        "id": "spend",
        "label": "Monthly spend",
        "min": 1000,
        "max": 50000,
        "step": 500,
        "default": 10000,
        "format": "currency"
      },
      {
        "id": "cpc",
        "label": "CPC",
        "min": 0.2,
        "max": 8,
        "step": 0.1,
        "default": 1.5,
        "format": "currency"
      },
      {
        "id": "cvr",
        "label": "Conversion rate",
        "min": 0.005,
        "max": 0.1,
        "step": 0.005,
        "default": 0.02,
        "format": "percent"
      }
    ],
    "outputs": [
      { "id": "clicks", "label": "Clicks", "formula": "floor(spend / cpc)", "format": "integer" },
      {
        "id": "conversions",
        "label": "Conversions",
        "formula": "floor(clicks * cvr)",
        "format": "integer"
      },
      {
        "id": "cpa",
        "label": "CPA",
        "formula": "spend / max(conversions, 1)",
        "format": "currency",
        "primary": true
      }
    ],
    "insights": [
      {
        "id": "high-cpc",
        "when": "cpc > 4",
        "tone": "warning",
        "text": "A CPC above $4 points to crowded auctions."
      }
    ],
    "challenge": {
      "description": "Bring **CPA under $30** at $10,000 spend or more.",
      "goal": "cpa < 30 and spend >= 10000"
    }
  }
}
```

### Formula syntax

Formulas are parsed by a small, safe evaluator (never `eval`). Validation rejects unknown identifiers and syntax errors with a path.

| Feature     | Syntax                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| Numbers     | `10`, `0.5`, `1e3`                                                                                          |
| Identifiers | Any input or output id (`spend`, `cpa`). Outputs may use outputs defined earlier.                           |
| Arithmetic  | `+ - * / %`, unary minus, parentheses                                                                       |
| Comparison  | `< <= > >= == !=` (result 1 or 0)                                                                           |
| Logic       | `and`, `or`, `not` (also `&&`, `\|\|`, `!`); `true` = 1, `false` = 0                                        |
| Functions   | `min(a, b, …)`, `max(a, b, …)`, `round(v, digits = 0)`, `abs(v)`, `floor(v)`, `ceil(v)`, `clamp(v, lo, hi)` |

Division by zero yields `±Infinity` (or 0 for `0 / 0`), displayed as "—". Conditions treat non-finite values as false. Numbers are evaluated in the "illustrative" spirit: the simulator shows a "Figures are illustrative." footnote.

## budget-allocator

| Path                             | Type                       | Default         | Description                                                                                                                |
| -------------------------------- | -------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `content.totalBudget`            | number > 0                 | required        | Budget to split, in `content.currency`.                                                                                    |
| `content.currency`               | 3-letter code              | `"USD"`         |                                                                                                                            |
| `content.kpiLabel`               | string 1–40                | required        | What the channels produce, e.g. `"Conversions"`.                                                                           |
| `content.channels[]`             | 3–8                        | required        |                                                                                                                            |
| `content.channels[].id`          | id                         | required        | Unique within the module.                                                                                                  |
| `content.channels[].label`       | string ≤ 80                | required        |                                                                                                                            |
| `content.channels[].description` | string ≤ 200               | —               | One line under the label.                                                                                                  |
| `content.channels[].color`       | token or CSS colour        | palette         | `accent`, `info`, `success`, `warning`, `pink`, `violet` (also `lime`, `sky`, `danger`) or any CSS colour.                 |
| `content.channels[].efficiency`  | number > 0                 | required        | KPI units per 1,000 of currency for the first 1,000 spent.                                                                 |
| `content.channels[].saturation`  | number 0.3–1               | required        | Diminishing-returns exponent. Output = `efficiency × (spend / 1000) ^ saturation`; `1` is linear.                          |
| `content.channels[].min`, `max`  | number 0–100               | —               | Share bounds in percent. `min ≤ max`; all minimums ≤ 100, all maximums ≥ 100.                                              |
| `content.initial`                | `{ [channelId]: percent }` | required        | Starting split. Every channel listed, no unknown ids, each a multiple of `behavior.step` and within its bounds, sum = 100. |
| `content.goal.description`       | text                       | required if set |                                                                                                                            |
| `content.goal.minKpi`            | number > 0                 | —               | Total KPI must reach this. At least one of `minKpi` / `maxCostPerKpi` is required.                                         |
| `content.goal.maxCostPerKpi`     | number > 0                 | —               | Spend ÷ KPI must stay at or below this.                                                                                    |
| `content.explanation`            | text                       | —               | Shown after the learner locks in the plan.                                                                                 |
| `behavior.step`                  | number > 0, ≤ 50           | `5`             | Slider and button increment in percent. Must divide 100 evenly.                                                            |
| `behavior.allowLock`             | boolean                    | `true`          | Lock toggles keep a channel's share fixed while others rebalance.                                                          |
| `behavior.showOptimal`           | boolean                    | `true`          | Reveal the optimal plan next to the learner's after locking in.                                                            |
| `behavior.scoreAgainstOptimal`   | boolean                    | `true`          | Score = learner KPI ÷ optimal KPI. When `false`: progress towards the goal (or no score without a goal).                   |

```json
{
  "id": "spring-media-plan",
  "type": "budget-allocator",
  "content": {
    "totalBudget": 120000,
    "kpiLabel": "Conversions",
    "channels": [
      { "id": "display", "label": "Programmatic display", "efficiency": 100, "saturation": 0.62 },
      {
        "id": "ctv",
        "label": "Premium CTV",
        "color": "violet",
        "efficiency": 33,
        "saturation": 0.9
      },
      {
        "id": "search",
        "label": "Search & social",
        "efficiency": 360,
        "saturation": 0.48,
        "max": 45
      }
    ],
    "initial": { "display": 35, "ctv": 35, "search": 30 },
    "goal": { "description": "Reach **4,050 conversions**.", "minKpi": 4050 }
  },
  "behavior": { "step": 5 }
}
```

Moving one slider rebalances the other unlocked channels in proportion to their current share (respecting min/max, on the `step` grid), so the plan always totals 100%. The optimum is found greedily: every increment goes to the channel with the highest marginal KPI. Exported helpers: `channelOutput`, `evaluateAllocation`, `rebalance`, `optimalAllocation`, `allocationScore`.

## estimate

| Path                              | Type                                             | Default         | Description                                                             |
| --------------------------------- | ------------------------------------------------ | --------------- | ----------------------------------------------------------------------- |
| `content.questions[]`             | 1–20                                             | required        |                                                                         |
| `content.questions[].id`          | id                                               | —               | Unique within the module when set.                                      |
| `content.questions[].prompt`      | text                                             | required        |                                                                         |
| `content.questions[].context`     | text                                             | —               | Supporting line under the prompt.                                       |
| `content.questions[].min`, `max`  | number                                           | required        | `max` > `min`.                                                          |
| `content.questions[].step`        | number > 0                                       | `1`             | Slider increment; not larger than the range.                            |
| `content.questions[].answer`      | number                                           | required        | Within `[min, max]`.                                                    |
| `content.questions[].format`      | `number` \| `percent` \| `currency` \| `integer` | `number`        | `percent` values are fractions: `0.028` is 2.8%.                        |
| `content.questions[].unit`        | string ≤ 24                                      | —               | Suffix, e.g. `"×"` (hugs the number) or `"clicks"` (spaced).            |
| `content.questions[].tolerance`   | number > 0                                       | 5% of the range | Bullseye distance. Within 3× tolerance is "close"; beyond is "way off". |
| `content.questions[].explanation` | text                                             | —               | Shown after the reveal.                                                 |
| `content.questions[].hint`        | text                                             | —               | Optional hint before locking in.                                        |
| `content.currency`                | 3-letter code                                    | `"USD"`         |                                                                         |
| `behavior.showCounter`            | boolean                                          | `true`          | Question counter and progress bar (hidden for a single question).       |

```json
{
  "id": "benchmark-instincts",
  "type": "estimate",
  "content": {
    "questions": [
      {
        "prompt": "What was the account-wide **CTR** in March?",
        "min": 0,
        "max": 0.1,
        "step": 0.001,
        "answer": 0.028,
        "format": "percent",
        "tolerance": 0.004,
        "explanation": "2.8% — 28 clicks per 1,000 impressions."
      },
      {
        "prompt": "What **ROAS** did paid search deliver?",
        "min": 0,
        "max": 10,
        "step": 0.1,
        "answer": 4.1,
        "unit": "×",
        "tolerance": 0.3
      }
    ]
  }
}
```

Score per question: 1 within the tolerance, falling linearly to 0 at 30% of the range away from the answer; the module score is the average. `correct` counts bullseyes. Exported helpers: `estimateAccuracy`, `estimateTolerance`, `formatEstimate`, `formatEstimateDelta`.

## label-diagram

| Path                                                    | Type            | Default  | Description                                                                             |
| ------------------------------------------------------- | --------------- | -------- | --------------------------------------------------------------------------------------- |
| `content.image`                                         | Media           | required | Include `width` / `height` so the zones line up before the image loads.                 |
| `content.targets[]`                                     | 2–12            | required | Drop zones, numbered in this order.                                                     |
| `content.targets[].id`                                  | id              | required | Unique.                                                                                 |
| `content.targets[].x`, `y`                              | number 0–100    | required | Anchor point in percent of the image width / height.                                    |
| `content.targets[].label`                               | string 1–80     | required | The correct label. Labels are unique (case-insensitive) across targets and distractors. |
| `content.targets[].explanation`                         | text            | —        | Shown on the completion card.                                                           |
| `content.distractors`                                   | string[] ≤ 8    | `[]`     | Extra labels that belong nowhere.                                                       |
| `content.explanation`                                   | text            | —        | General note on the completion card.                                                    |
| `behavior.allowRetry`, `maxAttempts`, `showExplanation` | retry behaviour |          | Correct labels stay locked on a retry; the right labels show when attempts run out.     |
| `behavior.shuffle`                                      | boolean         | `true`   | Shuffle the label tray.                                                                 |
| `behavior.shuffleSeed`                                  | integer         | —        |                                                                                         |

```json
{
  "id": "ad-anatomy",
  "type": "label-diagram",
  "content": {
    "image": {
      "src": "/img/banner.png",
      "alt": "Spring sale banner",
      "width": 1200,
      "height": 700
    },
    "targets": [
      { "id": "logo", "x": 25, "y": 9, "label": "Logo", "explanation": "Who is talking." },
      { "id": "cta", "x": 28, "y": 71, "label": "Call to action" }
    ],
    "distractors": ["Tracking pixel"]
  }
}
```

Zones sit on the image (pointing toward its centre) in containers ≥ 600px wide and become a numbered list below it on narrower ones. Score: 1 when all labels are right on the first check, −0.25 per extra attempt down to 0.5; otherwise the fraction right on the first check. Exported helpers: `evaluateLabelDiagram`, `labelDiagramChips`, `labelDiagramScore`.

## image-compare

| Path                           | Type                | Default    | Description                                                                   |
| ------------------------------ | ------------------- | ---------- | ----------------------------------------------------------------------------- |
| `content.before.image`         | Media               | required   | Use the same aspect ratio for both images.                                    |
| `content.before.label`         | string 1–40         | `"Before"` | Corner chip and slider value text.                                            |
| `content.after.image`          | Media               | required   |                                                                               |
| `content.after.label`          | string 1–40         | `"After"`  |                                                                               |
| `content.annotations[]`        | 0–8                 | `[]`       | Notes pinned to one side; visible only while that side is revealed.           |
| `content.annotations[].id`     | id                  | required   | Unique.                                                                       |
| `content.annotations[].x`, `y` | number 0–100        | required   | Position in percent.                                                          |
| `content.annotations[].side`   | `before` \| `after` | required   |                                                                               |
| `content.annotations[].title`  | string 1–120        | required   |                                                                               |
| `content.annotations[].text`   | text                | required   |                                                                               |
| `content.question`             | object              | —          | Optional check shown after exploring.                                         |
| `content.question.prompt`      | text                | required   |                                                                               |
| `content.question.options[]`   | 2–5                 | required   | `{ id?, text, correct?, explanation? }`; ≥ 1 correct, several = select all.   |
| `content.question.explanation` | text                | —          | Shown once answered correctly.                                                |
| `content.takeaway`             | text                | —          | Key message on the completion card.                                           |
| `behavior.initialPosition`     | number 0–100        | `50`       | Starting divider position (percent of the width showing the before image).    |
| `behavior.requireExplore`      | boolean             | `true`     | Drag to ≤ 15% and ≥ 85% at least once, or open every note, before continuing. |

```json
{
  "id": "landing-redesign",
  "type": "image-compare",
  "content": {
    "before": {
      "image": { "src": "/img/old.png", "alt": "Old landing page", "width": 1200, "height": 800 }
    },
    "after": {
      "image": { "src": "/img/new.png", "alt": "New landing page", "width": 1200, "height": 800 }
    },
    "annotations": [
      {
        "id": "form",
        "x": 83,
        "y": 50,
        "side": "before",
        "title": "Nine fields",
        "text": "Too much effort."
      }
    ],
    "question": {
      "prompt": "Which change mattered most?",
      "options": [{ "text": "The shorter form", "correct": true }, { "text": "The new colours" }]
    },
    "takeaway": "Remove friction before adding persuasion."
  }
}
```

The divider is a slider (Arrow keys ±5, Page Up / Down ±20, Home / End) and can be dragged anywhere on the image; vertical page scrolling still works on touch. With a question, score = 1 on the first correct check, −0.25 per extra attempt (wrong options are struck out between attempts). Without one the module completes with no score once explored (or with a Finish button when `requireExplore` is false). Exported helpers: `compareKeyStep`, `isAnnotationRevealed`, `compareExploreProgress`.

## word-builder

| Path                                                    | Type                    | Default    | Description                                                             |
| ------------------------------------------------------- | ----------------------- | ---------- | ----------------------------------------------------------------------- |
| `content.items[]`                                       | 1–10                    | required   |                                                                         |
| `content.items[].id`                                    | id                      | —          | Unique within the module when set.                                      |
| `content.items[].prompt`                                | text                    | required   | What to build.                                                          |
| `content.items[].tokens[]`                              | string[] 2–14           | required   | The correct answer, one tile per token, in order. No empty tokens.      |
| `content.items[].alternatives[][]`                      | string[][] ≤ 10         | —          | Other accepted orders; each uses exactly the same tokens.               |
| `content.items[].distractors[]`                         | string[] ≤ 10           | `[]`       | Extra tiles that do not belong.                                         |
| `content.items[].display`                               | `sentence` \| `formula` | `sentence` | `formula` uses the display face and highlights `=`, `÷`, `×`, `+`, `−`. |
| `content.items[].hint`                                  | text                    | —          |                                                                         |
| `content.items[].explanation`                           | text                    | —          | Shown once the item is solved or revealed.                              |
| `behavior.allowRetry`, `maxAttempts`, `showExplanation` | retry behaviour         |            | `maxAttempts` is per item.                                              |
| `behavior.shuffleSeed`                                  | integer                 | —          | Deterministic tile order.                                               |
| `behavior.showCounter`                                  | boolean                 | `true`     | Item counter and progress bar (hidden for a single item).               |

```json
{
  "id": "build-it-right",
  "type": "word-builder",
  "content": {
    "items": [
      {
        "prompt": "Build the formula for **ROAS**.",
        "tokens": ["ROAS", "=", "Revenue", "÷", "Ad spend"],
        "distractors": ["Clicks", "×"],
        "display": "formula"
      },
      {
        "prompt": "Put the kickoff rule in order.",
        "tokens": ["Confirm", "the", "brief", "before", "you", "build"],
        "distractors": ["after"]
      }
    ]
  }
}
```

Tokens are compared by value (trimmed, case-sensitive), so duplicate tokens such as two "the" tiles are interchangeable. Each tile is marked against the best-matching accepted order; a retry keeps the correct leading tiles. Item score: 1 first time, −0.25 per extra attempt (floor 0.5), or half the last partial score when unsolved; the module score is the average. Exported helpers: `evaluateWordOrder`, `buildWordTiles`, `isOperatorToken`, `scoreWordItem`.

## priority-matrix

| Path                                                    | Type                                                         | Default  | Description                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------ | -------- | -------------------------------------------------------------- |
| `content.axes.x`, `content.axes.y`                      | `{ label, low, high }`                                       | required | Axis name and end labels. x runs left → right, y bottom → top. |
| `content.quadrants[]`                                   | exactly 4                                                    | required | Each position used once.                                       |
| `content.quadrants[].id`                                | id                                                           | required | Unique.                                                        |
| `content.quadrants[].position`                          | `top-left` \| `top-right` \| `bottom-left` \| `bottom-right` | required | Top = high y, right = high x.                                  |
| `content.quadrants[].label`                             | string 1–40                                                  | required | Shown large, e.g. "Do now".                                    |
| `content.quadrants[].description`                       | text                                                         | —        |                                                                |
| `content.quadrants[].color`                             | string ≤ 40                                                  | —        | `accent`, `lime`, `pink`, `sky`, `violet` or any CSS colour.   |
| `content.items[]`                                       | 3–16                                                         | required |                                                                |
| `content.items[].id`                                    | id                                                           | required | Unique.                                                        |
| `content.items[].text`                                  | text                                                         | required |                                                                |
| `content.items[].quadrantId`                            | id                                                           | required | Must match a quadrant.                                         |
| `content.items[].explanation`                           | text                                                         | —        | Shown after checking.                                          |
| `content.explanation`                                   | text                                                         | —        | Shown when solved or revealed.                                 |
| `behavior.allowRetry`, `maxAttempts`, `showExplanation` | retry behaviour                                              |          |                                                                |
| `behavior.shuffle`                                      | boolean                                                      | `true`   | Shuffle the tray.                                              |
| `behavior.shuffleSeed`                                  | integer                                                      | —        |                                                                |

```json
{
  "id": "monday-triage",
  "type": "priority-matrix",
  "content": {
    "axes": {
      "x": { "label": "Urgency", "low": "low", "high": "high" },
      "y": { "label": "Importance", "low": "low", "high": "high" }
    },
    "quadrants": [
      { "id": "schedule", "position": "top-left", "label": "Schedule" },
      { "id": "do-now", "position": "top-right", "label": "Do now", "color": "pink" },
      { "id": "drop", "position": "bottom-left", "label": "Drop" },
      { "id": "delegate", "position": "bottom-right", "label": "Delegate" }
    ],
    "items": [
      { "id": "tracking", "text": "Tracking is broken on a live campaign", "quadrantId": "do-now" },
      { "id": "deck", "text": "Draft next quarter's strategy deck", "quadrantId": "schedule" },
      { "id": "export", "text": "Pull a routine weekly export", "quadrantId": "delegate" }
    ]
  }
}
```

Score: the first-check fraction, or — when everything ends up correct without revealing — 1 on the first attempt, −0.25 per extra attempt (floor 0.5), never below the first-check fraction. Exported helpers: `evaluatePriorityMatrix`, `quadrantCell`, `sortQuadrants`, `priorityMatrixScore`.

## inbox-triage

| Path                               | Type                                                                 | Default   | Description                                                       |
| ---------------------------------- | -------------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `content.owner.name`               | string ≤ 80                                                          | required  | Whose inbox it is.                                                |
| `content.owner.role`               | string ≤ 80                                                          | —         |                                                                   |
| `content.actions[]`                | 2–5                                                                  | required  | The decisions available for every message.                        |
| `content.actions[].id`             | id                                                                   | required  | Unique within the module.                                         |
| `content.actions[].label`          | string ≤ 40                                                          | required  | e.g. "Reply now".                                                 |
| `content.actions[].description`    | string ≤ 160                                                         | —         | When to use it (tooltip, screen readers, empty reading pane).     |
| `content.actions[].icon`           | `reply` \| `forward` \| `calendar` \| `archive` \| `flag` \| `alert` | —         |                                                                   |
| `content.actions[].tone`           | `accent` \| `lime` \| `pink` \| `sky` \| `violet`                    | neutral   | `lime` uses the theme's highlight colour.                         |
| `content.messages[]`               | 3–12                                                                 | required  | Shown in this order.                                              |
| `content.messages[].id`            | id                                                                   | required  | Unique within the module.                                         |
| `content.messages[].from`          | `{ name, role?, email? }`                                            | required  |                                                                   |
| `content.messages[].subject`       | string ≤ 200                                                         | required  |                                                                   |
| `content.messages[].preview`       | string ≤ 280                                                         | required  | One-line teaser in the list.                                      |
| `content.messages[].body`          | text                                                                 | required  | Blank lines separate paragraphs.                                  |
| `content.messages[].time`          | string ≤ 24                                                          | required  | Shown as-is, e.g. `"08:57"` or `"Fri"`.                           |
| `content.messages[].flags`         | (`vip` \| `external` \| `attachment` \| `suspicious-link`)[] ≤ 4     | `[]`      |                                                                   |
| `content.messages[].correctAction` | action id                                                            | required  | The expert call.                                                  |
| `content.messages[].acceptable`    | action id[] ≤ 4                                                      | `[]`      | Partial credit (0.5); must not repeat `correctAction`.            |
| `content.messages[].explanation`   | text                                                                 | required  | Coaching after the decision and in the summary.                   |
| `content.summary`                  | text                                                                 | —         | Wrap-up on the summary screen.                                    |
| `behavior.feedback`                | `instant` \| `end`                                                   | `instant` | `end` hides coaching until the results; decisions can be changed. |
| `behavior.allowRetry`              | boolean                                                              | `true`    |                                                                   |
| `behavior.showScore`               | boolean                                                              | `true`    | Score ring on the summary.                                        |

```json
{
  "id": "monday-inbox",
  "type": "inbox-triage",
  "content": {
    "owner": { "name": "Jordan Reyes", "role": "Account Manager" },
    "actions": [
      { "id": "reply", "label": "Reply now", "icon": "reply", "tone": "accent" },
      { "id": "delegate", "label": "Delegate", "icon": "forward", "tone": "sky" },
      { "id": "archive", "label": "Archive", "icon": "archive" },
      { "id": "report", "label": "Report", "icon": "alert", "tone": "pink" }
    ],
    "messages": [
      {
        "id": "zero",
        "from": { "name": "Priya Nair", "role": "Marketing Lead, Harbor Supply Co." },
        "subject": "Conversions at zero since midnight?",
        "preview": "The dashboard shows zero purchases since 00:00…",
        "body": "Can you tell me what's going on before our 10:00?",
        "time": "08:57",
        "flags": ["vip", "external"],
        "correctAction": "reply",
        "explanation": "A VIP with a live problem and a deadline comes first."
      },
      {
        "id": "po",
        "from": { "name": "Helen Brooks", "role": "Finance" },
        "subject": "PO number missing",
        "preview": "We can't send the invoice without it…",
        "body": "Could someone send the PO by Wednesday?",
        "time": "08:15",
        "correctAction": "delegate",
        "acceptable": ["reply"],
        "explanation": "Your coordinator keeps the PO log."
      },
      {
        "id": "phish",
        "from": { "name": "Ads Support", "email": "security@adwave-busines.com" },
        "subject": "Verify your password",
        "preview": "Your account will be suspended…",
        "body": "Verify within 24 hours.",
        "time": "06:12",
        "flags": ["external", "suspicious-link"],
        "correctAction": "report",
        "explanation": "Lookalike domain and a password request."
      }
    ]
  }
}
```

Score: 1 point per expert call, 0.5 per acceptable call, 0 otherwise, divided by the number of messages; `correct` counts expert calls. A message is a _priority_ when it is flagged `vip` or `suspicious-link`, or its expert action has the `reply` or `alert` icon; priority messages that got a wrong call are listed in `details.missedPriority`. Exported helpers: `evaluateTriage`, `gradeTriageDecision`, `isPriorityMessage`, `nextUnhandledIndex`.
