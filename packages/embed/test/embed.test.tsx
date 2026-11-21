import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExample } from "@nibblearn/core/examples";
import { defineNibblearnElement, hydrate, unmountElement } from "../src";

const tf = createExample("true-false", { id: "tf" });
/** JSON for HTML: safe inside a <script> and inside a single-quoted attribute. */
const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/'/g, "&#39;");

afterEach(() => {
  document.body.innerHTML = "";
});

describe("hydrate", () => {
  it("mounts modules from a JSON script and from the config attribute", async () => {
    document.body.innerHTML = `
      <div id="a" data-nibblearn-module><p>Fallback text</p><script type="application/json">${json(tf)}</script></div>
      <nibblearn-module id="b" config='${json(createExample("flashcards", { id: "fc" }))}'></nibblearn-module>`;
    let result!: ReturnType<typeof hydrate>;
    await act(async () => {
      result = hydrate(document);
    });
    expect(result.elements).toHaveLength(2);
    expect(document.querySelector("#a [data-nb-module='true-false']")).not.toBeNull();
    expect(document.querySelector("#b [data-nb-module='flashcards']")).not.toBeNull();
    expect(screen.queryByText("Fallback text")).toBeNull();

    // A second call skips mounted elements.
    expect(hydrate(document).elements).toHaveLength(0);
    await act(async () => result.unmount());
    expect(document.querySelector("[data-nb-module]")).toBeNull();
  });

  it("shows an alert for broken JSON, a missing config and an unknown type", async () => {
    document.body.innerHTML = `
      <div data-nibblearn-module><script type="application/json">{ nope</script></div>
      <div data-nibblearn-module></div>
      <div data-nibblearn-module config='{"id":"x","type":"nope"}'></div>`;
    await act(async () => {
      hydrate(document);
    });
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(3);
    expect(alerts[0]).toHaveTextContent("not valid JSON");
    expect(alerts[1]).toHaveTextContent("No module config");
    expect(alerts[2]).toHaveTextContent("nope");
  });

  it("forwards events, results and state, also as DOM events", async () => {
    const user = userEvent.setup();
    document.body.innerHTML = `<div id="m" data-nibblearn-module config='${json(tf)}'></div>`;
    const el = document.getElementById("m")!;
    const onEvent = vi.fn();
    const onStateChange = vi.fn();
    const dom = vi.fn();
    el.addEventListener("nibblearn:event", (e) => dom((e as CustomEvent).detail.type));
    await act(async () => {
      hydrate(document, { onEvent, onStateChange });
    });
    await user.click(screen.getAllByRole("button", { name: /Mark as true/ })[0]!);
    expect(onEvent.mock.calls.map((c) => c[0].type)).toContain("module:answer");
    expect(onEvent.mock.calls[0]![1]).toBe(el);
    expect(dom).toHaveBeenCalledWith("module:answer");
    await waitFor(() => expect(onStateChange).toHaveBeenCalled());
  });

  it("restores a saved session through getInitialState", async () => {
    const user = userEvent.setup();
    document.body.innerHTML = `<div id="m" data-nibblearn-module config='${json(tf)}'></div>`;
    const onStateChange = vi.fn();
    await act(async () => {
      hydrate(document, { onStateChange });
    });
    await user.click(screen.getAllByRole("button", { name: /Mark as true/ })[0]!);
    await waitFor(() => expect(onStateChange).toHaveBeenCalled());
    const saved = onStateChange.mock.calls.at(-1)![0];
    unmountElement(document.getElementById("m")!);

    document.body.innerHTML = `<div id="m2" data-nibblearn-module config='${json(tf)}'></div>`;
    await act(async () => {
      hydrate(document, { getInitialState: (id) => (id === "tf" ? saved : null) });
    });
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });
});

describe("<nibblearn-module>", () => {
  it("renders on connect, follows the config property and unmounts on disconnect", async () => {
    defineNibblearnElement();
    defineNibblearnElement(); // idempotent
    const el = document.createElement("nibblearn-module") as HTMLElement & { config: unknown };
    el.setAttribute("config", json(tf));
    await act(async () => {
      document.body.append(el);
    });
    expect(el.querySelector("[data-nb-module='true-false']")).not.toBeNull();

    await act(async () => {
      el.config = createExample("estimate", { id: "e" });
    });
    expect(el.querySelector("[data-nb-module='estimate']")).not.toBeNull();

    await act(async () => {
      el.remove();
      await Promise.resolve();
    });
    expect(el.querySelector("[data-nb-module]")).toBeNull();
  });
});

describe("review fixes", () => {
  it("keeps the script config when the element is moved", async () => {
    defineNibblearnElement();
    document.body.innerHTML = `<div id="a"><nibblearn-module><script type="application/json">${json(tf)}</script></nibblearn-module></div><div id="b"></div>`;
    const el = document.querySelector("nibblearn-module")!;
    await act(async () => {
      await Promise.resolve();
    });
    expect(el.querySelector("[data-nb-module='true-false']")).not.toBeNull();
    await act(async () => {
      document.getElementById("b")!.append(el);
      await Promise.resolve();
    });
    expect(el.querySelector("[data-nb-module='true-false']")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not render a config that cannot be migrated", async () => {
    document.body.innerHTML = `<div data-nibblearn-module config='${json({ ...tf, schemaVersion: 99 })}'></div>`;
    await act(async () => {
      hydrate(document);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/newer/i);
    expect(document.querySelector("[data-nb-module='true-false']")).toBeNull();
  });

  it("translates config problems through provider messages", async () => {
    document.body.innerHTML = `<div data-nibblearn-module></div>`;
    await act(async () => {
      hydrate(document, { provider: { messages: { "embed.noConfig": "Keine Konfiguration" } } });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Keine Konfiguration");
  });
});

describe("custom element options and config precedence", () => {
  it("applies options from a later define call and from hydrate", async () => {
    defineNibblearnElement("nb-opt-a");
    document.body.innerHTML = `<nb-opt-a config='${json(tf)}'></nb-opt-a>`;
    const el = document.querySelector("nb-opt-a")!;
    await act(async () => {
      await Promise.resolve();
    });
    expect(el.querySelector("[data-nb-theme='dark']")).toBeNull();

    await act(async () => {
      defineNibblearnElement("nb-opt-a", { provider: { theme: "dark" } });
    });
    expect(el.querySelector("[data-nb-theme='dark']")).not.toBeNull();

    // hydrate() re-renders elements the custom element mounted on its own, with its options.
    defineNibblearnElement();
    document.body.innerHTML = `<nibblearn-module config='${json(tf)}'></nibblearn-module>`;
    const own = document.querySelector("nibblearn-module")!;
    await act(async () => {
      await Promise.resolve();
    });
    const onStateChange = vi.fn();
    let result!: ReturnType<typeof hydrate>;
    await act(async () => {
      result = hydrate(document, { onStateChange });
    });
    expect(result.elements).toContain(own);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: /Mark as true/ })[0]!);
    await waitFor(() => expect(onStateChange).toHaveBeenCalled());
  });

  it("lets a changed config attribute win over the script and keeps an early property", async () => {
    defineNibblearnElement("nb-opt-b");
    document.body.innerHTML = `<nb-opt-b><script type="application/json">${json(tf)}</script></nb-opt-b>`;
    const el = document.querySelector("nb-opt-b")!;
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      el.setAttribute("config", json(createExample("flashcards", { id: "fc" })));
    });
    expect(el.querySelector("[data-nb-module='flashcards']")).not.toBeNull();

    // Property set before the tag is defined (e.g. the script loads later).
    const early = document.createElement("nb-opt-c") as HTMLElement & { config: unknown };
    early.config = createExample("estimate", { id: "e" });
    document.body.append(early);
    await act(async () => {
      defineNibblearnElement("nb-opt-c");
      await Promise.resolve();
    });
    expect(early.querySelector("[data-nb-module='estimate']")).not.toBeNull();
  });
});

describe("content blocks stored in lesson HTML", () => {
  /** Attribute-safe JSON, as a server would write it into `data-config="…"`. */
  const attr = (v: unknown) =>
    JSON.stringify(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  it("hydrates a div with data-config, drops the text fallback and resolves asset: images", async () => {
    const columns = {
      id: "cols-1",
      type: "columns",
      content: {
        columns: [
          {
            id: "a",
            title: "Before",
            text: "Old **flow**",
            image: { src: "asset:files/42", alt: "Old flow diagram" },
          },
          { id: "b", title: "After", text: "New flow" },
        ],
      },
    };
    const callout = createExample("callout", { id: "tip-1" });
    document.body.innerHTML = `
      <p>Lesson text</p>
      <div id="c" data-nibblearn-module data-config="${attr(columns)}">Before: Old flow. After: New flow.</div>
      <div id="t" data-nibblearn-module data-config="${attr(callout)}">Tip fallback</div>`;
    const resolveAsset = vi.fn(
      async (src: string) => `https://files.example/${src.slice(6)}?sig=1`,
    );
    await act(async () => {
      hydrate(document, { provider: { resolveAsset } });
    });
    expect(document.querySelector("#c [data-nb-module='columns']")).not.toBeNull();
    expect(document.querySelector("#t [data-nb-module='callout']")).not.toBeNull();
    expect(screen.queryByText("Before: Old flow. After: New flow.")).toBeNull();
    expect(screen.queryByText("Tip fallback")).toBeNull();
    expect(screen.getByText("Lesson text")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("img", { name: "Old flow diagram" })).toHaveAttribute(
        "src",
        "https://files.example/files/42?sig=1",
      ),
    );
    expect(resolveAsset).toHaveBeenCalledWith("asset:files/42", { reason: "initial" });
    expect(document.body.innerHTML).not.toContain('src="asset:');
  });
});
