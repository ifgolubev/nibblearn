import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { builtInModuleTypes, type BuiltInModuleType } from "@nibblearn/react";
import { createExample } from "@nibblearn/core/examples";
import { BlockPicker, LessonEditor, ModuleEditor, ModuleForm } from "@nibblearn/editor";
import { marketingMetricsLesson } from "@nibblearn/examples";

function FormDemo({ type }: { type: BuiltInModuleType }) {
  const [value, setValue] = useState<Record<string, unknown>>(() => createExample(type));
  return (
    <div className="nbe-root nb-theme" style={{ maxWidth: 640 }}>
      <ModuleForm key={type} value={value} onChange={setValue} />
    </div>
  );
}

function EditorDemo({ type }: { type: BuiltInModuleType }) {
  const [value, setValue] = useState<Record<string, unknown>>(() => createExample(type));
  return <ModuleEditor key={type} value={value} onChange={setValue} />;
}

function LessonDemo() {
  const [value, setValue] = useState<Record<string, unknown>>(
    () => structuredClone(marketingMetricsLesson) as unknown as Record<string, unknown>,
  );
  return <LessonEditor value={value} onChange={setValue} />;
}

interface Args {
  type: BuiltInModuleType;
}

const meta: Meta<Args> = {
  title: "Editor",
  args: { type: "flashcards" },
  argTypes: { type: { control: "select", options: builtInModuleTypes } },
};

export default meta;
type Story = StoryObj<Args>;

/** The form alone, generated from the module schema. */
export const Form: Story = { render: ({ type }) => <FormDemo type={type} /> };

/** Form and live preview; the preview follows the list item being edited. */
export const Editor: Story = { render: ({ type }) => <EditorDemo type={type} /> };

/** The block catalogue. */
export const Picker: Story = {
  render: () => <BlockPicker onPick={(config) => console.info("picked", config)} />,
};

/** A whole lesson: blocks, block settings and lesson settings. */
export const Lesson: Story = { render: () => <LessonDemo /> };
