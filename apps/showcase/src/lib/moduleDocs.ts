import type { ModuleCategory } from "@nibblearn/core";

export interface OptionDoc {
  path: string;
  type: string;
  default?: string;
  description: string;
}

export interface ModuleDoc {
  type: string;
  name: string;
  tagline: string;
  category: ModuleCategory;
  icon: string;
  description: string;
  useCases: string[];
  interactions: string[];
  accessibility: string[];
  options: OptionDoc[];
  /** Optional: wider demo frame. */
  wide?: boolean;
}

const base: OptionDoc[] = [
  { path: "id", type: "string", description: "Unique id within the lesson." },
  { path: "title", type: "string", description: "Heading shown above the activity." },
  {
    path: "instructions",
    type: "string",
    description: "Short instruction under the title. Supports **bold**, *italic*, `code`.",
  },
  {
    path: "feedback.correct / incorrect / complete",
    type: "string",
    description: "Custom feedback messages.",
  },
  {
    path: "scoring.weight",
    type: "number",
    default: "1",
    description: "Relative weight in the lesson score.",
  },
  {
    path: "scoring.passThreshold",
    type: "number",
    default: "0",
    description: "Minimum score (0–1) to pass.",
  },
  {
    path: "appearance.accent",
    type: "CSS color",
    description: "Accent override for this module only.",
  },
  { path: "appearance.compact", type: "boolean", default: "false", description: "Denser layout." },
  {
    path: "appearance.hideHeader",
    type: "boolean",
    default: "false",
    description: "Hide title and instructions.",
  },
];

const retry: OptionDoc[] = [
  {
    path: "behavior.allowRetry",
    type: "boolean",
    default: "true",
    description: "Allow another attempt after an incorrect answer.",
  },
  {
    path: "behavior.maxAttempts",
    type: "number",
    default: "0 (unlimited)",
    description: "Attempts before the solution is revealed.",
  },
  {
    path: "behavior.showExplanation",
    type: "boolean",
    default: "true",
    description: "Show explanations after checking.",
  },
];

export const moduleDocs: ModuleDoc[] = [
  {
    type: "story-cards",
    name: "Story Cards",
    tagline: "Bite-sized micro lessons that read like a story.",
    category: "learn",
    icon: "BookOpen",
    description:
      "A card-based micro-learning format inspired by mobile stories. Each card carries one idea — a title, a short body revealed paragraph by paragraph, an optional image, a stat or a quote — and can embed a quick knowledge check. Perfect for welcomes, policies and concept introductions.",
    useCases: [
      "Welcome and onboarding sequences",
      "Explaining a policy in five cards",
      "Introducing a concept before a practice activity",
      "Short product or team updates",
    ],
    interactions: [
      "Next / Back buttons and ← → keys",
      "Progressive paragraph reveal",
      "Expandable “Learn more” section",
      "Embedded knowledge check with instant feedback",
      "Completion state at the end",
    ],
    accessibility: [
      "Cards are regions with headings; progress is announced",
      "Checks use radio semantics with visible focus",
      "Reveal animations are disabled with reduced motion",
      "All navigation is keyboard reachable",
    ],
    options: [
      ...base,
      {
        path: "content.cards[]",
        type: "StoryCard[]",
        description: "Cards in reading order (1–60).",
      },
      {
        path: "content.cards[].layout",
        type: '"default" | "cover" | "quote" | "stat"',
        default: '"default"',
        description: "Visual treatment.",
      },
      {
        path: "content.cards[].body",
        type: "string",
        description: "Paragraphs separated by blank lines.",
      },
      { path: "content.cards[].image", type: "Media", description: "Optional image { src, alt }." },
      {
        path: "content.cards[].expandable",
        type: "{ label, body }",
        description: "Optional expandable section.",
      },
      {
        path: "content.cards[].check",
        type: "{ question, options[], explanation }",
        description: "Optional embedded quick check.",
      },
      {
        path: "behavior.progressiveReveal",
        type: "boolean",
        default: "true",
        description: "Stagger paragraph reveal.",
      },
      {
        path: "behavior.allowBack",
        type: "boolean",
        default: "true",
        description: "Show the Back button.",
      },
      {
        path: "behavior.requireChecks",
        type: "boolean",
        default: "true",
        description: "Checks must be answered before moving on.",
      },
    ],
  },
  {
    type: "flashcards",
    name: "Flashcards",
    tagline: "Flip, sort, and review until everything sticks.",
    category: "learn",
    icon: "Layers",
    description:
      "Classic flashcards with a modern feel: a tactile 3D flip, “Got it” / “Practice again” sorting, shuffle, and automatic review rounds for the cards you did not know. Scores reflect first-pass mastery, so the activity rewards honest self-assessment.",
    useCases: [
      "Learning terminology and acronyms",
      "Memorising definitions, formulas or product names",
      "Spaced review of previously learned concepts",
    ],
    interactions: [
      "Tap / Space / Enter to flip",
      "← Practice again, → Got it",
      "Shuffle and restart",
      "Review rounds until every card is mastered",
      "Deck progress and counters",
    ],
    accessibility: [
      "The card is a button with a descriptive label",
      "Flip falls back to a crossfade with reduced motion",
      "Progress and card position are announced",
      "Fully keyboard operable",
    ],
    options: [
      ...base,
      {
        path: "content.cards[]",
        type: "{ front, back, frontImage?, backImage?, hint?, tag? }[]",
        description: "Cards (1–200).",
      },
      {
        path: "behavior.shuffle",
        type: "boolean",
        default: "false",
        description: "Shuffle at start.",
      },
      {
        path: "behavior.allowShuffle",
        type: "boolean",
        default: "true",
        description: "Show the shuffle button.",
      },
      {
        path: "behavior.requireMastery",
        type: "boolean",
        default: "true",
        description: "Loop over “practice again” cards until all are mastered.",
      },
      {
        path: "behavior.autoFlip",
        type: "boolean",
        default: "false",
        description: "Show the back side immediately.",
      },
    ],
  },
  {
    type: "choice-challenge",
    name: "Choice Challenge",
    tagline: "Single and multiple choice, reimagined.",
    category: "practice",
    icon: "ListChecks",
    description:
      "One question per screen with large tactile answer cards, keyboard shortcuts, animated feedback, per-option explanations, optional partial credit and retries. It is the workhorse of knowledge checks — and it looks nothing like a 2010 quiz.",
    useCases: [
      "Knowledge checks after a lesson",
      "Scenario-style judgement questions",
      "Compliance refreshers",
      "Pre-assessments",
    ],
    interactions: [
      "Select with click or letter keys (A–H) / numbers",
      "Enter to check and advance",
      "Partial credit for multi-select",
      "Retry with hints and explanations",
      "Summary with per-question results",
    ],
    accessibility: [
      "Radio / checkbox semantics with aria-checked",
      "Correct / incorrect states use icons and text, never only colour",
      "Feedback is announced via a live region",
      "Focus moves to the Next button after checking",
    ],
    options: [
      ...base,
      { path: "content.questions[]", type: "Question[]", description: "Questions (1–50)." },
      {
        path: "content.questions[].mode",
        type: '"single" | "multiple"',
        description: "Inferred from the number of correct options when omitted.",
      },
      {
        path: "content.questions[].options[]",
        type: "{ text, correct?, image?, explanation? }[]",
        description: "2–8 options; at least one correct.",
      },
      {
        path: "content.questions[].explanation / hint",
        type: "string",
        description: "Shown after checking / on demand.",
      },
      ...retry,
      {
        path: "behavior.shuffleOptions",
        type: "boolean",
        default: "false",
        description: "Shuffle answer order.",
      },
      {
        path: "behavior.partialCredit",
        type: "boolean",
        default: "true",
        description: "Partial score for partially correct multi-select answers.",
      },
      {
        path: "behavior.showCounter",
        type: "boolean",
        default: "true",
        description: "Show “Question 2 of 5”.",
      },
    ],
  },
  {
    type: "true-false",
    name: "True / False",
    tagline: "Rapid-fire decisions with swipe or tap.",
    category: "practice",
    icon: "ToggleLeft",
    description:
      "A stack of statement cards answered with two big buttons — or a swipe. Each answer gets immediate explanatory feedback, and the summary shows what you got right. Swiping is a bonus, never a requirement.",
    useCases: [
      "Myth-busting (“A higher CTR always means more profit”)",
      "Quick policy recall",
      "Warm-ups before deeper practice",
    ],
    interactions: [
      "Tap True / False",
      "Swipe left or right (optional)",
      "← / → and T / F keys",
      "Explanation after each answer",
      "Summary with a review list",
    ],
    accessibility: [
      "Buttons are always available as an alternative to swiping",
      "Statements are announced when they appear",
      "Reduced motion disables drag physics",
      "Results pair colour with icons and text",
    ],
    options: [
      ...base,
      {
        path: "content.statements[]",
        type: "{ text, isTrue, explanation?, image?, tag? }[]",
        description: "Statements (1–100).",
      },
      {
        path: "behavior.swipe",
        type: "boolean",
        default: "true",
        description: "Enable swipe gestures.",
      },
      {
        path: "behavior.trueLabel / falseLabel",
        type: "string",
        default: '"True" / "False"',
        description: "Button labels (e.g. Yes / No).",
      },
      {
        path: "behavior.showExplanation",
        type: "boolean",
        default: "true",
        description: "Pause to show the explanation.",
      },
      {
        path: "behavior.shuffle",
        type: "boolean",
        default: "false",
        description: "Shuffle statements.",
      },
    ],
  },
  {
    type: "match-pairs",
    name: "Match the Pairs",
    tagline: "Connect terms and definitions, fast.",
    category: "practice",
    icon: "GitCompareArrows",
    description:
      "Two shuffled columns of tiles. Tap one on each side (or drag) to connect them; correct pairs lock in and clear away, mistakes shake and count. Rounds keep the board small, and an optional timer adds a friendly challenge.",
    useCases: [
      "Metrics and definitions",
      "Tools and their purpose",
      "Roles and responsibilities",
      "Vocabulary in any domain",
    ],
    interactions: [
      "Tap-to-connect",
      "Drag a term onto a definition",
      "Rounds of up to N pairs",
      "Optional timer",
      "Shuffle and restart",
    ],
    accessibility: [
      "Every tile is a button; drag is optional",
      "Matches and mistakes are announced",
      "Selected / matched states are visible and labelled",
      "No time pressure unless the timer is enabled",
    ],
    options: [
      ...base,
      {
        path: "content.pairs[]",
        type: "{ left, right, explanation? }[]",
        description: "Pairs (2–30).",
      },
      { path: "content.leftLabel / rightLabel", type: "string", description: "Column headings." },
      {
        path: "behavior.shuffle",
        type: "boolean",
        default: "true",
        description: "Shuffle both columns.",
      },
      {
        path: "behavior.timer",
        type: "boolean",
        default: "false",
        description: "Show an elapsed-time counter.",
      },
      {
        path: "behavior.pairsPerRound",
        type: "number",
        default: "6",
        description: "Pairs visible at once.",
      },
      {
        path: "behavior.drag",
        type: "boolean",
        default: "true",
        description: "Enable drag-and-drop.",
      },
    ],
  },
  {
    type: "sequence-builder",
    name: "Sequence Builder",
    tagline: "Put the steps in the right order.",
    category: "practice",
    icon: "ListOrdered",
    description:
      "Shuffled steps that learners reorder by dragging or with up/down buttons. Checking marks each position, retries keep the order, and the solution view explains why each step belongs where it is.",
    useCases: [
      "Process and workflow training",
      "Launch checklists",
      "Escalation procedures",
      "Any ordered method",
    ],
    interactions: [
      "Drag and drop (mouse, touch)",
      "Keyboard sorting with Space + arrows",
      "Move up / down buttons",
      "Check, retry, reveal the correct order",
    ],
    accessibility: [
      "dnd-kit keyboard sensor with spoken instructions",
      "Button alternative for every move",
      "Position changes are announced",
      "Correct / incorrect states use icons and text",
    ],
    options: [
      ...base,
      {
        path: "content.items[]",
        type: "{ id, text, description? }[]",
        description: "Items in the correct order (2–15).",
      },
      {
        path: "content.explanation / hint",
        type: "string",
        description: "Shown with the solution / on demand.",
      },
      ...retry,
      { path: "behavior.shuffleSeed", type: "number", description: "Deterministic shuffle seed." },
      {
        path: "behavior.showPositions",
        type: "boolean",
        default: "true",
        description: "Numbered positions.",
      },
    ],
  },
  {
    type: "category-sort",
    name: "Category Sort",
    tagline: "Drag items into the right buckets.",
    category: "practice",
    icon: "Columns3",
    description:
      "Items start in a pool and get sorted into up to six categories by dragging, or by tapping an item and then a category. After checking, wrong items explain where they belong and return to the pool for another try.",
    useCases: [
      "Which team owns what",
      "Classifying channels, formats or metrics",
      "Do / don’t policies",
      "Triage exercises",
    ],
    interactions: [
      "Drag items into categories",
      "Tap an item, then tap a category",
      "Move items back or between categories",
      "Check, retry, reveal",
    ],
    accessibility: [
      "Tap-to-assign is a full alternative to dragging",
      "Categories are labelled drop targets",
      "Placements are announced",
      "Items show their correct category in text after checking",
    ],
    options: [
      ...base,
      {
        path: "content.categories[]",
        type: "{ id, label, description?, color? }[]",
        description: "2–6 categories.",
      },
      {
        path: "content.items[]",
        type: "{ id, text, categoryId, explanation? }[]",
        description: "2–40 items.",
      },
      ...retry,
      {
        path: "behavior.shuffle / shuffleSeed",
        type: "boolean / number",
        default: "true",
        description: "Shuffle the pool.",
      },
    ],
  },
  {
    type: "fill-blanks",
    name: "Fill in the Blanks",
    tagline: "Complete the sentence from a word bank — or type it.",
    category: "practice",
    icon: "TextCursorInput",
    description:
      "Sentences with blanks written as {{id}} in a template. Word-bank mode lets learners tap words into slots; typed mode accepts free text with lenient, case-insensitive matching and multiple accepted answers.",
    useCases: [
      "Formulas (ROAS = Revenue / ______)",
      "Key phrases in a process",
      "Naming conventions",
      "Language learning",
    ],
    interactions: [
      "Tap a word, then a slot (or the first empty slot)",
      "Remove a word from a slot",
      "Typed mode with Enter to check",
      "Per-blank hints and explanations",
    ],
    accessibility: [
      "Slots and words are labelled buttons / inputs",
      "Invalid blanks use aria-invalid and icons",
      "Focus moves to the next empty blank",
      "Keyboard-only completion is fully supported",
    ],
    options: [
      ...base,
      { path: "content.template", type: "string", description: "Text with blanks as {{id}}." },
      {
        path: "content.blanks[]",
        type: "{ id, answers[], hint?, explanation? }[]",
        description: "One entry per blank; first answer is shown in the bank.",
      },
      {
        path: "content.distractors[]",
        type: "string[]",
        default: "[]",
        description: "Extra wrong words for the bank.",
      },
      ...retry,
      {
        path: "behavior.mode",
        type: '"word-bank" | "typed"',
        default: '"word-bank"',
        description: "Interaction mode.",
      },
      {
        path: "behavior.caseSensitive / lenient",
        type: "boolean",
        default: "false / true",
        description: "Matching rules for typed answers.",
      },
      {
        path: "behavior.shuffleBank",
        type: "boolean",
        default: "true",
        description: "Shuffle the word bank.",
      },
    ],
  },
  {
    type: "hotspot-explorer",
    name: "Hotspot Explorer",
    tagline: "Explore an image, one hotspot at a time.",
    category: "explore",
    icon: "MousePointerClick",
    description:
      "Place numbered markers on any image using percentage coordinates — they scale perfectly on every screen. Each marker opens an information panel; an accessible list below the image offers the same content for keyboard and screen-reader users.",
    useCases: [
      "Tour of a dashboard or report",
      "Anatomy of a landing page or an ad",
      "Office or equipment orientation",
      "Annotated diagrams",
    ],
    interactions: [
      "Click markers to open panels",
      "Previous / next hotspot",
      "Visited state and progress",
      "Optional completion only after all are explored",
    ],
    accessibility: [
      "Markers are labelled buttons with aria-expanded",
      "A list alternative mirrors the markers",
      "Panels trap nothing; Escape closes and returns focus",
      "Pulsing stops with reduced motion",
    ],
    options: [
      ...base,
      {
        path: "content.image",
        type: "Media",
        description: "Background image { src, alt, width?, height? }.",
      },
      {
        path: "content.hotspots[]",
        type: "{ id, x, y, label, description, shape?, width?, height? }[]",
        description: "Positions in % of the image (1–30).",
      },
      {
        path: "behavior.requireAll",
        type: "boolean",
        default: "true",
        description: "Complete only after all hotspots were opened.",
      },
      {
        path: "behavior.numbered / pulse",
        type: "boolean",
        default: "true",
        description: "Numbered markers; pulse unvisited ones.",
      },
    ],
    wide: true,
  },
  {
    type: "screenshot-walkthrough",
    name: "Screenshot Walkthrough",
    tagline: "Guided, click-to-advance product tours.",
    category: "explore",
    icon: "AppWindow",
    description:
      "A simulated software environment built from screenshots. Each step spotlights a region and tells the learner what to do: click it, type into a simulated field, or just observe. Misses get gentle guidance; a “Show me” hint highlights the target.",
    useCases: [
      "Tool onboarding (CRM, analytics, ad platforms)",
      "Standard operating procedures in software",
      "Safe practice before touching real systems",
    ],
    interactions: [
      "Click the highlighted region",
      "Type into a simulated input",
      "Back / Next and step progress",
      "Hints after misses",
      "Completion with miss count",
    ],
    accessibility: [
      "Targets are real buttons with the instruction as label",
      "Tooltip content is read in order",
      "Keyboard reaches every control",
      "Spotlight uses contrast, not only colour",
    ],
    options: [
      ...base,
      {
        path: "content.steps[]",
        type: "Step[]",
        description: "Steps (1–40) with image, instruction and target rect (%).",
      },
      {
        path: "content.steps[].action",
        type: '"click" | "type" | "observe"',
        default: '"click"',
        description: "What the learner must do.",
      },
      {
        path: "content.steps[].input",
        type: "{ placeholder?, expected? }",
        description: "For type actions.",
      },
      { path: "content.summary", type: "string", description: "Completion message." },
      {
        path: "behavior.allowHint / autoHintAfterMisses",
        type: "boolean / number",
        default: "true / 2",
        description: "Hint behaviour.",
      },
      {
        path: "behavior.showStepNumbers / allowBack",
        type: "boolean",
        default: "true",
        description: "Navigation options.",
      },
    ],
    wide: true,
  },
  {
    type: "branching-scenario",
    name: "Branching Scenario",
    tagline: "Decisions with consequences and multiple endings.",
    category: "decide",
    icon: "GitBranch",
    description:
      "An interactive story defined as a graph of decision nodes and endings. Every choice can carry feedback, points and a quality rating; the decision history shows the path taken, and the scenario can be replayed to explore other branches. The graph is validated for broken references.",
    useCases: [
      "Client and stakeholder situations",
      "Ethics and compliance dilemmas",
      "Incident response and escalation",
      "Sales conversations",
    ],
    interactions: [
      "Choose with click or A–F keys",
      "Confirm, read feedback, continue",
      "Visual decision history",
      "Endings with outcome and summary",
      "Explore another path",
    ],
    accessibility: [
      "Choices use radio semantics",
      "History is a list with text labels for quality",
      "Transitions respect reduced motion",
      "Endings are announced",
    ],
    options: [
      ...base,
      { path: "content.start", type: "string", description: "Id of the first node." },
      {
        path: "content.nodes[]",
        type: "Node[]",
        description: "Decision and ending nodes (2–200).",
      },
      {
        path: "content.nodes[].choices[]",
        type: "{ text, next, feedback?, points?, quality? }[]",
        description: "Choices for decision nodes.",
      },
      {
        path: "content.nodes[].outcome / summary",
        type: '"success" | "neutral" | "failure" / string',
        description: "For endings.",
      },
      {
        path: "behavior.showScore / showHistory / allowRetry",
        type: "boolean",
        default: "true",
        description: "Scenario options.",
      },
      {
        path: "behavior.maxPoints",
        type: "number",
        description: "Normalisation for the score (computed when omitted).",
      },
    ],
  },
  {
    type: "conversation",
    name: "Simulated Conversation",
    tagline: "Practice replies in a realistic chat.",
    category: "decide",
    icon: "MessagesSquare",
    description:
      "A messaging interface with typing indicators, scripted incoming messages and reply options that carry tone and effectiveness. Choices branch the conversation, coaching notes explain the impact, and the summary rates the whole exchange. Deterministic by default; an optional provider adapter allows custom engines.",
    useCases: [
      "Urgent client messages",
      "Difficult feedback conversations",
      "Support and sales chats",
      "Internal escalations",
    ],
    interactions: [
      "Read incoming messages with typing animation",
      "Pick a reply (click or 1–5 keys)",
      "See tone and effectiveness feedback",
      "Reach an ending and review the summary",
    ],
    accessibility: [
      "Messages live in a polite log region",
      "Typing indicator has a text equivalent",
      "Replies are buttons with tone labels",
      "Summary uses text and icons for outcome",
    ],
    options: [
      ...base,
      {
        path: "content.contact",
        type: "{ name, role?, avatar?, status? }",
        description: "Who you are talking to.",
      },
      { path: "content.start", type: "string", description: "First node id." },
      {
        path: "content.nodes[]",
        type: "{ id, messages[], responses[], summary?, outcome? }[]",
        description: "Conversation graph.",
      },
      {
        path: "content.nodes[].responses[]",
        type: "{ text, next, tone?, effectiveness?, feedback? }[]",
        description: "Reply options (max 5).",
      },
      {
        path: "behavior.typingIndicator / showFeedback / allowRetry",
        type: "boolean",
        default: "true",
        description: "Conversation options.",
      },
    ],
  },
  {
    type: "process-explorer",
    name: "Process Explorer",
    tagline: "Interactive workflow explainer.",
    category: "explore",
    icon: "Workflow",
    description:
      "A horizontal stepper on wide screens and a vertical timeline on narrow ones. Each stage opens a detail panel with explanation, owner, duration, checklist, dependencies and optional branches. Progress tracks which stages were explored.",
    useCases: [
      "Campaign lifecycle",
      "Hiring or approval processes",
      "Customer journey",
      "Release pipeline",
    ],
    interactions: [
      "Click a stage to open details",
      "Arrow keys move between stages",
      "Branch buttons jump to alternative paths",
      "Previous / next stage",
    ],
    accessibility: [
      "Stages use roving tabindex",
      "Current and visited states are labelled",
      "Layout adapts without horizontal scroll",
      "Detail panel is announced",
    ],
    options: [
      ...base,
      {
        path: "content.stages[]",
        type: "Stage[]",
        description:
          "2–20 stages with title, summary, details, icon, owner, duration, dependsOn, branches, checklist.",
      },
      {
        path: "behavior.layout",
        type: '"auto" | "horizontal" | "vertical"',
        default: '"auto"',
        description: "Layout mode.",
      },
      {
        path: "behavior.requireAll",
        type: "boolean",
        default: "true",
        description: "Complete only after all stages were opened.",
      },
    ],
    wide: true,
  },
  {
    type: "spot-the-mistake",
    name: "Spot the Mistake",
    tagline: "Find what is wrong in a document or screenshot.",
    category: "practice",
    icon: "ScanSearch",
    description:
      "An inspection challenge over a mock document (rows of label / value) or an image with regions. Learners select the areas they think are wrong and get instant or batched verdicts, hints when stuck, and a full explanation screen at the end.",
    useCases: [
      "Campaign setup QA",
      "Reviewing a brief or contract",
      "Brand guideline compliance",
      "Data entry accuracy",
    ],
    interactions: [
      "Select rows or regions",
      "Instant or submit-all checking",
      "Hints that narrow the search",
      "Reveal remaining mistakes",
      "Explanation screen",
    ],
    accessibility: [
      "Every selectable area is a labelled button",
      "Found / wrong states use icons and text",
      "Hints are announced",
      "Keyboard completes the activity",
    ],
    options: [
      ...base,
      {
        path: "content.canvas",
        type: '{ kind: "document", title, rows[] } | { kind: "image", image, regions[] }',
        description: "What to inspect.",
      },
      {
        path: "content.mistakes[]",
        type: "{ targetId, title?, explanation, hint? }[]",
        description: "Mistakes to find (1–20).",
      },
      { path: "content.summary", type: "string", description: "Final explanation text." },
      {
        path: "behavior.checkMode",
        type: '"instant" | "submit"',
        default: '"instant"',
        description: "When selections are evaluated.",
      },
      {
        path: "behavior.maxWrong",
        type: "number",
        default: "0 (unlimited)",
        description: "Wrong picks allowed.",
      },
      {
        path: "behavior.allowHints / allowRetry",
        type: "boolean",
        default: "true",
        description: "Help options.",
      },
    ],
  },
  {
    type: "what-if-simulator",
    name: "What-If Simulator",
    tagline: "Move the sliders, watch the metrics respond.",
    category: "simulate",
    icon: "SlidersHorizontal",
    description:
      "An explorable explanation with sliders, live outputs computed from safe formulas (no JavaScript evaluation), threshold-driven insights and an optional challenge goal. Lightweight by design — no simulation engine, just transparent arithmetic.",
    useCases: [
      "How spend, CPC and conversion rate drive CPA",
      "Budget allocation trade-offs",
      "Pricing and margin intuition",
      "Capacity planning basics",
    ],
    interactions: [
      "Drag sliders or use − / + and arrow keys",
      "Outputs and bars update live",
      "Insights appear at thresholds",
      "Reset to defaults",
      "Complete a challenge goal",
    ],
    accessibility: [
      "Native range inputs with labels and values",
      "Chart has a table alternative",
      "Changes are announced politely",
      "No colour-only signalling",
    ],
    options: [
      ...base,
      {
        path: "content.inputs[]",
        type: "{ id, label, min, max, step?, default, format?, help? }[]",
        description: "Sliders (1–8).",
      },
      {
        path: "content.outputs[]",
        type: "{ id, label, formula, format?, primary?, help? }[]",
        description: 'Formulas like "spend / clicks" (1–8).',
      },
      {
        path: "content.insights[]",
        type: "{ id, when, text, tone? }[]",
        description: "Boolean formulas that trigger notes.",
      },
      {
        path: "content.challenge",
        type: "{ description, goal, successMessage? }",
        description: "Optional goal formula.",
      },
      {
        path: "content.currency",
        type: "string",
        default: '"USD"',
        description: "Currency code for formatting.",
      },
      {
        path: "behavior.chart",
        type: '"bars" | "none"',
        default: '"bars"',
        description: "Visualisation.",
      },
      {
        path: "behavior.completeOnInteract",
        type: "boolean",
        default: "true",
        description: "Complete on first change when no challenge.",
      },
    ],
    wide: true,
  },
  {
    type: "budget-allocator",
    name: "Budget Allocator",
    tagline: "Split the budget, beat diminishing returns.",
    category: "simulate",
    icon: "ChartPie",
    description:
      "A marketing-mix exercise: split a total budget across 3–8 channels whose response curves flatten as spend grows. Sliders rebalance the other channels automatically so the plan always adds up to 100%, a live goal tracks progress, and locking in reveals the optimal plan (found greedily by marginal return) side by side with the learner's.",
    useCases: [
      "Media-mix and channel budgeting",
      "Teaching marginal vs. average return",
      "Headcount or time allocation trade-offs",
      "Portfolio or inventory splits with caps and minimums",
    ],
    interactions: [
      "Drag a channel slider or use − / + and arrow keys",
      "Other channels rebalance proportionally to keep 100%",
      "Lock channels to hold their share",
      "Watch the KPI, cost per result and goal update live",
      "Lock in the plan to compare it with the optimum",
    ],
    accessibility: [
      "Native range inputs with spoken share and spend",
      "Lock toggles use aria-pressed",
      "Allocation bar and comparison have table alternatives",
      "Goal status is announced and shown with icons and text",
    ],
    options: [
      ...base,
      {
        path: "content.totalBudget",
        type: "number",
        description: "Budget to split, in content.currency.",
      },
      {
        path: "content.currency",
        type: "string",
        default: '"USD"',
        description: "Three-letter currency code for formatting.",
      },
      {
        path: "content.kpiLabel",
        type: "string",
        description: 'What the channels produce, e.g. "Conversions".',
      },
      {
        path: "content.channels[]",
        type: "{ id, label, description?, color?, efficiency, saturation, min?, max? }[]",
        description:
          "3–8 channels. Output = efficiency × (spend / 1000) ^ saturation; saturation 0.3–1 (1 = linear); min / max in percent.",
      },
      {
        path: "content.initial",
        type: "Record<channelId, percent>",
        description: "Starting split; must cover every channel and sum to 100.",
      },
      {
        path: "content.goal",
        type: "{ description, minKpi?, maxCostPerKpi? }",
        description: "Optional target tracked live.",
      },
      {
        path: "content.explanation",
        type: "string",
        description: "Shown after locking in.",
      },
      {
        path: "behavior.step",
        type: "number",
        default: "5",
        description: "Increment in percent; must divide 100.",
      },
      {
        path: "behavior.allowLock",
        type: "boolean",
        default: "true",
        description: "Show lock toggles per channel.",
      },
      {
        path: "behavior.showOptimal",
        type: "boolean",
        default: "true",
        description: "Reveal the optimal plan after locking in.",
      },
      {
        path: "behavior.scoreAgainstOptimal",
        type: "boolean",
        default: "true",
        description: "Score = your KPI ÷ optimal KPI (otherwise goal progress).",
      },
    ],
    wide: true,
  },
  {
    type: "estimate",
    name: "Estimation Challenge",
    tagline: "Guess the number, then see how close you were.",
    category: "practice",
    icon: "Crosshair",
    description:
      "Learners estimate a value on a scale — a percentage, a price, a ratio — with a big live readout, a slider and an exact-entry field. Locking in drops the true answer onto the scale next to the guess, highlights the gap, and grades the estimate as a bullseye, close or way off with a 0–1 accuracy score.",
    useCases: [
      "Calibrating benchmark instincts (CTR, CPM, ROAS)",
      "Market sizing and Fermi questions",
      "Pricing and cost intuition",
      "Before / after reflection on a dashboard",
    ],
    interactions: [
      "Drag the slider or use − / + and arrow keys",
      "Type an exact value",
      "Enter locks in and moves to the next question",
      "Answer marker animates onto the scale",
      "Summary with average accuracy and per-question results",
    ],
    accessibility: [
      "Native range input with formatted value text",
      "Labelled numeric input for precise entry",
      "Results use icons and words, not colour alone",
      "Verdict and answer are announced",
    ],
    options: [
      ...base,
      {
        path: "content.questions[]",
        type: "{ id?, prompt, context?, min, max, step?, answer, format?, unit?, tolerance?, explanation?, hint? }[]",
        description: "1–20 questions. answer must lie within [min, max].",
      },
      {
        path: "content.questions[].format",
        type: '"number" | "percent" | "currency" | "integer"',
        default: '"number"',
        description: "Percent values are fractions (0.028 = 2.8%).",
      },
      {
        path: "content.questions[].tolerance",
        type: "number",
        default: "5% of the range",
        description: "Bullseye distance; within 3× counts as close.",
      },
      {
        path: "content.questions[].unit",
        type: "string",
        description: 'Suffix label, e.g. "×" or "clicks".',
      },
      {
        path: "content.currency",
        type: "string",
        default: '"USD"',
        description: "Currency code for currency questions.",
      },
      {
        path: "behavior.showCounter",
        type: "boolean",
        default: "true",
        description: "Show the question counter and progress bar.",
      },
    ],
  },
  {
    type: "label-diagram",
    name: "Label the Diagram",
    tagline: "Put every label on the right part of the picture.",
    category: "practice",
    icon: "Tags",
    description:
      "Learners drag labels from a tray onto numbered drop zones pinned to an image — a screenshot, an ad, a product, a diagram. Zones sit on the image on wide screens and become a numbered list on narrow ones. Checking marks each zone right or wrong; a retry keeps correct labels locked, and the right labels are shown once attempts run out.",
    useCases: [
      "Anatomy of an ad, email or landing page",
      "Parts of a product, device or dashboard",
      "Process or architecture diagrams",
      "Map and floor-plan orientation",
    ],
    interactions: [
      "Drag a label onto a zone (mouse or touch)",
      "Or tap a label, then tap a zone",
      "Tap a filled zone to send its label back",
      "Check, retry the wrong ones, or show the answer",
      "Completion card explains what each part does",
    ],
    accessibility: [
      "Every drag has a tap / Enter alternative",
      "Zones are buttons named by number and content",
      "Results use icons and text, not colour alone",
      "Placements and results are announced",
    ],
    options: [
      ...base,
      {
        path: "content.image",
        type: "Media",
        description: "The diagram. Include width and height so zones line up before it loads.",
      },
      {
        path: "content.targets[]",
        type: "{ id, x, y, label, explanation? }[]",
        description: "2–12 anchor points (x / y in percent) and their correct labels.",
      },
      {
        path: "content.distractors",
        type: "string[]",
        default: "[]",
        description: "Extra labels that belong nowhere (up to 8). All labels must be unique.",
      },
      {
        path: "content.explanation",
        type: "string",
        description: "Shown on the completion card.",
      },
      ...retry,
      {
        path: "behavior.shuffle",
        type: "boolean",
        default: "true",
        description: "Shuffle the label tray.",
      },
      { path: "behavior.shuffleSeed", type: "number", description: "Deterministic shuffle." },
    ],
    wide: true,
  },
  {
    type: "image-compare",
    name: "Before / After",
    tagline: "Drag the divider and see what changed.",
    category: "explore",
    icon: "SquareSplitHorizontal",
    description:
      "Two images stacked under a draggable divider: drag anywhere on the image, or use the slider handle with the keyboard, to wipe between the before and after versions. Numbered notes appear on whichever side is revealed and open a short explanation. Once the learner has seen both sides in full (or opened every note), an optional question checks the key insight.",
    useCases: [
      "Landing page, ad or email redesigns",
      "Dashboard or report clean-ups",
      "Brand refreshes and style-guide fixes",
      "Photo retouching, data-viz or UI makeovers",
    ],
    interactions: [
      "Drag the divider anywhere on the image",
      "Arrow keys ±5, Page Up / Down ±20, Home / End",
      "Notes appear on the revealed side; tap to read",
      "Notes list jumps the divider to each note",
      "Optional question after exploring, then a takeaway",
    ],
    accessibility: [
      "Handle is a real slider with value text",
      "Vertical page scrolling still works on touch",
      "Every note is also reachable from a list",
      "Explore progress uses icons and words",
    ],
    options: [
      ...base,
      {
        path: "content.before / content.after",
        type: '{ image, label = "Before" / "After" }',
        description: "The two images; use the same aspect ratio.",
      },
      {
        path: "content.annotations[]",
        type: '{ id, x, y, side: "before" | "after", title, text }[]',
        description: "0–8 notes, visible only while their side is revealed.",
      },
      {
        path: "content.question",
        type: "{ prompt, options[2–5]: { text, correct?, explanation? }, explanation? }",
        description: "Optional check; ≥1 correct option (several = select all).",
      },
      {
        path: "content.takeaway",
        type: "string",
        description: "Key message on the completion card.",
      },
      {
        path: "behavior.initialPosition",
        type: "number",
        default: "50",
        description: "Starting divider position (percent showing the before image).",
      },
      {
        path: "behavior.requireExplore",
        type: "boolean",
        default: "true",
        description: "Drag to ≤ 15% and ≥ 85% (or open every note) before continuing.",
      },
    ],
    wide: true,
  },
  {
    type: "word-builder",
    name: "Word Builder",
    tagline: "Tap word tiles into the right order.",
    category: "practice",
    icon: "WholeWord",
    description:
      "An arrange-the-words exercise: learners tap tiles from a word bank to build a sentence or formula on a ruled answer line, then check it. Each tile is marked right or wrong by position, a retry keeps the correct start of the answer, and formula items render in the display face with operators highlighted. Accepted alternative orders and distractor tiles are supported.",
    useCases: [
      "Metric formulas (ROAS = Revenue ÷ Ad spend)",
      "Team rules and key phrases",
      "Naming conventions and URL structures",
      "Language practice",
    ],
    interactions: [
      "Tap a bank tile to add it to the end of the answer",
      "Tap a placed tile to send it back to its slot",
      "Drag placed tiles to reorder them",
      "Backspace removes the last tile",
      "Check, retry from the first mistake, show answer",
      "Summary with every item and your answer",
    ],
    accessibility: [
      "Every tile is a button; dragging is optional",
      "Enter sends a placed tile back; Space picks it up to reorder with the arrow keys",
      "Tile positions and results are part of each tile's name",
      "Correct and incorrect tiles use icons as well as colour",
    ],
    options: [
      ...base,
      {
        path: "content.items[]",
        type: "{ id?, prompt, tokens[], alternatives?[][], distractors?, display?, hint?, explanation? }[]",
        description: "1–10 items. tokens is the correct answer, 2–14 tiles in order.",
      },
      {
        path: "content.items[].alternatives",
        type: "string[][]",
        description: "Other accepted orders using exactly the same tokens.",
      },
      {
        path: "content.items[].distractors",
        type: "string[]",
        default: "[]",
        description: "Extra tiles that do not belong.",
      },
      {
        path: "content.items[].display",
        type: '"sentence" | "formula"',
        default: '"sentence"',
        description: "Formula renders tiles in the display face with operators highlighted.",
      },
      ...retry,
      {
        path: "behavior.shuffleSeed",
        type: "number",
        description: "Deterministic tile order.",
      },
      {
        path: "behavior.showCounter",
        type: "boolean",
        default: "true",
        description: "Show the item counter and progress bar.",
      },
    ],
  },
  {
    type: "priority-matrix",
    name: "Priority Matrix",
    tagline: "Sort tasks onto a 2×2, such as urgent × important.",
    category: "decide",
    icon: "Grid2x2",
    description:
      "A true two-by-two matrix with labelled axes — an Eisenhower urgent/important grid by default, or any two dimensions. Learners drag tasks from a tray into quadrants, or tap a task and then a quadrant. Checking marks every placement, wrong ones say where they belong and why, correct ones stay locked on a retry, and Show answer moves everything to the expert placement.",
    useCases: [
      "Urgent / important triage",
      "Effort × impact prioritisation",
      "Risk likelihood × severity",
      "Stakeholder power × interest mapping",
    ],
    interactions: [
      "Drag tasks into quadrants",
      "Tap a task, then tap a quadrant",
      "Move placed tasks or return them to the tray",
      "Check, retry, show the expert placement",
      "Summary as a mini matrix",
    ],
    accessibility: [
      "Tap-to-place is a full keyboard alternative to dragging",
      "Quadrants are labelled regions that describe their position on both axes",
      "Placements and results are announced",
      "Results use icons and text, not colour alone",
    ],
    options: [
      ...base,
      {
        path: "content.axes.x / y",
        type: "{ label, low, high }",
        description: "Axis names and end labels. y reads bottom (low) to top (high).",
      },
      {
        path: "content.quadrants[]",
        type: "{ id, position, label, description?, color? }[]",
        description:
          "Exactly 4; position is top-left | top-right | bottom-left | bottom-right, each used once.",
      },
      {
        path: "content.quadrants[].color",
        type: "string",
        description: "accent, lime, pink, sky, violet or any CSS colour.",
      },
      {
        path: "content.items[]",
        type: "{ id, text, quadrantId, explanation? }[]",
        description: "3–16 tasks.",
      },
      {
        path: "content.explanation",
        type: "string",
        description: "Shown when the matrix is solved or revealed.",
      },
      ...retry,
      {
        path: "behavior.shuffle / shuffleSeed",
        type: "boolean / number",
        default: "true",
        description: "Shuffle the tray.",
      },
    ],
    wide: true,
  },
  {
    type: "inbox-triage",
    name: "Inbox Triage",
    tagline: "Clear a realistic inbox, one judgement call at a time.",
    category: "decide",
    icon: "Inbox",
    description:
      "An in-tray exercise in a mail client of its own: a message list with senders, flags and unread state beside a reading pane. Learners open each message and choose an action — reply now, delegate, schedule, archive or report — and get instant coaching (or feedback at the end). The summary scores every call against the expert's, with partial credit for acceptable alternatives and a callout for any priority message that slipped through.",
    useCases: [
      "Prioritisation and time management under pressure",
      "Phishing and security awareness",
      "Onboarding: who owns what, and when to delegate",
      "Assessment-centre style e-tray practice",
    ],
    interactions: [
      "Open messages from the list (two panes on wide screens, list → message on narrow ones)",
      "Choose an action from the pill bar or press 1–5",
      "Instant coaching card with the expert call, then jump to the next unhandled message",
      "End-of-run mode: decisions can be changed until the results",
      "Summary with score, per-action breakdown and a message-by-message review",
    ],
    accessibility: [
      "Message list with roving focus: ↑ / ↓ / Home / End, Enter opens",
      "Flags and unread state are spoken, not only shown as icons",
      "Focus moves to the opened message; Escape returns to the list",
      "Decisions and results are announced and shown with icons and words",
    ],
    options: [
      ...base,
      {
        path: "content.owner",
        type: "{ name, role? }",
        description: "Whose inbox it is (shown in the top bar and as the recipient).",
      },
      {
        path: "content.actions[]",
        type: "{ id, label, description?, icon?, tone? }[]",
        description:
          '2–5 actions. icon: "reply" | "forward" | "calendar" | "archive" | "flag" | "alert"; tone: "accent" | "lime" | "pink" | "sky" | "violet".',
      },
      {
        path: "content.messages[]",
        type: "{ id, from: { name, role?, email? }, subject, preview, body, time, flags?, correctAction, acceptable?, explanation }[]",
        description:
          '3–12 messages. flags: "vip" | "external" | "attachment" | "suspicious-link". correctAction and acceptable reference action ids.',
      },
      {
        path: "content.messages[].acceptable",
        type: "string[]",
        default: "[]",
        description: "Other action ids worth half a point.",
      },
      {
        path: "content.summary",
        type: "string",
        description: "Wrap-up shown on the summary screen.",
      },
      {
        path: "behavior.feedback",
        type: '"instant" | "end"',
        default: '"instant"',
        description: "Coach after every decision, or only on the summary.",
      },
      {
        path: "behavior.allowRetry",
        type: "boolean",
        default: "true",
        description: "Show a retry button on the summary.",
      },
      {
        path: "behavior.showScore",
        type: "boolean",
        default: "true",
        description: "Show the score ring on the summary.",
      },
    ],
    wide: true,
  },
];

export const categories: { id: ModuleCategory; label: string; description: string }[] = [
  { id: "learn", label: "Learn", description: "Absorb new information" },
  { id: "practice", label: "Practice", description: "Check and reinforce" },
  { id: "explore", label: "Explore", description: "Discover by interacting" },
  { id: "decide", label: "Decide", description: "Make choices and see consequences" },
  { id: "simulate", label: "Simulate", description: "Play with the variables" },
];

export function getModuleDoc(type: string) {
  return moduleDocs.find((m) => m.type === type);
}
