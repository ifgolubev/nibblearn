import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { builtInModuleDefinitions } from "@nibblearn/core";
import { ModuleIcon, moduleIcons } from "./ModuleIcon";

describe("ModuleIcon", () => {
  it.each(builtInModuleDefinitions.map((d) => [d.type, d.icon] as const))(
    "%s resolves to its own icon",
    (type, icon) => {
      expect(icon && Object.prototype.hasOwnProperty.call(moduleIcons, icon)).toBe(true);
      const { container } = render(<ModuleIcon type={type} />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute("aria-hidden")).toBe("true");
      expect(svg!.getAttribute("class")).toContain(`lucide-${icon}`);
    },
  );

  it("falls back to a neutral icon for unknown and inherited names", () => {
    for (const name of ["nope", "constructor", "__proto__"]) {
      const { container, unmount } = render(<ModuleIcon name={name} />);
      expect(container.querySelector("svg")!.getAttribute("class")).toContain("lucide-box");
      unmount();
    }
    const { container } = render(<ModuleIcon type="unknown-type" />);
    expect(container.querySelector("svg")!.getAttribute("class")).toContain("lucide-box");
  });
});
