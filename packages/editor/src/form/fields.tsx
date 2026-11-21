import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  Code,
  Copy,
  ImagePlus,
  Italic,
  Link,
  List,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { humanizeKey, stripMarkup } from "@nibblearn/react";
import { SafeImage } from "@nibblearn/react";
import { useEditorT } from "../messages";
import { fieldId, pathKey, useForm } from "./context";
import { defaultFor, uniqueId } from "./defaults";
import { getAt, insertAt, moveItem, removeAt, type Path } from "./path";
import type { FormField, FormNodeWithMeta } from "./schema";

export interface FieldProps {
  node: FormNodeWithMeta;
  path: Path;
  value: unknown;
  label: string;
  required: boolean;
  /** Nesting depth (0 = module root). */
  depth: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Label for a field: `field.<type>.<path>` message override, then the schema title. */
function useLabel(path: Path, node: FormNodeWithMeta, fallbackKey: string): string {
  const { type } = useForm();
  const t = useEditorT();
  const key = `field.${type}.${path.filter((s) => typeof s === "string").join(".")}`;
  const custom = t(key);
  return custom !== key ? custom : (node.title ?? humanizeKey(fallbackKey));
}

/** Label, description and error wrapper shared by single-control fields. */
function FieldFrame({
  id,
  label,
  description,
  errors,
  required,
  children,
  inline,
}: {
  id: string;
  label: string;
  description?: string;
  errors: string[];
  required: boolean;
  children: ReactNode;
  inline?: boolean;
}) {
  const t = useEditorT();
  return (
    <div
      className={clsx(
        "nbe-field",
        inline && "nbe-field--inline",
        errors.length > 0 && "nbe-field--invalid",
      )}
    >
      <label className="nbe-field__label" htmlFor={id}>
        {label}
        {!required && <span className="nbe-field__optional"> ({t("editor.optional")})</span>}
      </label>
      {children}
      {description && (
        <p className="nbe-field__help" id={`${id}-help`}>
          {description}
        </p>
      )}
      {errors.length > 0 && (
        <p className="nbe-field__error" id={`${id}-error`}>
          {errors.join(" ")}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, description?: string, errors: string[] = []) =>
  [description && `${id}-help`, errors.length && `${id}-error`].filter(Boolean).join(" ") ||
  undefined;

// ---- primitives -----------------------------------------------------------------------------

function TextField({ node, path, value, label, required }: FieldProps) {
  const { formId, update, issuesAt } = useForm();
  const id = fieldId(formId, path);
  const errors = issuesAt(path);
  const multiline = node.ui.widget === "textarea";
  const str = typeof value === "string" ? value : "";
  const onChange = (v: string) => update(path, v === "" && !required ? undefined : v);
  const common = {
    id,
    className: "nbe-input",
    value: str,
    maxLength: node.kind === "string" ? node.maxLength : undefined,
    "aria-invalid": errors.length > 0 || undefined,
    "aria-describedby": describedBy(id, node.description, errors),
  };
  return (
    <FieldFrame
      id={id}
      label={label}
      description={node.description}
      errors={errors}
      required={required}
    >
      {multiline ? (
        <textarea {...common} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type="text" onChange={(e) => onChange(e.target.value)} />
      )}
    </FieldFrame>
  );
}

/** Wraps the selection of a textarea in markup, e.g. **bold**. */
function wrapSelection(
  el: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
) {
  const { selectionStart: s, selectionEnd: e, value } = el;
  const selected = value.slice(s, e) || placeholder;
  const next = value.slice(0, s) + before + selected + after + value.slice(e);
  return { next, start: s + before.length, end: s + before.length + selected.length };
}

function RichTextField({ node, path, value, label, required }: FieldProps) {
  const { formId, update, issuesAt } = useForm();
  const t = useEditorT();
  const id = fieldId(formId, path);
  const errors = issuesAt(path);
  const ref = useRef<HTMLTextAreaElement>(null);
  const block = node.ui.widget === "richtext-block";
  const str = typeof value === "string" ? value : "";
  const set = (v: string) => update(path, v === "" && !required ? undefined : v);
  const apply = (before: string, after: string, placeholder: string) => {
    const el = ref.current;
    if (!el) return;
    const { next, start, end } = wrapSelection(el, before, after, placeholder);
    set(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, end);
    });
  };
  // [label, icon, before, after, placeholder]
  const tools: [string, ReactNode, string, string, string][] = [
    [t("editor.richtext.bold"), <Bold key="b" aria-hidden size={16} />, "**", "**", "bold"],
    [t("editor.richtext.italic"), <Italic key="i" aria-hidden size={16} />, "*", "*", "italic"],
    [t("editor.richtext.code"), <Code key="c" aria-hidden size={16} />, "`", "`", "code"],
    [
      t("editor.richtext.link"),
      <Link key="l" aria-hidden size={16} />,
      "[",
      "](https://)",
      "link text",
    ],
    ...(block
      ? ([
          [t("editor.richtext.list"), <List key="li" aria-hidden size={16} />, "\n- ", "", "item"],
        ] as [string, ReactNode, string, string, string][])
      : []),
  ];
  return (
    <FieldFrame
      id={id}
      label={label}
      description={node.description}
      errors={errors}
      required={required}
    >
      <div
        className="nbe-toolbar"
        role="toolbar"
        aria-label={t("editor.richtext.toolbar", { field: label })}
      >
        {tools.map(([name, icon, before, after, placeholder]) => (
          <button
            key={name}
            type="button"
            className="nbe-icon-btn"
            onClick={() => apply(before, after, placeholder)}
          >
            {icon}
            <span className="nbe-sr-only">{name}</span>
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        id={id}
        className="nbe-input nbe-input--rich"
        rows={block ? 5 : 2}
        value={str}
        maxLength={node.kind === "string" ? node.maxLength : undefined}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={describedBy(id, node.description, errors)}
        onChange={(e) => set(e.target.value)}
      />
    </FieldFrame>
  );
}

function NumberField({ node, path, value, label, required }: FieldProps) {
  const { formId, update, issuesAt } = useForm();
  const id = fieldId(formId, path);
  const errors = issuesAt(path);
  const num = typeof value === "number" ? value : "";
  const n = node.kind === "number" ? node : undefined;
  const step =
    n?.step ??
    (n?.integer
      ? 1
      : n && n.max !== undefined && n.min !== undefined && n.max - n.min <= 1
        ? 0.01
        : "any");
  // While the author types, the input shows their text; only parseable numbers reach the
  // config. An empty input (also what the browser reports for "-" or "1e") keeps the last value
  // of a required field instead of turning it into 0.
  const [draft, setDraft] = useState<string | null>(null);
  const set = (raw: string) => {
    if (raw === "") {
      if (!required) update(path, undefined);
      return;
    }
    const v = Number(raw);
    if (Number.isFinite(v)) update(path, v);
  };
  return (
    <FieldFrame
      id={id}
      label={label}
      description={node.description}
      errors={errors}
      required={required}
    >
      <div className="nbe-number">
        {node.ui.widget === "slider" && n?.min !== undefined && n.max !== undefined && (
          <input
            type="range"
            className="nbe-range"
            min={n.min}
            max={n.max}
            step={step}
            value={num === "" ? n.min : num}
            tabIndex={-1}
            aria-hidden
            onChange={(e) => set(e.target.value)}
          />
        )}
        <input
          id={id}
          type="number"
          className="nbe-input nbe-input--number"
          value={draft ?? num}
          min={n?.min}
          max={n?.max}
          step={step}
          aria-invalid={errors.length > 0 || undefined}
          aria-describedby={describedBy(id, node.description, errors)}
          onChange={(e) => {
            setDraft(e.target.value);
            set(e.target.value);
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
    </FieldFrame>
  );
}

function SwitchField({ node, path, value, label }: FieldProps) {
  const { formId, update, issuesAt } = useForm();
  const id = fieldId(formId, path);
  const errors = issuesAt(path);
  const checked = value === true || (value === undefined && node.default === true);
  return (
    <div className="nbe-field nbe-field--switch">
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="nbe-switch"
        checked={checked}
        aria-describedby={describedBy(id, node.description, errors)}
        onChange={(e) => update(path, e.target.checked)}
      />
      <label htmlFor={id} className="nbe-field__label">
        {label}
      </label>
      {node.description && (
        <p className="nbe-field__help" id={`${id}-help`}>
          {node.description}
        </p>
      )}
      {errors.length > 0 && (
        <p className="nbe-field__error" id={`${id}-error`}>
          {errors.join(" ")}
        </p>
      )}
    </div>
  );
}

function SelectField({ node, path, value, label, required }: FieldProps) {
  const { formId, update, issuesAt } = useForm();
  const id = fieldId(formId, path);
  const errors = issuesAt(path);
  const options = node.kind === "string" ? (node.enum ?? []) : [];
  const current =
    typeof value === "string" ? value : typeof node.default === "string" ? node.default : "";
  return (
    <FieldFrame
      id={id}
      label={label}
      description={node.description}
      errors={errors}
      required={required}
    >
      <select
        id={id}
        className="nbe-input"
        value={current}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={describedBy(id, node.description, errors)}
        onChange={(e) => update(path, e.target.value === "" ? undefined : e.target.value)}
      >
        {!required && <option value="">—</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {humanizeKey(o)}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

function ColorField({ node, path, value, label, required }: FieldProps) {
  const { formId, update, issuesAt } = useForm();
  const id = fieldId(formId, path);
  const errors = issuesAt(path);
  const str = typeof value === "string" ? value : "";
  const hex = /^#[0-9a-fA-F]{6}$/.test(str) ? str : "#3b5bdb";
  return (
    <FieldFrame
      id={id}
      label={label}
      description={node.description}
      errors={errors}
      required={required}
    >
      <div className="nbe-color">
        <input
          type="color"
          className="nbe-color__swatch"
          value={hex}
          aria-hidden
          tabIndex={-1}
          onChange={(e) => update(path, e.target.value)}
        />
        <input
          id={id}
          type="text"
          className="nbe-input"
          value={str}
          placeholder="#3b5bdb"
          aria-invalid={errors.length > 0 || undefined}
          aria-describedby={describedBy(id, node.description, errors)}
          onChange={(e) =>
            update(path, e.target.value === "" && !required ? undefined : e.target.value)
          }
        />
      </div>
    </FieldFrame>
  );
}

function JsonField({ node, path, value, label, required }: FieldProps) {
  const { formId, update, issuesAt } = useForm();
  const t = useEditorT();
  const id = fieldId(formId, path);
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [bad, setBad] = useState(false);
  const errors = [...issuesAt(path), ...(bad ? [t("editor.json.invalid")] : [])];
  return (
    <FieldFrame
      id={id}
      label={label}
      description={node.description}
      errors={errors}
      required={required}
    >
      <textarea
        id={id}
        className="nbe-input nbe-input--code"
        rows={4}
        value={text}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={describedBy(id, node.description, errors)}
        onChange={(e) => {
          setText(e.target.value);
          try {
            update(path, JSON.parse(e.target.value));
            setBad(false);
          } catch {
            setBad(true);
          }
        }}
      />
    </FieldFrame>
  );
}

// ---- composite ------------------------------------------------------------------------------

function ImageField({ node, path, value, label, required }: FieldProps) {
  const { formId, update, issuesAt, onPickImage } = useForm();
  const t = useEditorT();
  const media = isRecord(value) ? value : undefined;
  const src = typeof media?.src === "string" ? media.src : "";
  const set = (key: string, v: string) =>
    update([...path, key], v === "" && key !== "src" && key !== "alt" ? undefined : v);
  if (!media && !required)
    return <OptionalAdd label={label} onAdd={() => update(path, { src: "", alt: "" })} />;
  const srcId = fieldId(formId, [...path, "src"]);
  const altId = fieldId(formId, [...path, "alt"]);
  const capId = fieldId(formId, [...path, "caption"]);
  const srcErrors = [...issuesAt(path), ...issuesAt([...path, "src"])];
  return (
    <fieldset className="nbe-group nbe-image">
      <legend className="nbe-group__legend">{label}</legend>
      {node.description && <p className="nbe-field__help">{node.description}</p>}
      <div className="nbe-image__body">
        <div className="nbe-image__preview">
          {src ? (
            <SafeImage media={{ src, alt: "" }} showCaption={false} />
          ) : (
            <div className="nbe-image__empty" aria-hidden />
          )}
        </div>
        <div className="nbe-image__fields">
          <FieldFrame id={srcId} label={t("editor.image.src")} errors={srcErrors} required>
            <div className="nbe-row">
              <input
                id={srcId}
                className="nbe-input"
                value={src}
                aria-invalid={srcErrors.length > 0 || undefined}
                aria-describedby={describedBy(srcId, undefined, srcErrors)}
                onChange={(e) => set("src", e.target.value)}
              />
              {onPickImage && (
                <button
                  type="button"
                  className="nbe-btn"
                  onClick={async () => {
                    const picked = await onPickImage();
                    if (!picked) return;
                    // Field-level updates apply to the latest value: edits made while the
                    // picker was open are kept.
                    update([...path, "src"], picked.src);
                    if (picked.alt !== undefined || typeof media?.alt !== "string")
                      update([...path, "alt"], picked.alt ?? "");
                  }}
                >
                  <ImagePlus aria-hidden size={16} />
                  {t("editor.image.choose")}
                </button>
              )}
            </div>
          </FieldFrame>
          <FieldFrame
            id={altId}
            label={t("editor.image.alt")}
            description={t("editor.image.decorative")}
            errors={issuesAt([...path, "alt"])}
            required={false}
          >
            <input
              id={altId}
              className="nbe-input"
              value={typeof media?.alt === "string" ? media.alt : ""}
              aria-describedby={`${altId}-help`}
              onChange={(e) => set("alt", e.target.value)}
            />
          </FieldFrame>
          <FieldFrame
            id={capId}
            label={t("editor.image.caption")}
            errors={issuesAt([...path, "caption"])}
            required={false}
          >
            <input
              id={capId}
              className="nbe-input"
              value={typeof media?.caption === "string" ? media.caption : ""}
              onChange={(e) => set("caption", e.target.value)}
            />
          </FieldFrame>
        </div>
      </div>
      {!required && (
        <button
          type="button"
          className="nbe-btn nbe-btn--quiet"
          onClick={() => update(path, undefined)}
        >
          <X aria-hidden size={14} />
          {t("editor.clear")}
        </button>
      )}
    </fieldset>
  );
}

function OptionalAdd({ label, onAdd }: { label: string; onAdd: () => void }) {
  const t = useEditorT();
  return (
    <div className="nbe-field nbe-field--add">
      <button type="button" className="nbe-btn nbe-btn--dashed" onClick={onAdd}>
        <Plus aria-hidden size={14} />
        {t("editor.set")} {label.charAt(0).toLowerCase() + label.slice(1)}
      </button>
    </div>
  );
}

const GROUP_ORDER = ["content", "behavior", "feedback", "appearance", "advanced"] as const;

function ObjectField({ node, path, value, label, required, depth }: FieldProps) {
  const { update, isHidden } = useForm();
  const t = useEditorT();
  if (node.kind !== "object") return null;
  const obj = isRecord(value) ? value : undefined;
  if (!obj && !required && depth > 0)
    return <OptionalAdd label={label} onAdd={() => update(path, defaultFor(node))} />;

  const visible = node.fields.filter(
    (f) =>
      f.node.ui.widget !== "hidden" &&
      f.node.kind !== "const" &&
      !isHidden([...path, f.key], f.node.ui.widget),
  );
  const ids = visible.filter((f) => f.node.ui.widget === "id");
  const rest = visible.filter((f) => f.node.ui.widget !== "id");
  const render = (f: FormField) => (
    <Field
      key={f.key}
      field={f}
      path={[...path, f.key]}
      value={
        obj
          ? Object.prototype.hasOwnProperty.call(obj, f.key)
            ? obj[f.key]
            : undefined
          : undefined
      }
      depth={depth + 1}
      // At the module root, group objects (content, behavior…) sit in a titled section already.
      bare={depth === 0 && f.node.kind === "object" && f.node.ui.group !== undefined}
    />
  );

  // The module root is split into collapsible groups (Content, Behaviour, …).
  if (depth === 0) {
    const byGroup = new Map<string, FormField[]>();
    for (const f of rest) {
      const g = f.node.ui.group ?? "content";
      byGroup.set(g, [...(byGroup.get(g) ?? []), f]);
    }
    for (const f of ids) byGroup.set("advanced", [...(byGroup.get("advanced") ?? []), f]);
    return (
      <div className="nbe-form__groups">
        {GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) =>
          g === "content" ? (
            <section key={g} className="nbe-section" aria-labelledby={`${path.join("-")}-${g}`}>
              <h3 className="nbe-section__title" id={`${path.join("-")}-${g}`}>
                {t(`editor.group.${g}`)}
              </h3>
              {byGroup.get(g)!.map(render)}
            </section>
          ) : (
            <details key={g} className="nbe-section nbe-section--collapsible">
              <summary className="nbe-section__title">
                <ChevronDown aria-hidden size={16} className="nbe-chevron" />
                {t(`editor.group.${g}`)}
              </summary>
              {byGroup.get(g)!.map(render)}
            </details>
          ),
        )}
      </div>
    );
  }

  return (
    <fieldset className="nbe-group">
      <legend className="nbe-group__legend">{label}</legend>
      {node.description && <p className="nbe-field__help">{node.description}</p>}
      {rest.map(render)}
      {ids.length > 0 && (
        <details className="nbe-advanced">
          <summary>{t("editor.group.advanced")}</summary>
          {ids.map(render)}
        </details>
      )}
      {!required && obj && (
        <button
          type="button"
          className="nbe-btn nbe-btn--quiet"
          onClick={() => update(path, undefined)}
        >
          <X aria-hidden size={14} />
          {t("editor.clear")}
        </button>
      )}
    </fieldset>
  );
}

function itemTitle(labelKey: string | undefined, item: unknown, fallback: string): string {
  const key = labelKey;
  if (key && isRecord(item) && typeof item[key] === "string" && item[key])
    return stripMarkup(item[key] as string);
  if (typeof item === "string" && item) return stripMarkup(item);
  return fallback;
}

function ArrayField({ node, path, value, label, required, depth }: FieldProps) {
  const { formId, update, root, announce, onFocusPath } = useForm();
  const t = useEditorT();
  const list = Array.isArray(value) ? value : [];
  const itemName = node.ui.itemName ?? "item";
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(list.length <= 4 ? list.map((_, i) => i) : [0]),
  );
  const focusAfter = useRef<{ index: number; action: string } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    // The intended button, else another enabled control of the item, else "Add": focus must
    // never fall to the page when the button became disabled or the list is empty.
    const item = listRef.current?.querySelector<HTMLElement>(`[data-index="${target.index}"]`);
    const wanted = item?.querySelector<HTMLButtonElement>(`[data-action="${target.action}"]`);
    const el =
      (wanted && !wanted.disabled ? wanted : null) ??
      item?.querySelector<HTMLElement>("button:not(:disabled), input, textarea, select") ??
      addRef.current;
    el?.focus();
  });

  if (node.kind !== "array") return null;
  const Item = node.item;
  const min = node.minItems ?? 0;
  const max = node.maxItems ?? Infinity;
  const name = (i: number) =>
    itemTitle(node.ui.itemLabel, list[i], t("editor.untitled", { item: itemName }));

  const idsInList = () =>
    list.map((it) => (isRecord(it) && typeof it.id === "string" ? it.id : "")).filter(Boolean);

  const add = () => {
    const created = defaultFor(Item, {
      idPrefix: itemName.replace(/\s+/g, "-"),
      takenIds: idsInList(),
    });
    update(path, [...list, created]);
    setExpanded(new Set([...expanded, list.length]));
    focusAfter.current = { index: list.length, action: "toggle" };
    announce(t("editor.itemAdded", { item: humanizeKey(itemName) }));
  };
  const remove = (i: number) => {
    update(path, getAt(removeAt(root, [...path, i]), path));
    focusAfter.current = { index: Math.max(0, i - 1), action: "toggle" };
    announce(t("editor.itemRemoved", { item: humanizeKey(itemName), index: i + 1 }));
  };
  const move = (i: number, to: number) => {
    update(path, getAt(moveItem(root, path, i, to), path));
    focusAfter.current = { index: to, action: to < i ? "up" : "down" };
    announce(t("editor.itemMoved", { item: name(i), position: to + 1 }));
  };
  const duplicate = (i: number) => {
    const copy = structuredClone(list[i]);
    if (isRecord(copy) && typeof copy.id === "string")
      copy.id = uniqueId(copy.id.replace(/-\d+$/, ""), idsInList());
    update(path, getAt(insertAt(root, path, copy, i + 1), path));
    setExpanded(new Set([...expanded, i + 1]));
    focusAfter.current = { index: i + 1, action: "toggle" };
    announce(t("editor.itemDuplicated", { item: name(i) }));
  };
  const toggle = (i: number) => {
    const next = new Set(expanded);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setExpanded(next);
  };
  const scalarItems = Item.kind !== "object" && Item.kind !== "union" && Item.kind !== "array";
  const headingId = `${fieldId(formId, path)}-label`;

  return (
    <section className="nbe-array" aria-labelledby={headingId}>
      <div className="nbe-array__head">
        <h4 className="nbe-array__title" id={headingId}>
          {label} <span className="nbe-array__count">{list.length}</span>
          {!required && <span className="nbe-field__optional"> ({t("editor.optional")})</span>}
        </h4>
      </div>
      {node.description && <p className="nbe-field__help">{node.description}</p>}
      <ol className="nbe-array__list" ref={listRef}>
        {list.map((item, i) => {
          const itemPath = [...path, i];
          const open = scalarItems || expanded.has(i);
          const n = { item: itemName, index: i + 1 };
          return (
            <li
              key={i}
              className="nbe-item"
              data-index={i}
              onFocusCapture={() => onFocusPath?.(itemPath as (string | number)[])}
            >
              <div className="nbe-item__head">
                {scalarItems ? (
                  <span className="nbe-item__index" aria-hidden>
                    {i + 1}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="nbe-item__toggle"
                    aria-expanded={open}
                    data-action="toggle"
                    onClick={() => toggle(i)}
                  >
                    <ChevronDown aria-hidden size={16} className="nbe-chevron" />
                    <span className="nbe-item__index">{i + 1}.</span>
                    <span className="nbe-item__name">{name(i)}</span>
                  </button>
                )}
                {scalarItems && (
                  <div className="nbe-item__inline">
                    <Field
                      field={{
                        key: String(i),
                        node: { ...Item, title: `${humanizeKey(itemName)} ${i + 1}` },
                        required: true,
                      }}
                      path={itemPath}
                      value={item}
                      depth={depth + 1}
                    />
                  </div>
                )}
                <div className="nbe-item__actions">
                  <button
                    type="button"
                    className="nbe-icon-btn"
                    data-action="up"
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    <ArrowUp aria-hidden size={16} />
                    <span className="nbe-sr-only">{t("editor.moveUpItem", n)}</span>
                  </button>
                  <button
                    type="button"
                    className="nbe-icon-btn"
                    data-action="down"
                    disabled={i === list.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <ArrowDown aria-hidden size={16} />
                    <span className="nbe-sr-only">{t("editor.moveDownItem", n)}</span>
                  </button>
                  <button
                    type="button"
                    className="nbe-icon-btn"
                    data-action="duplicate"
                    disabled={list.length >= max}
                    onClick={() => duplicate(i)}
                  >
                    <Copy aria-hidden size={16} />
                    <span className="nbe-sr-only">{t("editor.duplicateItem", n)}</span>
                  </button>
                  <button
                    type="button"
                    className="nbe-icon-btn nbe-icon-btn--danger"
                    data-action="remove"
                    disabled={list.length <= min}
                    onClick={() => remove(i)}
                  >
                    <Trash2 aria-hidden size={16} />
                    <span className="nbe-sr-only">{t("editor.removeItem", n)}</span>
                  </button>
                </div>
              </div>
              {!scalarItems && open && (
                <div className="nbe-item__body">
                  <Field
                    field={{ key: String(i), node: Item, required: true }}
                    path={itemPath}
                    value={item}
                    depth={depth + 1}
                    bare
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <button
        ref={addRef}
        type="button"
        className="nbe-btn nbe-btn--dashed"
        disabled={list.length >= max}
        onClick={add}
      >
        <Plus aria-hidden size={14} />
        {t("editor.add", { item: itemName })}
      </button>
    </section>
  );
}

function UnionField({ node, path, value, label, required, depth }: FieldProps) {
  const { formId, update } = useForm();
  const t = useEditorT();
  if (node.kind !== "union") return null;
  const disc = node.discriminator;
  const current =
    disc && isRecord(value)
      ? node.variants.findIndex((v) => v.value === value[disc])
      : node.variants.findIndex((v) => v.node.kind === typeof value);
  const index = current >= 0 ? current : 0;
  const variant = node.variants[index]!;
  const selectId = `${fieldId(formId, path)}-variant`;
  if (value === undefined && !required)
    return <OptionalAdd label={label} onAdd={() => update(path, defaultFor(variant.node))} />;
  return (
    <fieldset className="nbe-group">
      <legend className="nbe-group__legend">{label}</legend>
      <div className="nbe-field">
        <label className="nbe-field__label" htmlFor={selectId}>
          {t("editor.variant")}
        </label>
        <select
          id={selectId}
          className="nbe-input"
          value={index}
          onChange={(e) => update(path, defaultFor(node.variants[Number(e.target.value)]!.node))}
        >
          {node.variants.map((v, i) => (
            <option key={i} value={i}>
              {v.value ? humanizeKey(v.value) : v.label}
            </option>
          ))}
        </select>
      </div>
      <Field
        field={{ key: label, node: variant.node, required: true }}
        path={path}
        value={value}
        depth={depth + 1}
        bare
      />
    </fieldset>
  );
}

function RecordField({ node, path, value, label, required }: FieldProps) {
  const { formId, update } = useForm();
  const t = useEditorT();
  if (node.kind !== "record") return null;
  const obj = isRecord(value) ? value : {};
  const entries = Object.entries(obj);
  const numeric = node.value.kind === "number";
  const setEntry = (oldKey: string, newKey: string, v: unknown) => {
    const next: Record<string, unknown> = {};
    for (const [k, val] of entries) {
      if (k === oldKey) {
        if (newKey && !["__proto__", "constructor", "prototype"].includes(newKey)) next[newKey] = v;
      } else next[k] = val;
    }
    update(path, Object.keys(next).length || required ? next : undefined);
  };
  const base = fieldId(formId, path);
  return (
    <fieldset className="nbe-group">
      <legend className="nbe-group__legend">{label}</legend>
      {node.description && <p className="nbe-field__help">{node.description}</p>}
      {entries.map(([k, v], i) => (
        <div className="nbe-row nbe-record" key={i}>
          <label className="nbe-sr-only" htmlFor={`${base}-k${i}`}>
            {t("editor.record.key")} {i + 1}
          </label>
          <input
            id={`${base}-k${i}`}
            className="nbe-input"
            value={k}
            onChange={(e) => setEntry(k, e.target.value, v)}
          />
          <label className="nbe-sr-only" htmlFor={`${base}-v${i}`}>
            {t("editor.record.value")} {i + 1}
          </label>
          <input
            id={`${base}-v${i}`}
            className="nbe-input"
            type={numeric ? "number" : "text"}
            value={typeof v === "number" || typeof v === "string" ? v : ""}
            onChange={(e) => setEntry(k, k, numeric ? Number(e.target.value) : e.target.value)}
          />
          <button
            type="button"
            className="nbe-icon-btn nbe-icon-btn--danger"
            onClick={() => setEntry(k, "", undefined)}
          >
            <Trash2 aria-hidden size={16} />
            <span className="nbe-sr-only">
              {t("editor.remove")} {k}
            </span>
          </button>
        </div>
      ))}
      <button
        type="button"
        className="nbe-btn nbe-btn--dashed"
        onClick={() =>
          update(path, { ...obj, [uniqueId("key", Object.keys(obj))]: numeric ? 0 : "" })
        }
      >
        <Plus aria-hidden size={14} />
        {t("editor.record.add")}
      </button>
    </fieldset>
  );
}

// ---- dispatcher -----------------------------------------------------------------------------

export function Field({
  field,
  path,
  value,
  depth,
  bare,
}: {
  field: FormField;
  path: Path;
  value: unknown;
  depth: number;
  /** Render an object's fields without the surrounding fieldset (array items, unions). */
  bare?: boolean;
}) {
  const { node, key, required } = field;
  const label = useLabel(path, node, key);
  const props: FieldProps = { node, path, value, label, required, depth };
  const w = node.ui.widget;
  if (w === "hidden" || node.kind === "const") return null;
  if (w === "image") return <ImageField {...props} />;
  if (w === "json") return <JsonField {...props} />;
  switch (node.kind) {
    case "string":
      if (node.enum || w === "select") return <SelectField {...props} />;
      if (w === "color") return <ColorField {...props} />;
      if (w === "richtext" || w === "richtext-block") return <RichTextField {...props} />;
      return <TextField {...props} />;
    case "number":
      return <NumberField {...props} />;
    case "boolean":
      return <SwitchField {...props} />;
    case "object":
      return (
        <>
          {bare ? <BareObject {...props} /> : <ObjectField {...props} />}
          <ContainerErrors path={path} />
        </>
      );
    case "array":
      return (
        <>
          <ArrayField {...props} />
          <ContainerErrors path={path} />
        </>
      );
    case "union":
      return (
        <>
          <UnionField {...props} />
          <ContainerErrors path={path} />
        </>
      );
    case "record":
      return (
        <>
          <RecordField {...props} />
          <ContainerErrors path={path} />
        </>
      );
    default:
      return <JsonField {...props} />;
  }
}

/**
 * Problems reported for a list or group itself (too few items, duplicate ids, cross-field
 * rules). It carries the field id, so "go to" in the issue summary lands here.
 */
function ContainerErrors({ path }: { path: Path }) {
  const { formId, issuesAt } = useForm();
  const errors = issuesAt(path);
  if (errors.length === 0) return null;
  return (
    <p
      className="nbe-field__error nbe-field__error--group"
      id={fieldId(formId, path)}
      tabIndex={-1}
    >
      {errors.join(" ")}
    </p>
  );
}

/** An object's fields without a fieldset (inside an array item or a union variant). */
function BareObject({ node, path, value, depth }: FieldProps) {
  const { isHidden } = useForm();
  const t = useEditorT();
  if (node.kind !== "object") return null;
  const obj = isRecord(value) ? value : {};
  const visible = node.fields.filter(
    (f) =>
      f.node.ui.widget !== "hidden" &&
      f.node.kind !== "const" &&
      !isHidden([...path, f.key], f.node.ui.widget),
  );
  const ids = visible.filter((f) => f.node.ui.widget === "id");
  const rest = visible.filter((f) => f.node.ui.widget !== "id");
  const render = (f: FormField) => (
    <Field
      key={f.key}
      field={f}
      path={[...path, f.key]}
      value={Object.prototype.hasOwnProperty.call(obj, f.key) ? obj[f.key] : undefined}
      depth={depth + 1}
    />
  );
  return (
    <>
      {rest.map(render)}
      {ids.length > 0 && (
        <details className="nbe-advanced">
          <summary>{t("editor.group.advanced")}</summary>
          {ids.map(render)}
        </details>
      )}
    </>
  );
}

export { pathKey };
