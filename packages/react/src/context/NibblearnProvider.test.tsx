import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { trueFalseSchema } from "@nibblearn/core";
import { NibblearnProvider, useNibblearn } from "./NibblearnProvider";
import { TrueFalse } from "../modules/true-false/TrueFalse";

const config = trueFalseSchema.parse({
  id: "tf",
  type: "true-false",
  content: { statements: [{ text: "Water is wet", isTrue: true }] },
});

function Probe() {
  const { t, locale, theme } = useNibblearn();
  return (
    <p data-testid="probe">{`${locale}|${theme}|${t("common.next")}|${t("custom.key")}|${t("unknown.key")}`}</p>
  );
}

describe("NibblearnProvider", () => {
  it("works without a provider (English defaults)", () => {
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("en|light|Next|custom.key|unknown.key");
  });

  it("applies theme, accent, radius and font as CSS variables on the root", () => {
    const { container } = render(
      <NibblearnProvider
        theme="dark"
        accent="#0ea5e9"
        radius={8}
        fontFamily="Georgia, serif"
        reducedMotion
      >
        <Probe />
      </NibblearnProvider>,
    );
    const root = container.querySelector<HTMLElement>(".nb-provider")!;
    expect(root).toHaveClass("nb-theme");
    expect(root).not.toHaveClass("nb-root");
    expect(root).toHaveAttribute("data-nb-theme", "dark");
    expect(root).toHaveAttribute("data-nb-motion", "reduced");
    expect(root.style.getPropertyValue("--nb-accent")).toBe("#0ea5e9");
    expect(root.style.getPropertyValue("--nb-radius-md")).toBe("8px");
    expect(root.style.getPropertyValue("--nb-radius-sm")).toBe("4px");
    expect(root.style.getPropertyValue("--nb-font")).toBe("Georgia, serif");
  });

  it("overrides built-in strings, adds custom keys and falls back to English for unknown locales", () => {
    render(
      <NibblearnProvider
        locale="de-AT"
        messages={{ "common.next": "Weiter", "custom.key": "Eigener Text" }}
      >
        <Probe />
      </NibblearnProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent(
      "de-AT|light|Weiter|Eigener Text|unknown.key",
    );
  });

  it("forwards every module event to onEvent with ids and timestamps", async () => {
    const user = userEvent.setup();
    const onEvent = vi.fn();
    render(
      <NibblearnProvider onEvent={onEvent}>
        <TrueFalse config={config} />
      </NibblearnProvider>,
    );
    await user.click(screen.getByRole("button", { name: /True/ }));
    const events = onEvent.mock.calls.map((c) => c[0]);
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(["module:start", "module:answer"]),
    );
    for (const e of events) {
      expect(e.moduleId).toBe("tf");
      expect(e.moduleType).toBe("true-false");
      expect(Number.isNaN(Date.parse(e.timestamp))).toBe(false);
      expect(() => JSON.stringify(e)).not.toThrow();
    }
  });

  it("passes theme tokens to every module root, and a module accent wins", () => {
    const { container } = render(
      <NibblearnProvider theme="dark" accent="#ff0000" radius={6}>
        <TrueFalse config={config} />
        <TrueFalse
          config={{ ...config, id: "tf2", appearance: { ...config.appearance, accent: "#00aa00" } }}
        />
      </NibblearnProvider>,
    );
    const [first, second] = container.querySelectorAll<HTMLElement>(".nb-module");
    expect(first).toHaveAttribute("data-nb-theme", "dark");
    expect(first!.style.getPropertyValue("--nb-accent")).toBe("#ff0000");
    expect(first!.style.getPropertyValue("--nb-radius-md")).toBe("6px");
    expect(second!.style.getPropertyValue("--nb-accent")).toBe("#00aa00");
  });

  it("renders no element with wrapper={false}", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <NibblearnProvider wrapper={false} theme="dark" accent="#ff0000" className="ignored">
        <span data-testid="child">x</span>
        <TrueFalse config={config} />
      </NibblearnProvider>,
    );
    expect(container.firstElementChild).toBe(screen.getByTestId("child"));
    expect(container.querySelector(".nb-provider")).toBeNull();
    const module = container.querySelector<HTMLElement>(".nb-module")!;
    expect(module).toHaveAttribute("data-nb-theme", "dark");
    expect(module.style.getPropertyValue("--nb-accent")).toBe("#ff0000");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("wrapper={false}"));
    warn.mockRestore();
  });

  it("picks a readable text colour for the accent", () => {
    const { container } = render(
      <NibblearnProvider accent="#facc15">
        <TrueFalse config={config} />
        <TrueFalse
          config={{ ...config, id: "b", appearance: { ...config.appearance, accent: "#1e3a8a" } }}
        />
        <TrueFalse
          config={{ ...config, id: "c", appearance: { ...config.appearance, accent: "teal" } }}
        />
      </NibblearnProvider>,
    );
    const [yellow, navy, named] = container.querySelectorAll<HTMLElement>(".nb-module");
    expect(yellow!.style.getPropertyValue("--nb-accent-fg")).toBe("#0c0c0f");
    expect(navy!.style.getPropertyValue("--nb-accent-fg")).toBe("#ffffff");
    // A named colour cannot be measured; the provider's value is kept.
    expect(named!.style.getPropertyValue("--nb-accent")).toBe("teal");
    expect(named!.style.getPropertyValue("--nb-accent-fg")).toBe("#0c0c0f");
  });
});
