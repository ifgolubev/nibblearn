import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { builtInModuleDefinitions } from "@nibblearn/core";
import { createExample } from "@nibblearn/core/examples";
import { ModuleRenderer } from "../src/ModuleRenderer";

const TEXT_KEYS =
  /^(text|title|body|front|back|prompt|left|right|description|explanation|instruction|subject|preview|details|label|feedback|hint|summary|takeaway|caption)$/;

/** Append a link to every display text, keeping the config valid. */
function withLinks(type: string): unknown {
  const def = builtInModuleDefinitions.find((d) => d.type === type)!;
  const config = JSON.parse(
    JSON.stringify(createExample(type as never), (key, v) =>
      typeof v === "string" && TEXT_KEYS.test(key) ? `${v} [more](https://example.com/x)` : v,
    ),
  );
  return def.schema.safeParse(config).success ? config : createExample(type as never);
}

const CONTROLS =
  'button a, [role="button"] a, [role="radio"] a, [role="checkbox"] a, [role="option"] a, [role="tab"] a, [aria-hidden="true"] a';

describe("links in content never sit inside controls", () => {
  it.each(builtInModuleDefinitions.map((d) => d.type))("%s", (type) => {
    const { container } = render(<ModuleRenderer config={withLinks(type) as never} />);
    expect([...container.querySelectorAll(CONTROLS)].map((a) => a.outerHTML)).toEqual([]);
  });
});
