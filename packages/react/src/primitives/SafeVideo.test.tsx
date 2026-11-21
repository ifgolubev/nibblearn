import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NibblearnProvider, type AssetResolver } from "../context/NibblearnProvider";
import { SafeVideo } from "./SafeVideo";
import type { Video } from "@nibblearn/core";

const show = (video: Video, resolveAsset?: AssetResolver, onPlay?: () => void) =>
  render(
    <NibblearnProvider resolveAsset={resolveAsset}>
      <SafeVideo video={video} onPlay={onPlay} />
    </NibblearnProvider>,
  );

const videoEl = () => document.querySelector("video");

describe("SafeVideo", () => {
  it("renders a native player with controls, a name and no autoplay", () => {
    show({ src: "/media/intro.mp4", title: "Agency tour", poster: "/media/intro.png" });
    const el = videoEl()!;
    expect(el).toHaveAttribute("src", "/media/intro.mp4");
    expect(el).toHaveAttribute("poster", "/media/intro.png");
    expect(el).toHaveAttribute("controls");
    expect(el).toHaveAttribute("preload", "metadata");
    expect(el).not.toHaveAttribute("autoplay");
    expect(screen.getByLabelText("Agency tour")).toBe(el);
  });

  it("falls back to a generic name and renders a captions track", () => {
    show({
      src: "/media/intro.mp4",
      captions: { src: "/media/intro.vtt", lang: "en", label: "English" },
    });
    expect(screen.getByLabelText("Video")).toBe(videoEl());
    const track = document.querySelector("track")!;
    expect(track).toHaveAttribute("kind", "captions");
    expect(track).toHaveAttribute("src", "/media/intro.vtt");
    expect(track).toHaveAttribute("srclang", "en");
    expect(track).toHaveAttribute("label", "English");
  });

  it("shows a fallback when the file fails to load", () => {
    show({ src: "/media/missing.mp4" });
    fireEvent.error(videoEl()!);
    expect(videoEl()).toBeNull();
    expect(screen.getByText("Video unavailable")).toBeInTheDocument();
  });

  it("fails closed for asset: references without a resolver and resolves them with one", async () => {
    const { unmount } = show({ src: "asset:intro" });
    expect(videoEl()).toBeNull();
    expect(screen.getByText("Video unavailable")).toBeInTheDocument();
    unmount();

    const resolver = vi.fn((key: string) => `https://signed.example/${key.slice(6)}?sig=1`);
    show({ src: "asset:intro", poster: "asset:poster" }, resolver);
    await waitFor(() =>
      expect(videoEl()?.getAttribute("src")).toBe("https://signed.example/intro?sig=1"),
    );
    await waitFor(() =>
      expect(videoEl()?.getAttribute("poster")).toBe("https://signed.example/poster?sig=1"),
    );
  });

  it("reports the first play only", () => {
    const onPlay = vi.fn();
    show({ src: "/media/intro.mp4" }, undefined, onPlay);
    fireEvent.play(videoEl()!);
    fireEvent.play(videoEl()!);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});
