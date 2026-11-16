import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createExample } from "@nibblearn/core/examples";
import { NibblearnProvider } from "../src/context/NibblearnProvider";
import { ModuleRenderer } from "../src/ModuleRenderer";

describe("theme attribute", () => {
  it("is left out by default, so a .dark ancestor can switch the module", () => {
    const { container } = render(<ModuleRenderer config={createExample("callout")} />);
    expect(container.querySelector(".nb-root")!.hasAttribute("data-nb-theme")).toBe(false);
    const inProvider = render(
      <NibblearnProvider>
        <ModuleRenderer config={createExample("callout")} />
      </NibblearnProvider>,
    );
    expect(inProvider.container.querySelector("[data-nb-theme]")).toBeNull();
  });

  it("is set when a provider chooses a theme", () => {
    const { container } = render(
      <NibblearnProvider theme="dark">
        <ModuleRenderer config={createExample("callout")} />
      </NibblearnProvider>,
    );
    expect(container.querySelector(".nb-root")!.getAttribute("data-nb-theme")).toBe("dark");
  });
});
