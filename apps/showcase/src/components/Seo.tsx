import { useEffect } from "react";

export function useTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title
      ? `${title} · Nibblearn`
      : "Nibblearn — Tiny interactions. Real learning.";
    return () => {
      document.title = prev;
    };
  }, [title]);
}
