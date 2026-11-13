# Accessibility and internationalisation

Nibblearn targets WCAG 2.2 AA. Every module is built on the same primitives and the same contract (see [custom modules](./custom-modules.md)), so the behaviours below are consistent across the library.

## Approach

- **Keyboard first.** Every interaction has a keyboard path. Drag-and-drop and swipe are enhancements layered on top of buttons and tap-to-select.
- **Semantic roles.** Answer options are `radio`/`checkbox` buttons with `aria-checked`; groups use `radiogroup`; sliders are native `<input type="range">` with `aria-valuetext`; progress bars expose their value; each module is a `<section>` labelled by its title.
- **Live announcements.** A polite live region in every module and in the player announces correct/incorrect, completion, navigation, drag state and progress.
- **Visible focus.** A 2px outline in `--nb-focus` with offset on `:focus-visible`, inherited by everything inside `.nb-root`.
- **No colour-only feedback.** Correct/incorrect states always pair colour with an icon (check/cross) and text.
- **Touch targets** of at least 44×44px (`--nb-touch-target`).
- **Reduced motion** honoured automatically and overridable.
- **Contrast.** Default light and dark palettes meet 4.5:1 for text and 3:1 for UI components; feedback tones use dedicated `-soft-fg` foregrounds on `-soft` backgrounds. If you override tokens ([Theming](./theming.md)), re-check contrast for `--nb-accent-fg` on `--nb-accent` and each `-soft-fg` on its `-soft`.
- **Invalid content never crashes.** A bad config renders an `role="alert"` panel listing the issues.

The showcase runs axe (`@axe-core/playwright`) across all module pages in CI.

## Keyboard map

Tab/Shift+Tab move between controls everywhere; Enter/Space activate buttons. The table lists the extras each module adds when focus is inside the module.

| Module                 | Keys                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lesson player          | Tab to Back/Next/Finish. Focus moves to the new activity after navigation.                                                                                                                              |
| story-cards            | `→` next card, `←` previous card. Embedded checks are radio buttons.                                                                                                                                    |
| flashcards             | `Space`/`Enter` flip the card. When flipped: `→` = Got it, `←` = Practice again. Shuffle, hint and rating are buttons.                                                                                  |
| choice-challenge       | `A`–`H` or `1`–`8` select an option; `Enter` checks, then advances. Options are `radio`/`checkbox` buttons.                                                                                             |
| true-false             | `→` or `T` = true, `←` or `F` = false; `Enter` continues after the explanation. Buttons are always visible.                                                                                             |
| match-pairs            | Tap-to-connect: `Enter`/`Space` on a left tile, then on a right tile. Drag is optional; dnd-kit keyboard sensor: `Space` pick up, arrows move, `Space` drop, `Esc` cancel.                              |
| sequence-builder       | Each item has Move up / Move down buttons. Drag alternative: `Space`/`Enter` pick up, `↑`/`↓` move, `Space`/`Enter` drop, `Esc` cancel.                                                                 |
| category-sort          | Select an item, then a category (buttons). Each placed item has a remove button. Drag alternative with the same dnd-kit keys as above.                                                                  |
| fill-blanks            | Word bank: `Enter`/`Space` on a word fills the selected (or next empty) blank; activating a filled blank puts the word back. Typed mode: `Enter` in any field checks (or retries after a wrong answer). |
| hotspot-explorer       | Markers are buttons in reading order plus an accessible list of hotspots; `Esc` closes the open panel.                                                                                                  |
| screenshot-walkthrough | The target is a focusable button on the image; `Enter`/`Space` activates it. `type` steps: type then `Enter`. "Show me" button highlights the target.                                                   |
| branching-scenario     | Choices are buttons; `Enter` continues after feedback.                                                                                                                                                  |
| conversation           | `1`–`5` choose a reply (when replies are shown). Replies are buttons.                                                                                                                                   |
| process-explorer       | `→`/`↓` next stage, `←`/`↑` previous, `Home`/`End` first/last. Stages are buttons; the detail panel has Previous/Next stage.                                                                            |
| spot-the-mistake       | Regions/rows are buttons (`Select {label}`); `submit` mode adds a Check button. Hints are buttons.                                                                                                      |
| what-if-simulator      | Native range sliders: arrows step, `Page Up/Down` big steps, `Home`/`End` min/max. Plus/minus buttons beside each slider. Reset to defaults button.                                                     |
| budget-allocator       | One native range slider per channel (value text "35% · $42,000"); plus/minus buttons beside each; lock toggles (`aria-pressed`). Focus moves to the results heading after "Lock in plan".               |
| estimate               | Native range slider (arrows, `Page Up/Down`, `Home`/`End`) plus a labelled exact-value field; `Enter` locks in, then advances. Focus moves to Next after the reveal and back to the slider afterwards.  |

## Screen reader announcements

Announcements are routed through `LiveRegion` (`role="status"`, `aria-live="polite"`, `aria-atomic`). Each module announces at least:

- Correct / incorrect / partially correct after a check (`a11y.correctAnswer`, `a11y.incorrectAnswer`).
- Progress changes such as "3 of 8 matched", "Moved {item} to position {position}", "{item} placed in {category}", "Picked up {item}", "Dropping cancelled".
- Completion (`a11y.moduleComplete`), plus the score summary text shown on the completion card (`role="status"`).
- Player: "Activity N of M" on navigation and "Lesson complete" on finish.

Drag sources carry `a11y.dragInstructions` ("Press Space or Enter to pick up an item, use the arrow keys to move it, and press Space or Enter again to drop."). Images use `SafeImage`, which renders the `alt` text and an "Image unavailable" fallback when loading fails; use `"alt": ""` for decorative images.

In custom modules, call `announce()` from `useAnnounce()` and pass the message to `ModuleShell`'s `announcement` prop. Use `<Feedback live>` for feedback panels that should be read on appearance.

## Reduced motion

- `prefers-reduced-motion: reduce` sets all `--nb-duration-*` tokens to `0ms`; components also read `useReducedMotion()` and skip entrance, exit, flip and confetti animations.
- `NibblearnProvider reducedMotion` forces it (sets `data-nb-motion="reduced"` and configures Motion's `MotionConfig reducedMotion="always"`).
- Typing indicators in `conversation` still delay messages (content pacing, not decoration); set `delayMs: 0` on messages if you want instant delivery.

## Colour and contrast

- Status is always conveyed by icon + text + colour. Option cards show check/cross marks; the summary list shows pass/fail icons; insights show a tone icon.
- The dark theme uses lighter accent and feedback colours with dark foregrounds on solid fills to keep 4.5:1.
- `color-scheme` is set per theme so native inputs, scrollbars and range sliders are legible.
- Secondary text (`--nb-fg-subtle`) is tuned to at least 4.5:1 on every surface in both themes (`#636b7c` light, `#8a92a3` dark). Every module page is checked with axe (WCAG 2.2 AA tags) in the end-to-end suite.
- The base reset uses zero-specificity selectors (`:where(.nb-root) …`), so module styles and your overrides always win regardless of stylesheet order.
- When using `appearance.accent` or `category.color` with custom colours, pick values that keep white (`--nb-accent-fg`) readable or override `--nb-accent-fg` too.

## Touch and pointer

- Minimum target size 44px for buttons, option cards, markers, chips and slider thumbs.
- `touch-action: manipulation` removes tap delay; swipe (true-false) uses pointer events with a threshold and never blocks vertical scrolling.
- Everything that can be dragged or swiped can also be tapped or clicked: tap-to-connect pairs, tap-item-then-category, Move up/down buttons, True/False buttons.

## Responsive and zoom

Layouts are mobile-first and tested at 320px; text reflows at 200% zoom without horizontal scrolling. Modules use container queries, so they adapt to the width of their container, not the viewport.

## Internationalisation

### Locale

```tsx
<NibblearnProvider locale="en-GB">…</NibblearnProvider>
<LessonPlayer lesson={lesson} locale="en-GB" />
```

The built-in locale is English (`en`); other languages are added through `messages` (see below). `LessonPlayer` defaults to the lesson's `language` field. Unknown locales fall back to the base language (`"de-AT"` → `"de"`) and then to English, key by key.

Interpolation uses `{name}` placeholders (`"{current} of {total}"`). Number and currency formatting in the simulator uses `Intl.NumberFormat` with the active locale.

### Overriding strings

Pass a partial `messages` object to change any key for the current locale:

```tsx
<NibblearnProvider
  locale="en"
  messages={{ "lesson.start": "Begin", "flash.gotIt": "Know it", "flash.practiceAgain": "Not yet" }}
>
```

### Adding a locale

Provide the full message set (or as much as you have; missing keys fall back to English) through `messages` with a new `locale` value:

```ts
// i18n/de.ts
import type { Messages } from "@nibblearn/core";
import { en } from "@nibblearn/core";

export const de: Messages = {
  ...en, // fallback for keys you have not translated yet
  "common.next": "Weiter",
  "common.back": "Zurück",
  "common.check": "Prüfen",
  "common.correct": "Richtig",
  "common.incorrect": "Nicht ganz",
  "lesson.start": "Lektion starten",
  // …
};
```

```tsx
<NibblearnProvider locale="de" messages={de}>
  …
</NibblearnProvider>
```

Because `locale` is also passed to `Intl.NumberFormat`, use a real BCP-47 tag.

### Key list

All keys live in `packages/core/src/i18n/en.ts` and are exported as the `MessageKey` type (`Messages` is `Record<MessageKey, string>`). Groups: `common.*` (buttons, labels, counters), `a11y.*` (announcements and drag instructions), `lesson.*` (player), and one group per module: `story.*`, `flash.*`, `choice.*`, `tf.*`, `match.*`, `seq.*`, `sort.*`, `fill.*`, `hotspot.*`, `walk.*`, `scenario.*`, `conv.*`, `process.*`, `spot.*`, `sim.*`. TypeScript will flag any unknown key in `messages`.

### Content language

UI strings and content are independent. Set `lesson.language` to the content language; the player uses it as the default UI locale, but you can override with the `locale` prop (for example German UI chrome around English content, once you provide German `messages`). Module labels that are part of the content (`trueLabel`/`falseLabel`, `leftLabel`/`rightLabel`, `intro.cta`, category labels) are authored in the content language inside the JSON.
