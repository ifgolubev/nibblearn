import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NibblearnProvider, type AssetResolver } from "../context/NibblearnProvider";
import { SafeImage } from "./SafeImage";

const media = (src: string, alt = "Chart") => ({ src, alt });

function withResolver(resolveAsset: AssetResolver | undefined, ...srcs: string[]) {
  return render(
    <NibblearnProvider resolveAsset={resolveAsset}>
      {srcs.map((src, i) => (
        <SafeImage key={i} media={media(src, `Image ${i}`)} />
      ))}
    </NibblearnProvider>,
  );
}

const imgs = () => document.querySelectorAll("img");

describe("SafeImage with resolveAsset", () => {
  it("renders ordinary URLs directly without a resolver", () => {
    withResolver(undefined, "https://cdn.example/a.png");
    expect(imgs()[0]!.getAttribute("src")).toBe("https://cdn.example/a.png");
  });

  it("fails closed for asset: references without a resolver", () => {
    withResolver(undefined, "asset:uploads/a.png");
    expect(imgs()).toHaveLength(0);
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("asset:uploads");
  });

  it("resolves asset: references with a synchronous resolver", async () => {
    const resolver = vi.fn(() => "https://signed.example/a.png?sig=1");
    withResolver(resolver, "asset:uploads/a.png");
    expect(screen.getByRole("img", { name: "Image 0" })).toHaveAttribute("aria-busy", "true");
    await waitFor(() =>
      expect(imgs()[0]?.getAttribute("src")).toBe("https://signed.example/a.png?sig=1"),
    );
    expect(resolver).toHaveBeenCalledWith("asset:uploads/a.png", { reason: "initial" });
  });

  it("resolves with an async resolver and shares one call per key", async () => {
    let finish!: (url: string) => void;
    const resolver = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));
    withResolver(resolver, "asset:k1", "asset:k1");
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
    await act(async () => finish("https://signed.example/k1"));
    await waitFor(() => expect(imgs()).toHaveLength(2));
    for (const img of imgs()) expect(img.getAttribute("src")).toBe("https://signed.example/k1");
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it.each(["javascript:alert(1)", "asset:other", "data:text/html,<b>x</b>"])(
    "rejects an unsafe resolver result %j",
    async (bad) => {
      withResolver(() => bad, "asset:k");
      await waitFor(() => expect(screen.getByText("Image unavailable")).toBeInTheDocument());
      expect(imgs()).toHaveLength(0);
    },
  );

  it("keeps ordinary URLs when the resolver returns nothing", async () => {
    const resolver = vi.fn(() => undefined);
    withResolver(resolver, "https://cdn.example/a.png");
    expect(imgs()[0]!.getAttribute("src")).toBe("https://cdn.example/a.png");
    await waitFor(() => expect(resolver).toHaveBeenCalled());
    expect(imgs()[0]!.getAttribute("src")).toBe("https://cdn.example/a.png");
  });

  it("asks once more after a load error, then shows the fallback", async () => {
    let n = 0;
    const resolver = vi.fn(() => `https://signed.example/k?v=${++n}`);
    withResolver(resolver, "asset:k");
    await waitFor(() =>
      expect(imgs()[0]?.getAttribute("src")).toBe("https://signed.example/k?v=1"),
    );

    fireEvent.error(imgs()[0]!);
    await waitFor(() =>
      expect(imgs()[0]?.getAttribute("src")).toBe("https://signed.example/k?v=2"),
    );
    expect(resolver).toHaveBeenLastCalledWith("asset:k", { reason: "retry" });

    fireEvent.error(imgs()[0]!);
    await waitFor(() => expect(screen.getByText("Image unavailable")).toBeInTheDocument());
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it("shows the fallback when the resolver throws", async () => {
    withResolver(() => {
      throw new Error("network");
    }, "asset:k");
    await waitFor(() => expect(screen.getByText("Image unavailable")).toBeInTheDocument());
  });

  it("shows the fallback straight away on error without a resolver", () => {
    withResolver(undefined, "https://cdn.example/missing.png");
    fireEvent.error(imgs()[0]!);
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
  });

  it("keeps the cache when an inline resolver changes identity on re-render", async () => {
    const calls = vi.fn();
    function Host({ n }: { n: number }) {
      return (
        <NibblearnProvider
          resolveAsset={(src) => {
            calls(src);
            return `https://signed.example/a.png?v=${n}`;
          }}
        >
          <SafeImage media={media("asset:uploads/a.png")} />
        </NibblearnProvider>
      );
    }
    const view = render(<Host n={1} />);
    await waitFor(() => expect(imgs()[0]?.getAttribute("src")).toContain("v=1"));
    view.rerender(<Host n={2} />);
    view.rerender(<Host n={3} />);
    await act(async () => {});
    expect(calls).toHaveBeenCalledTimes(1);
    expect(imgs()[0]!.getAttribute("src")).toContain("v=1");
  });
});

describe("SafeImage dimensions", () => {
  it("states the aspect ratio as a style when width and height are known", () => {
    render(
      <NibblearnProvider>
        <SafeImage
          media={{ src: "https://cdn.example/a.png", alt: "A", width: 800, height: 450 }}
        />
        <SafeImage media={{ src: "https://cdn.example/b.png", alt: "B" }} />
      </NibblearnProvider>,
    );
    const [sized, plain] = [...imgs()];
    expect(sized!.getAttribute("width")).toBe("800");
    expect(sized!.style.aspectRatio).toBe("auto 800 / 450");
    expect(plain!.getAttribute("style")).toBeNull();
  });
});
