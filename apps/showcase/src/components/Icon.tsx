import {
  AppWindow,
  BookOpen,
  ChartPie,
  Columns3,
  Crosshair,
  GitBranch,
  GitCompareArrows,
  Grid2x2,
  Inbox,
  Layers,
  ListChecks,
  ListOrdered,
  MessagesSquare,
  MousePointerClick,
  ScanSearch,
  SlidersHorizontal,
  Sparkles,
  SquareSplitHorizontal,
  Tags,
  TextCursorInput,
  ToggleLeft,
  WholeWord,
  Workflow,
  type LucideProps,
} from "lucide-react";

const map: Record<string, React.ComponentType<LucideProps>> = {
  AppWindow,
  BookOpen,
  ChartPie,
  Columns3,
  Crosshair,
  GitBranch,
  GitCompareArrows,
  Grid2x2,
  Inbox,
  Layers,
  ListChecks,
  ListOrdered,
  MessagesSquare,
  MousePointerClick,
  ScanSearch,
  SlidersHorizontal,
  Sparkles,
  SquareSplitHorizontal,
  Tags,
  TextCursorInput,
  ToggleLeft,
  WholeWord,
  Workflow,
};

/** Render one of the icons used by module docs, with a fallback. */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = map[name] ?? Sparkles;
  return <Cmp {...props} />;
}
