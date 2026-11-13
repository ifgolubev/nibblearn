import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { ThemeProvider } from "./lib/theme";
import { HomePage } from "./pages/Home";
import { NotFoundPage } from "./pages/NotFound";

// Route-level code splitting: only the homepage ships in the initial bundle.
const GalleryPage = lazy(() => import("./pages/Gallery").then((m) => ({ default: m.GalleryPage })));
const ModulePage = lazy(() =>
  import("./pages/ModulePage").then((m) => ({ default: m.ModulePage })),
);
const PlaygroundPage = lazy(() =>
  import("./pages/Playground").then((m) => ({ default: m.PlaygroundPage })),
);
const LessonPlaygroundPage = lazy(() =>
  import("./pages/LessonPlayground").then((m) => ({ default: m.LessonPlaygroundPage })),
);
const ExamplesPage = lazy(() =>
  import("./pages/Examples").then((m) => ({ default: m.ExamplesPage })),
);
const ExamplePage = lazy(() =>
  import("./pages/ExamplePage").then((m) => ({ default: m.ExamplePage })),
);
const DocsPage = lazy(() => import("./pages/Docs").then((m) => ({ default: m.DocsPage })));
const EmbedPage = lazy(() => import("./pages/Embed").then((m) => ({ default: m.EmbedPage })));

function PageFallback() {
  return (
    <div className="site-container py-24" aria-busy="true">
      <div className="mx-auto h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/embed/:id" element={<EmbedPage />} />
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="/modules" element={<GalleryPage />} />
            <Route path="/modules/:type" element={<ModulePage />} />
            <Route path="/playground" element={<PlaygroundPage />} />
            <Route path="/playground/lesson" element={<LessonPlaygroundPage />} />
            <Route path="/examples" element={<ExamplesPage />} />
            <Route path="/examples/:id" element={<ExamplePage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/docs/:slug" element={<DocsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ThemeProvider>
  );
}
