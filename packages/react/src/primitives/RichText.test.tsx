import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "./RichText";

describe("RichText", () => {
  it("renders safe links with a new-tab hint for external ones", () => {
    render(<RichText text="Read [the guide](https://example.com) or [FAQ](/faq)." />);
    const external = screen.getByRole("link", { name: /the guide/ });
    expect(external).toHaveAttribute("href", "https://example.com");
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    expect(external).toHaveTextContent("(opens in a new tab)");
    const internal = screen.getByRole("link", { name: "FAQ" });
    expect(internal).not.toHaveAttribute("target");
  });

  it("never renders script links", () => {
    const { container } = render(
      <RichText text="[x](javascript:alert(1)) [y](data:text/html,hi)" />,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("javascript:alert(1)");
  });

  it("renders lists in paragraph mode", () => {
    const { container } = render(
      <RichText paragraphs text={"Steps:\n- Brief\n- Plan\n\n1. One\n2. Two"} />,
    );
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
    expect(screen.getByText("Steps:").tagName).toBe("P");
  });
});
