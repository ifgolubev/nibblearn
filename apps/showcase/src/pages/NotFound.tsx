import { Link } from "react-router";
import { useTitle } from "@/components/Seo";

export function NotFoundPage() {
  useTitle("Not found");
  return (
    <div className="site-container py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted">404</p>
      <h1 className="display display-blue mt-3 text-5xl">Page not found</h1>
      <p className="mt-3 text-muted">The page you are looking for does not exist.</p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white focus-ring"
      >
        Back home
      </Link>
    </div>
  );
}
