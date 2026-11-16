import {
  AppWindow,
  BookOpen,
  Box,
  ChartPie,
  Columns2,
  GalleryHorizontal,
  ListCollapse,
  MessageSquareWarning,
  PanelTop,
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
  SquareSplitHorizontal,
  Tags,
  TextCursorInput,
  ToggleLeft,
  WholeWord,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { ModuleRegistry } from "../registry";
import { defaultRegistry } from "../defaultRegistry";

/**
 * Icons that module definitions may name in `icon`. A fixed table (no dynamic lookup), so
 * bundlers only include these icons and content cannot reach arbitrary components.
 */
export const moduleIcons: Readonly<Record<string, LucideIcon>> = {
  "app-window": AppWindow,
  "book-open": BookOpen,
  box: Box,
  "chart-pie": ChartPie,
  "columns-2": Columns2,
  "gallery-horizontal": GalleryHorizontal,
  "list-collapse": ListCollapse,
  "message-square-warning": MessageSquareWarning,
  "panel-top": PanelTop,
  "columns-3": Columns3,
  crosshair: Crosshair,
  "git-branch": GitBranch,
  "git-compare-arrows": GitCompareArrows,
  "grid-2x2": Grid2x2,
  inbox: Inbox,
  layers: Layers,
  "list-checks": ListChecks,
  "list-ordered": ListOrdered,
  "messages-square": MessagesSquare,
  "mouse-pointer-click": MousePointerClick,
  "scan-search": ScanSearch,
  "sliders-horizontal": SlidersHorizontal,
  "square-split-horizontal": SquareSplitHorizontal,
  tags: Tags,
  "text-cursor-input": TextCursorInput,
  "toggle-left": ToggleLeft,
  "whole-word": WholeWord,
  workflow: Workflow,
};

export interface ModuleIconProps {
  /** Module type; its definition's `icon` is used. */
  type?: string;
  /** Icon name (kebab-case). Takes precedence over `type`. */
  name?: string;
  size?: number;
  className?: string;
  /** Registry used to resolve `type`. Defaults to the built-in modules. */
  registry?: ModuleRegistry;
}

/** The icon of a module type, for block pickers and lesson outlines. Decorative (aria-hidden). */
export function ModuleIcon({
  type,
  name,
  size = 20,
  className,
  registry = defaultRegistry,
}: ModuleIconProps) {
  const key = name ?? (type ? registry.get(type)?.icon : undefined);
  const Icon =
    key && Object.prototype.hasOwnProperty.call(moduleIcons, key) ? moduleIcons[key]! : Box;
  return <Icon aria-hidden size={size} className={className} />;
}
