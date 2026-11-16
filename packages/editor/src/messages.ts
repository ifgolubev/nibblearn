import { formatMessage, type MessageValues } from "@nibblearn/react";
import { useNibblearn } from "@nibblearn/react";
import { useCallback } from "react";

/** English UI strings of the editor. Override any of them through `NibblearnProvider messages`. */
export const editorMessages = {
  "editor.add": "Add {item}",
  "editor.remove": "Delete",
  "editor.removeItem": "Delete {item} {index}",
  "editor.duplicate": "Duplicate",
  "editor.duplicateItem": "Duplicate {item} {index}",
  "editor.moveUp": "Move up",
  "editor.moveUpItem": "Move {item} {index} up",
  "editor.moveDown": "Move down",
  "editor.moveDownItem": "Move {item} {index} down",
  "editor.expandItem": "Show {item} {index}",
  "editor.collapseItem": "Hide {item} {index}",
  "editor.itemAdded": "{item} added.",
  "editor.itemRemoved": "{item} {index} deleted.",
  "editor.itemMoved": "{item} moved to position {position}.",
  "editor.itemDuplicated": "{item} duplicated.",
  "editor.untitled": "Untitled {item}",
  "editor.optional": "optional",
  "editor.set": "Add",
  "editor.clear": "Clear",
  "editor.variant": "Type",
  "editor.group.content": "Content",
  "editor.group.behavior": "Behaviour",
  "editor.group.feedback": "Feedback",
  "editor.group.appearance": "Appearance",
  "editor.group.advanced": "Advanced",
  "editor.image.src": "Image URL",
  "editor.image.alt": "Alternative text",
  "editor.image.caption": "Caption",
  "editor.image.choose": "Choose image",
  "editor.image.decorative": "Leave empty for a decorative image.",
  "editor.richtext.bold": "Bold",
  "editor.richtext.italic": "Italic",
  "editor.richtext.code": "Code",
  "editor.richtext.link": "Link",
  "editor.richtext.list": "List",
  "editor.richtext.toolbar": "Formatting for {field}",
  "editor.json.invalid": "Not valid JSON.",
  "editor.record.key": "Key",
  "editor.record.value": "Value",
  "editor.record.add": "Add entry",
  "editor.issues.title": "Fix {count} problem(s) before this block can be shown",
  "editor.issues.goTo": "Go to {field}",
  "editor.preview": "Preview",
  "editor.preview.lastValid": "Showing the last valid version while you edit.",
  "editor.form": "Settings",
  "editor.picker.title": "Add a block",
  "editor.picker.search": "Search blocks",
  "editor.picker.example": "With example content",
  "editor.picker.blank": "Blank",
  "editor.picker.start": "Start from",
  "editor.picker.empty": "No blocks match “{query}”.",
  "editor.picker.add": "Add {name}",
  "editor.category.learn": "Learn",
  "editor.category.practice": "Practice",
  "editor.category.explore": "Explore",
  "editor.category.decide": "Decide",
  "editor.category.simulate": "Simulate",
  "editor.category.present": "Present",
  "editor.lesson.modules": "Blocks",
  "editor.lesson.settings": "Lesson settings",
  "editor.lesson.addBlock": "Add block",
  "editor.lesson.empty": "This lesson has no blocks yet.",
  "editor.lesson.select": "Edit {name}",
  "editor.lesson.position": "Block {current} of {total}",
  "editor.lesson.hasIssues": "Has problems",
  "editor.lesson.blockIssues": "In this lesson:",
} as const;

export type EditorMessageKey = keyof typeof editorMessages;

/** Translator for editor strings: provider `messages` first, then the English defaults. */
export function useEditorT() {
  const { messages } = useNibblearn();
  return useCallback(
    (key: EditorMessageKey | (string & {}), values?: MessageValues): string => {
      const own = Object.prototype.hasOwnProperty.call(messages, key) ? messages[key] : undefined;
      const fallback = Object.prototype.hasOwnProperty.call(editorMessages, key)
        ? editorMessages[key as EditorMessageKey]
        : key;
      return formatMessage(own ?? fallback, values);
    },
    [messages],
  );
}
