import { useCallback, useRef, useState } from "react";

/**
 * Screen-reader announcements through a polite live region.
 * Render `<LiveRegion message={message} />` somewhere in the module.
 */
export function useAnnounce() {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = useCallback((text: string) => {
    // Clear first so that identical consecutive messages are re-announced.
    setMessage("");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(text), 30);
  }, []);
  return { message, announce };
}
