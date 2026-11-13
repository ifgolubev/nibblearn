/** Visually hidden polite live region for screen-reader announcements. */
export function LiveRegion({
  message,
  assertive = false,
}: {
  message: string;
  assertive?: boolean;
}) {
  return (
    <div
      className="nb-sr-only"
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {message}
    </div>
  );
}

export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="nb-sr-only">{children}</span>;
}
