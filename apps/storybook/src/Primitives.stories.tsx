import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Badge,
  Button,
  CompletionCard,
  Feedback,
  Hint,
  InvalidModule,
  OptionCard,
  ProgressBar,
  StepDots,
} from "@nibblearn/react";

const meta = {
  title: "Design system/Primitives",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const stack = { display: "grid", gap: 12, maxWidth: 560 } as const;

/** Every interaction state of an answer card: never colour alone (icons + text). */
export const OptionStates: Story = {
  render: () => (
    <div role="radiogroup" aria-label="Option states" style={stack}>
      <OptionCard text="Idle option" shortcut="A" />
      <OptionCard text="Selected option" shortcut="B" state="selected" />
      <OptionCard
        text="Correct answer"
        shortcut="C"
        state="correct"
        explanation="Shown after checking."
      />
      <OptionCard
        text="Incorrect answer"
        shortcut="D"
        state="incorrect"
        explanation="Why this is wrong."
      />
      <OptionCard text="Missed correct answer" shortcut="E" state="missed" />
      <OptionCard text="Disabled option" shortcut="F" disabled />
    </div>
  ),
};

export const FeedbackTones: Story = {
  render: () => (
    <div style={stack}>
      <Feedback tone="correct" title="Correct" text="CPA ties spend to results." live={false} />
      <Feedback
        tone="incorrect"
        title="Not quite"
        text="Review the explanation and try again."
        live={false}
      />
      <Feedback tone="partial" title="Partially correct" text="You found 2 of 3." live={false} />
      <Feedback
        tone="info"
        title="Tip"
        text="Use the arrow keys to move between cards."
        live={false}
      />
      <Feedback tone="neutral" title="Note" text="Figures are **illustrative**." live={false} />
    </div>
  ),
};

export const Buttons: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="soft">Soft</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="success">Success</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="primary" disabled>
        Disabled
      </Button>
      <Button variant="primary" size="lg">
        Large
      </Button>
      <Button size="sm">Small</Button>
    </div>
  ),
};

export const Progress: Story = {
  render: () => (
    <div style={stack}>
      <ProgressBar value={0.35} />
      <ProgressBar value={1} tone="success" />
      <ProgressBar value={0.6} size="sm" showLabel={false} />
      <StepDots total={6} current={2} />
    </div>
  ),
};

export const Badges: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Badge>Neutral</Badge>
      <Badge tone="accent">Accent</Badge>
      <Badge tone="success">Success</Badge>
      <Badge tone="danger">Danger</Badge>
      <Badge tone="warning">Warning</Badge>
      <Badge tone="info">Info</Badge>
    </div>
  ),
};

export const HintToggle: Story = {
  render: () => <Hint text="Efficiency metrics usually have the word *cost* in them." />,
};

export const Completion: Story = {
  render: () => (
    <div style={{ ...stack, maxWidth: 640 }}>
      <CompletionCard
        score={0.86}
        text="You answered **6 of 7** questions correctly."
        stats={[
          { label: "Correct", value: "6/7" },
          { label: "Attempts", value: 8 },
        ]}
        onRetry={() => {}}
      />
      <CompletionCard text="Every stage explored." />
    </div>
  ),
};

export const InvalidConfiguration: Story = {
  render: () => (
    <InvalidModule
      type="choice-challenge"
      issues={[
        {
          path: "content.questions[0].options",
          message: "each question needs at least one correct option",
        },
        { path: "content.questions[1].prompt", message: "expected string" },
      ]}
    />
  ),
};
