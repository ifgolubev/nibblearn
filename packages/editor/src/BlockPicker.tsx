import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { builtInModuleTypes, type ModuleCategory } from "@nibblearn/react";
import { createEmpty, createExample } from "@nibblearn/core/examples";
import { ModuleIcon, defaultRegistry, useRootProps, type ModuleRegistry } from "@nibblearn/react";
import { uniqueId } from "./form/defaults";
import { useEditorT } from "./messages";

export interface BlockPickerProps {
  registry?: ModuleRegistry;
  /** Receives a new, valid module config. */
  onPick: (
    config: Record<string, unknown>,
    info: { type: string; from: "example" | "empty" },
  ) => void;
  /** Ids already used in the lesson; the new block gets a unique id. */
  existingIds?: string[];
  /** Start with example content (default) or blank placeholders. */
  defaultFrom?: "example" | "empty";
}

const CATEGORY_ORDER: ModuleCategory[] = [
  "learn",
  "practice",
  "explore",
  "decide",
  "simulate",
  "present",
];
const isBuiltIn = (type: string): type is (typeof builtInModuleTypes)[number] =>
  (builtInModuleTypes as readonly string[]).includes(type);

/** A searchable catalogue of block types that creates ready-to-edit configs. */
export function BlockPicker({
  registry = defaultRegistry,
  onPick,
  existingIds = [],
  defaultFrom = "example",
}: BlockPickerProps) {
  const t = useEditorT();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState<"example" | "empty">(defaultFrom);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const defs = registry
      .list()
      .filter(
        (d) =>
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.type.includes(q),
      );
    const order = [...CATEGORY_ORDER, ...new Set(defs.map((d) => d.category))].filter(
      (c, i, a) => a.indexOf(c) === i,
    );
    return order
      .map((c) => ({ category: c, defs: defs.filter((d) => d.category === c) }))
      .filter((g) => g.defs.length);
  }, [registry, query]);

  const pick = (type: string) => {
    const newId = uniqueId(type, existingIds);
    const config: Record<string, unknown> = isBuiltIn(type)
      ? from === "example"
        ? createExample(type, { id: newId })
        : createEmpty(type, { id: newId })
      : { id: newId, type };
    onPick(config, { type, from });
  };

  // Theme attribute and provider tokens (accent, radius, font), like module roots.
  const rootProps = useRootProps();
  return (
    <div className="nbe-root nb-theme nbe-picker" {...rootProps}>
      <h2 className="nbe-picker__title">{t("editor.picker.title")}</h2>
      <div className="nbe-picker__controls">
        <div className="nbe-search">
          <Search aria-hidden size={16} />
          <label className="nbe-sr-only" htmlFor={`${id}-q`}>
            {t("editor.picker.search")}
          </label>
          <input
            id={`${id}-q`}
            type="search"
            className="nbe-input"
            placeholder={t("editor.picker.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <fieldset className="nbe-segmented">
          <legend className="nbe-sr-only">{t("editor.picker.start")}</legend>
          {(["example", "empty"] as const).map((v) => (
            <label key={v} className="nbe-segmented__option">
              <input
                type="radio"
                name={`${id}-from`}
                value={v}
                checked={from === v}
                onChange={() => setFrom(v)}
              />
              <span>{t(v === "example" ? "editor.picker.example" : "editor.picker.blank")}</span>
            </label>
          ))}
        </fieldset>
      </div>
      {groups.length === 0 && <p className="nbe-note">{t("editor.picker.empty", { query })}</p>}
      {groups.map((g) => (
        <section
          key={g.category}
          className="nbe-picker__group"
          aria-labelledby={`${id}-${g.category}`}
        >
          <h3 className="nbe-picker__category" id={`${id}-${g.category}`}>
            {t(`editor.category.${g.category}`)}
          </h3>
          <ul className="nbe-picker__list">
            {g.defs.map((d) => (
              <li key={d.type}>
                <button type="button" className="nbe-block" onClick={() => pick(d.type)}>
                  <span className="nbe-block__icon">
                    <ModuleIcon type={d.type} registry={registry} size={20} />
                  </span>
                  <span className="nbe-block__text">
                    <span className="nbe-block__name">{d.name}</span>
                    <span className="nbe-block__desc">{d.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
