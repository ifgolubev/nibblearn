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
    expect(screen.getByTestId("probe")).toHaveTextContent("en|system|Next|custom.key|unknown.key");
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
    const root = container.querySelector<HTMLElement>(".nb-root")!;
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
      "de-AT|system|Weiter|Eigener Text|unknown.key",
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
});
