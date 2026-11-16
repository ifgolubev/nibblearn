# @nibblearn/embed

Put [Nibblearn](https://github.com/ifgolubev/nibblearn) modules into any HTML page — a CMS, server-rendered templates, lesson HTML stored in a database — without writing React.

## With a bundler

```bash
npm install @nibblearn/embed @nibblearn/react @nibblearn/core react react-dom
```

```ts
import "@nibblearn/embed/styles.css";
import { hydrate } from "@nibblearn/embed";

hydrate(document.querySelector("#lesson")!, {
  onComplete: (result, element) => console.log(result, element),
});
```

## Without a bundler

`dist/nibblearn.global.js` includes React and registers `<nibblearn-module>` when it loads:

```html
<link rel="stylesheet" href="/vendor/nibblearn/styles.css" />
<script src="/vendor/nibblearn/nibblearn.global.js" defer></script>

<nibblearn-module>
  <p>Fallback text for search engines and readers without JavaScript.</p>
  <script type="application/json">
    {
      "id": "check",
      "type": "true-false",
      "content": { "statements": [{ "text": "CTR is clicks ÷ impressions.", "isTrue": true }] }
    }
  </script>
</nibblearn-module>
```

Copy the two files from `node_modules/@nibblearn/embed/dist/` to your server; the library makes no network requests itself.

The element dispatches `nibblearn:event`, `nibblearn:complete` and `nibblearn:statechange` DOM events (they bubble). See the [embedding guide](https://github.com/ifgolubev/nibblearn/blob/main/docs/embedding.md).

MIT licensed.
