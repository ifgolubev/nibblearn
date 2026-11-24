import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { calloutSchema, columnsSchema } from "@nibblearn/core";
import { createExample } from "@nibblearn/core/examples";
import { Callout } from "./Callout";
import { Columns } from "../columns/Columns";

describe("Callout and Columns", () => {
  it("renders a note with its variant named for screen readers and completes on view", () => {
    const onComplete = vi.fn();
    const config = calloutSchema.parse(createExample("callout"));
    render(<Callout config={config} onComplete={onComplete} />);
    const note = screen.getByRole("note", { name: config.content.title });
    expect(note).toHaveAttribute("data-variant", "tip");
    expect(note).toHaveTextContent("Tip:");
    expect(note.querySelector("code")).not.toBeNull();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("is a note inside the text: no block header, and the accent recolours any variant", () => {
    const parse = (extra: object) => calloutSchema.parse({ ...createExample("callout"), ...extra });
    const { container, rerender } = render(
      <Callout config={parse({ title: "Block title", instructions: "Read this." })} />,
    );
    expect(screen.queryByText("Block title")).toBeNull();
    expect(screen.queryByText("Read this.")).toBeNull();
    expect(container.querySelector(".nb-module__header")).toBeNull();
    expect(screen.getByRole("note")).not.toHaveAttribute("data-accented");
    rerender(<Callout config={parse({ appearance: { accent: "#ff8c82" } })} />);
    const note = screen.getByRole("note");
    expect(note).toHaveAttribute("data-variant", "tip");
    expect(note).toHaveAttribute("data-accented");
  });

  it("renders columns with headings and lists", () => {
    const onComplete = vi.fn();
    const config = columnsSchema.parse(createExample("columns"));
    const { container } = render(<Columns config={config} onComplete={onComplete} />);
    expect(screen.getByRole("heading", { name: "Do" })).toBeInTheDocument();
    expect(container.querySelectorAll(".nb-columns__col")).toHaveLength(2);
    expect(container.querySelectorAll("ul li").length).toBe(6);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("shows an alert for invalid configs", () => {
    render(<Callout config={{ id: "c", type: "callout", content: {} } as never} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    render(<Columns config={{ id: "x", type: "columns", content: { columns: [] } } as never} />);
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });
});
