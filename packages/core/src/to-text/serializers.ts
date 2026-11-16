import type {
  AccordionConfig,
  CalloutConfig,
  CarouselConfig,
  ColumnsConfig,
  TabsConfig,
  BranchingScenarioConfig,
  BudgetAllocatorConfig,
  CategorySortConfig,
  ChoiceChallengeConfig,
  ConversationConfig,
  EstimateConfig,
  FillBlanksConfig,
  FlashcardsConfig,
  HotspotExplorerConfig,
  ImageCompareConfig,
  InboxTriageConfig,
  LabelDiagramConfig,
  MatchPairsConfig,
  PriorityMatrixConfig,
  ProcessExplorerConfig,
  ScreenshotWalkthroughConfig,
  SequenceBuilderConfig,
  SpotTheMistakeConfig,
  StoryCardsConfig,
  TrueFalseConfig,
  WhatIfSimulatorConfig,
  WordBuilderConfig,
} from "../schema/modules";
import {
  answer,
  feedback,
  heading,
  image,
  labelled,
  list,
  paragraph,
  type ResolvedToTextOptions as O,
  type TextNode,
} from "./nodes";
import { parseBlocks } from "../text";

const storyCards = (c: StoryCardsConfig, o: O): TextNode[] =>
  c.content.cards.flatMap((card) => [
    ...heading(3, labelled(card.eyebrow, card.title) ?? card.stat?.value),
    ...paragraph(card.stat ? labelled(card.stat.value, card.stat.label) : undefined),
    ...paragraph(card.body),
    ...image(card.image),
    ...(card.expandable
      ? [...paragraph(labelled(card.expandable.label, card.expandable.body))]
      : []),
    ...(card.check
      ? [
          {
            kind: "question" as const,
            prompt: card.check.question,
            options: card.check.options.map((opt) => ({
              text: opt.text,
              correct: o.includeAnswers ? opt.correct : undefined,
            })),
            explanation: o.includeFeedback ? card.check.explanation : undefined,
          },
        ]
      : []),
  ]);

const flashcards = (c: FlashcardsConfig, o: O): TextNode[] =>
  c.content.cards.flatMap((card) => [
    ...heading(3, labelled(card.tag, card.front)),
    ...image(card.frontImage),
    ...paragraph(card.back),
    ...image(card.backImage),
    ...feedback(o, "Hint", card.hint),
  ]);

const choiceChallenge = (c: ChoiceChallengeConfig, o: O): TextNode[] =>
  c.content.questions.flatMap((q) => [
    ...paragraph(q.context),
    ...image(q.image),
    {
      kind: "question" as const,
      prompt: q.prompt,
      options: q.options.map((opt) => ({
        text: opt.text,
        correct: o.includeAnswers ? opt.correct : undefined,
      })),
      explanation: o.includeFeedback ? q.explanation : undefined,
    },
    ...q.options.flatMap((opt) => [
      ...image(opt.image),
      ...feedback(o, `Explanation for "${opt.text}"`, opt.explanation),
    ]),
    ...feedback(o, "Hint", q.hint),
  ]);

const trueFalse = (c: TrueFalseConfig, o: O): TextNode[] =>
  c.content.statements.flatMap((s) => [
    {
      kind: "question" as const,
      prompt: labelled(s.tag, s.text) ?? s.text,
      answer: o.includeAnswers ? (s.isTrue ? "True" : "False") : undefined,
      explanation: o.includeFeedback ? s.explanation : undefined,
    },
    ...image(s.image),
  ]);

/** Alphabetical copy, so a list does not reveal the configured (solution) order. */
const sorted = (values: readonly string[]) =>
  [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const matchPairs = (c: MatchPairsConfig, o: O): TextNode[] =>
  o.includeAnswers
    ? [
        {
          kind: "pairs",
          header:
            c.content.leftLabel || c.content.rightLabel
              ? [c.content.leftLabel ?? "", c.content.rightLabel ?? ""]
              : undefined,
          rows: c.content.pairs.map((p) => [p.left, p.right] as [string, string]),
        },
        ...c.content.pairs.flatMap((p) => feedback(o, p.left, p.explanation)),
      ]
    : // Without answers the two sides are listed separately, the right side sorted.
      [
        ...paragraph(c.content.leftLabel),
        ...list(c.content.pairs.map((p) => p.left)),
        ...paragraph(c.content.rightLabel),
        ...list(sorted(c.content.pairs.map((p) => p.right))),
      ];

const sequenceBuilder = (c: SequenceBuilderConfig, o: O): TextNode[] => [
  // Without answers the steps are sorted alphabetically and not numbered, and their
  // descriptions (which often explain the position) are left out.
  ...(o.includeAnswers
    ? list(
        c.content.items.map((i) => labelled(i.text, i.description)),
        true,
      )
    : list(sorted(c.content.items.map((i) => i.text)))),
  ...feedback(o, "Hint", c.content.hint),
  ...feedback(o, "Explanation", c.content.explanation),
];

const categorySort = (c: CategorySortConfig, o: O): TextNode[] => {
  const { categories, items } = c.content;
  if (o.includeAnswers)
    return [
      ...categories.flatMap((cat) => [
        ...heading(3, cat.label),
        ...paragraph(cat.description),
        ...list(items.filter((i) => i.categoryId === cat.id).map((i) => i.text)),
      ]),
      ...items.flatMap((i) => feedback(o, i.text, i.explanation)),
      ...feedback(o, "Hint", c.content.hint),
    ];
  return [
    ...paragraph(`Categories: ${categories.map((cat) => cat.label).join(", ")}`),
    ...list(categories.map((cat) => cat.description && labelled(cat.label, cat.description))),
    ...list(items.map((i) => i.text)),
    ...feedback(o, "Hint", c.content.hint),
  ];
};

const fillBlanks = (c: FillBlanksConfig, o: O): TextNode[] => {
  const byId = new Map(c.content.blanks.map((b) => [b.id, b]));
  const text = c.content.template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, id: string) => {
    const blank = byId.get(id);
    return o.includeAnswers && blank ? `[${blank.answers.join(" / ")}]` : "____";
  });
  return [
    ...paragraph(text),
    ...answer(o, "Extra words", c.content.distractors.join(", ")),
    ...c.content.blanks.flatMap((b) => [
      ...feedback(o, "Hint", b.hint),
      ...feedback(o, "Explanation", b.explanation),
    ]),
    ...feedback(o, "Explanation", c.content.explanation),
  ];
};

const hotspotExplorer = (c: HotspotExplorerConfig): TextNode[] => [
  ...image(c.content.image),
  ...c.content.hotspots.flatMap((h) => [
    ...heading(3, labelled(h.label, h.title)),
    ...paragraph(h.description),
  ]),
];

const screenshotWalkthrough = (c: ScreenshotWalkthroughConfig, o: O): TextNode[] => [
  ...list(
    c.content.steps.map((s) =>
      [
        labelled(s.title, s.instruction),
        s.input?.placeholder ? `(${s.input.placeholder})` : undefined,
        o.includeAnswers && s.input?.expected ? `Type: ${s.input.expected}` : undefined,
      ]
        .filter(Boolean)
        .join(" "),
    ),
    true,
  ),
  ...c.content.steps.flatMap((s) => [...image(s.image), ...feedback(o, "Note", s.note)]),
  ...paragraph(c.content.summary),
];

const branchingScenario = (c: BranchingScenarioConfig, o: O): TextNode[] => [
  ...paragraph(c.content.intro),
  ...c.content.nodes.flatMap((n) => [
    ...heading(3, n.title),
    ...paragraph(labelled(n.speaker, n.text)),
    ...image(n.image),
    ...list(
      n.choices.map((ch) =>
        o.includeAnswers && ch.quality !== "neutral" ? `${ch.text} (${ch.quality})` : ch.text,
      ),
    ),
    ...n.choices.flatMap((ch) => feedback(o, ch.text, ch.feedback)),
    ...paragraph(n.summary),
  ]),
];

const conversation = (c: ConversationConfig, o: O): TextNode[] => {
  const { contact } = c.content;
  return [
    ...paragraph(labelled(contact.name, [contact.role, contact.status].filter(Boolean).join(", "))),
    ...image(contact.avatar),
    ...c.content.nodes.flatMap((n) => [
      ...n.messages.map((m): TextNode => ({
        kind: "paragraph",
        text: m.from === "them" ? `${contact.name}: ${m.text}` : m.text,
      })),
      ...list(n.responses.map((r) => labelled(r.tone, r.text))),
      ...n.responses.flatMap((r) => feedback(o, r.text, r.feedback)),
      ...paragraph(n.summary),
    ]),
  ];
};

const processExplorer = (c: ProcessExplorerConfig): TextNode[] =>
  c.content.stages.flatMap((s, i) => [
    ...heading(3, `${i + 1}. ${s.title}`),
    ...paragraph(s.summary),
    ...paragraph(s.details),
    ...paragraph([s.owner, s.duration].filter(Boolean).join(" · ") || undefined),
    ...list(s.checklist),
    ...list(s.branches.map((b) => b.label)),
    ...image(s.image),
  ]);

const spotTheMistake = (c: SpotTheMistakeConfig, o: O): TextNode[] => {
  const { canvas } = c.content;
  const targets =
    canvas.kind === "document"
      ? [
          ...heading(3, canvas.title),
          ...paragraph(canvas.subtitle),
          ...list(
            canvas.rows.map((r) =>
              [
                r.section ? `[${r.section}]` : "",
                labelled(r.label, r.value),
                r.note ? `(${r.note})` : "",
              ]
                .filter(Boolean)
                .join(" "),
            ),
          ),
        ]
      : [...image(canvas.image), ...list(canvas.regions.map((r) => r.label))];
  const labels = new Map(
    (canvas.kind === "document" ? canvas.rows : canvas.regions).map((t) => [t.id, t.label]),
  );
  return [
    ...targets,
    ...(o.includeAnswers
      ? c.content.mistakes.flatMap((m) => [
          ...paragraph(`Mistake: ${labelled(labels.get(m.targetId), m.title) ?? m.targetId}`),
          ...paragraph(m.explanation),
          ...feedback(o, "Hint", m.hint),
        ])
      : c.content.mistakes.flatMap((m) => feedback(o, "Hint", m.hint))),
    ...paragraph(o.includeAnswers ? c.content.summary : undefined),
  ];
};

const whatIfSimulator = (c: WhatIfSimulatorConfig, o: O): TextNode[] => [
  ...paragraph(c.content.challenge?.description),
  ...paragraph(c.content.challenge?.goal),
  ...heading(3, "Inputs"),
  ...list(c.content.inputs.map((i) => `${labelled(i.label, i.help)} (${i.min}–${i.max})`)),
  ...heading(3, "Outputs"),
  ...list(c.content.outputs.map((out) => labelled(out.label, out.help))),
  ...(o.includeFeedback ? list(c.content.insights.map((i) => i.text)) : []),
  ...feedback(o, "Success", c.content.challenge?.successMessage),
];

const budgetAllocator = (c: BudgetAllocatorConfig, o: O): TextNode[] => [
  ...paragraph(
    `Budget: ${c.content.totalBudget}${c.content.currency ? ` ${c.content.currency}` : ""}. Goal: ${c.content.kpiLabel}.`,
  ),
  ...paragraph(c.content.goal?.description),
  ...list(c.content.channels.map((ch) => labelled(ch.label, ch.description))),
  ...feedback(o, "Explanation", c.content.explanation),
];

const estimate = (c: EstimateConfig, o: O): TextNode[] =>
  c.content.questions.flatMap((q) => [
    ...paragraph(q.context),
    {
      kind: "question" as const,
      prompt: `${q.prompt} (${q.min}–${q.max}${q.unit ? ` ${q.unit}` : ""})`,
      answer: o.includeAnswers ? `${q.answer}${q.unit ? ` ${q.unit}` : ""}` : undefined,
      explanation: o.includeFeedback ? q.explanation : undefined,
    },
    ...feedback(o, "Hint", q.hint),
  ]);

const inboxTriage = (c: InboxTriageConfig, o: O): TextNode[] => {
  const actions = new Map(c.content.actions.map((a) => [a.id, a.label]));
  return [
    ...paragraph(labelled(c.content.owner.name, c.content.owner.role)),
    ...paragraph(`Actions: ${c.content.actions.map((a) => a.label).join(", ")}`),
    ...list(c.content.actions.map((a) => a.description && labelled(a.label, a.description))),
    ...c.content.messages.flatMap((m) => [
      ...heading(3, m.subject),
      ...paragraph(`From: ${labelled(m.from.name, m.from.role)} · ${m.time}`),
      ...paragraph(m.preview),
      ...paragraph(m.body),
      ...answer(o, "Best action", actions.get(m.correctAction)),
      ...feedback(o, "Explanation", m.explanation),
    ]),
    ...paragraph(o.includeAnswers ? c.content.summary : undefined),
  ];
};

const wordBuilder = (c: WordBuilderConfig, o: O): TextNode[] =>
  c.content.items.flatMap((item) => [
    {
      kind: "question" as const,
      prompt: item.prompt,
      answer: o.includeAnswers ? item.tokens.join(" ") : undefined,
      explanation: o.includeFeedback ? item.explanation : undefined,
    },
    ...feedback(o, "Hint", item.hint),
  ]);

const priorityMatrix = (c: PriorityMatrixConfig, o: O): TextNode[] => {
  const { axes, quadrants, items } = c.content;
  return [
    ...paragraph(`${axes.x.label}: ${axes.x.low} → ${axes.x.high}`),
    ...paragraph(`${axes.y.label}: ${axes.y.low} → ${axes.y.high}`),
    ...(o.includeAnswers
      ? quadrants.flatMap((q) => [
          ...heading(3, q.label),
          ...paragraph(q.description),
          ...list(items.filter((i) => i.quadrantId === q.id).map((i) => i.text)),
        ])
      : [
          ...list(quadrants.map((q) => labelled(q.label, q.description))),
          ...list(items.map((i) => i.text)),
        ]),
    ...items.flatMap((i) => feedback(o, i.text, i.explanation)),
    ...feedback(o, "Explanation", c.content.explanation),
  ];
};

const labelDiagram = (c: LabelDiagramConfig, o: O): TextNode[] => [
  ...image(c.content.image),
  // Target order matches the zones on the image, so without answers the labels are sorted.
  ...list(
    o.includeAnswers
      ? [...c.content.targets.map((t) => t.label), ...c.content.distractors]
      : sorted([...c.content.targets.map((t) => t.label), ...c.content.distractors]),
  ),
  ...(o.includeAnswers
    ? c.content.targets
    : [...c.content.targets].sort((x, y) => (x.label < y.label ? -1 : 1))
  ).flatMap((t) => feedback(o, t.label, t.explanation)),
  ...feedback(o, "Explanation", c.content.explanation),
];

const imageCompare = (c: ImageCompareConfig, o: O): TextNode[] => {
  const { before, after, annotations, question } = c.content;
  return [
    ...heading(3, before.label),
    ...image(before.image),
    ...heading(3, after.label),
    ...image(after.image),
    ...list(annotations.map((a) => labelled(a.title, a.text))),
    ...(question
      ? [
          {
            kind: "question" as const,
            prompt: question.prompt,
            options: question.options.map((opt) => ({
              text: opt.text,
              correct: o.includeAnswers ? opt.correct : undefined,
            })),
            explanation: o.includeFeedback ? question.explanation : undefined,
          },
          ...question.options.flatMap((opt) => feedback(o, opt.text, opt.explanation)),
        ]
      : []),
    ...paragraph(c.content.takeaway),
  ];
};

/** Block text: paragraphs and "- " / "1. " lists become separate nodes. */
const blockText = (text: string | undefined): TextNode[] => {
  if (!text) return [];
  return parseBlocks(text).map((b): TextNode =>
    b.kind === "paragraph"
      ? { kind: "paragraph", text: b.text }
      : {
          kind: "list",
          ordered: b.ordered,
          items: b.items,
          ...(b.start ? { start: b.start } : {}),
        },
  );
};

const callout = (c: CalloutConfig): TextNode[] => [
  ...paragraph(
    c.content.title ? `${c.content.variant.toUpperCase()}: ${c.content.title}` : undefined,
  ),
  ...blockText(c.content.text),
];

const accordion = (c: AccordionConfig): TextNode[] =>
  c.content.items.flatMap((item) => [
    ...heading(3, item.title),
    ...blockText(item.text),
    ...image(item.image),
  ]);

const tabs = (c: TabsConfig): TextNode[] =>
  c.content.tabs.flatMap((tab) => [
    ...heading(3, tab.label),
    ...blockText(tab.text),
    ...image(tab.image),
  ]);

const carousel = (c: CarouselConfig): TextNode[] =>
  c.content.slides.flatMap((slide, i) => [
    ...heading(3, slide.title ?? `Slide ${i + 1}`),
    ...blockText(slide.text),
    ...image(slide.image),
  ]);

const columns = (c: ColumnsConfig): TextNode[] =>
  c.content.columns.flatMap((col) => [
    ...heading(3, col.title),
    ...blockText(col.text),
    ...image(col.image),
  ]);

/** Built-in serializers, keyed by module type. */
export const builtInSerializers: Readonly<Record<string, (config: never, o: O) => TextNode[]>> = {
  "story-cards": storyCards,
  flashcards,
  "choice-challenge": choiceChallenge,
  "true-false": trueFalse,
  "match-pairs": matchPairs,
  "sequence-builder": sequenceBuilder,
  "category-sort": categorySort,
  "fill-blanks": fillBlanks,
  "hotspot-explorer": hotspotExplorer,
  "screenshot-walkthrough": screenshotWalkthrough,
  "branching-scenario": branchingScenario,
  conversation,
  "process-explorer": processExplorer,
  "spot-the-mistake": spotTheMistake,
  "what-if-simulator": whatIfSimulator,
  "budget-allocator": budgetAllocator,
  estimate,
  "inbox-triage": inboxTriage,
  "word-builder": wordBuilder,
  "priority-matrix": priorityMatrix,
  "label-diagram": labelDiagram,
  "image-compare": imageCompare,
  callout,
  accordion,
  tabs,
  carousel,
  columns,
};
