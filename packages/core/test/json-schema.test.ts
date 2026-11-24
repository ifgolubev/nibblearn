import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  SAFE_CSS_COLOR,
  SAFE_IMAGE_SRC_PATTERN,
  SAFE_LINK_HREF_PATTERN,
  SAFE_VIDEO_SRC_PATTERN,
  builtInModuleTypes,
  getAnyModuleJsonSchema,
  getLessonJsonSchema,
  getModuleJsonSchema,
  getModuleLimits,
  isSafeCssColor,
  isSafeImageSrc,
  isSafeLinkHref,
  isSafeVideoSrc,
} from "../src";
import * as examples from "../../../examples/src";

const ajv = new Ajv2020({ strict: false, allErrors: true });
// Ajv caches schemas by $id; compile each module schema once.
const moduleValidator = (type: string) =>
  ajv.getSchema(`urn:nibblearn:module:${type}:1`) ?? ajv.compile(getModuleJsonSchema(type)!);

const demos = Object.values(
  examples as Record<string, { type?: unknown; schemaVersion?: unknown }>,
);
const moduleDemos = demos.filter((d) => d && typeof d.type === "string") as {
  type: string;
  id: string;
}[];
const lessons = demos.filter((d) => d && d.schemaVersion === 1);

const fixturesDir = join(__dirname, "fixtures");
const fixtures = readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(fixturesDir, f), "utf8")) as { modules: unknown[] });

const errorsText = (validate: { errors?: unknown }) => JSON.stringify(validate.errors, null, 1);

describe("getModuleJsonSchema", () => {
  it.each(builtInModuleTypes)("%s compiles and carries an $id", (type) => {
    const schema = getModuleJsonSchema(type)!;
    expect(schema.$id).toBe(`urn:nibblearn:module:${type}:1`);
    expect(JSON.stringify(schema)).not.toContain('"$ref"');
    expect(() => moduleValidator(type)).not.toThrow();
  });

  it.each(moduleDemos.map((d) => [d.type, d] as const))(
    "demo %s passes its schema",
    (type, demo) => {
      const validate = moduleValidator(type);
      expect(validate(demo), errorsText(validate)).toBe(true);
    },
  );

  it("returns undefined for unknown types", () => {
    expect(getModuleJsonSchema("nope")).toBeUndefined();
  });

  it("output schemas make defaulted fields required", () => {
    const input = getModuleJsonSchema("true-false") as { required: string[] };
    const output = getModuleJsonSchema("true-false", { io: "output" }) as { required: string[] };
    expect(input.required).not.toContain("feedback");
    expect(output.required).toContain("feedback");
  });
});

describe("getAnyModuleJsonSchema", () => {
  const validate = ajv.compile(getAnyModuleJsonSchema());

  it.each(moduleDemos.map((d) => [d.type, d] as const))("accepts the %s demo", (_type, demo) => {
    expect(validate(demo), errorsText(validate)).toBe(true);
  });

  it("accepts every module of the frozen fixtures", () => {
    for (const lesson of fixtures)
      for (const m of lesson.modules) expect(validate(m), errorsText(validate)).toBe(true);
  });

  const base = examples.trueFalseDemo as unknown as Record<string, unknown>;
  const statement = (examples.trueFalseDemo.content.statements[0] ?? {}) as Record<string, unknown>;
  it.each([
    ["an unsafe accent", { ...base, appearance: { accent: "url(https://evil.example/x)" } }],
    [
      "a script image",
      {
        ...base,
        content: { statements: [{ ...statement, image: { src: "javascript:alert(1)" } }] },
      },
    ],
    ["a missing required field", { ...base, content: {} }],
    ["an unknown type", { ...base, type: "nope" }],
  ])("rejects %s", (_name, config) => {
    expect(validate(config)).toBe(false);
  });
});

describe("getLessonJsonSchema", () => {
  const validate = ajv.compile(getLessonJsonSchema());

  it.each(lessons.map((l) => [(l as { id: string }).id, l] as const))(
    "accepts the %s lesson",
    (_id, lesson) => {
      expect(validate(lesson), errorsText(validate)).toBe(true);
    },
  );

  it("accepts the frozen fixtures", () => {
    for (const lesson of fixtures) expect(validate(lesson), errorsText(validate)).toBe(true);
  });

  it("rejects a lesson with the wrong schemaVersion", () => {
    expect(validate({ ...examples.marketingMetricsLesson, schemaVersion: 2 })).toBe(false);
  });
});

describe("patterns match the runtime checks", () => {
  const imageCases = [
    "https://example.com/a.png",
    "http://example.com/a.png",
    "HTTPS://EXAMPLE.COM/A.PNG",
    "//cdn.example.com/a.png",
    "/images/a.png",
    "images/a.png",
    "./a.png",
    "../a.png",
    "a.png?x=1:2",
    "blob:https://example.com/uuid",
    "BLOB:https://x",
    "data:image/png;base64,AAAA",
    "data:image/jpeg;base64,AAAA",
    "data:image/jpg,AAAA",
    "DATA:IMAGE/SVG+XML,<svg/>",
    "data:image/svg+xml;utf8,<svg/>",
    "data:image/webp;base64,AA",
    "data:image/avif;base64,AA",
    "data:image/gif;base64,AA",
    "  https://example.com/a.png  ",
    "https://example.com/a.png\t",
    "\nhttps://example.com/a.png",
    "",
    "   ",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "\tjavascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
    "data:image/png",
    "data:image/bmp;base64,AA",
    "data:,hello",
    "file:///etc/passwd",
    "ftp://example.com/a.png",
    "mailto:a@example.com",
    "https://example.com/a\u0000.png",
    "https://example.com/a\u001f.png",
    "https://exa mple.com/a b.png",
    "asset:abc",
    "ASSET:uploads/2026/photo.png",
    "asset:a:b@c+d=e~f%20",
    " asset:abc ",
    "asset:",
    "asset:a b",
    "asset:a<b",
    "asset:a\tb",
    'asset:a"b',
    `asset:${"x".repeat(513)}`,
    `asset:${"x".repeat(512)}`,
    "x:y",
    "1abc:def",
    "+a:b",
  ];
  const imageRe = new RegExp(SAFE_IMAGE_SRC_PATTERN);
  it.each(imageCases)("image src %j", (value) => {
    expect(imageRe.test(value)).toBe(isSafeImageSrc(value));
  });

  it("rejects a long image src with a bad character in linear time (also with the u flag)", () => {
    const value = `a${" ".repeat(80_000)}\u0001`;
    for (const re of [imageRe, new RegExp(SAFE_IMAGE_SRC_PATTERN, "u")]) {
      const t0 = performance.now();
      expect(re.test(value)).toBe(false);
      expect(performance.now() - t0).toBeLessThan(200);
    }
    expect(isSafeImageSrc(value)).toBe(false);
    expect(imageRe.test(` https://cdn.example/a b.png \t`)).toBe(
      isSafeImageSrc(` https://cdn.example/a b.png \t`),
    );
  });

  const videoRe = new RegExp(SAFE_VIDEO_SRC_PATTERN);
  it.each(imageCases)("video src %j", (value) => {
    expect(videoRe.test(value)).toBe(isSafeVideoSrc(value));
  });
  it("never accepts data: URIs as a video src", () => {
    for (const value of ["data:video/mp4;base64,AAAA", "data:image/png;base64,AAAA", " DATA:x"]) {
      expect(isSafeVideoSrc(value), value).toBe(false);
      expect(videoRe.test(value), value).toBe(false);
    }
    expect(isSafeVideoSrc("https://cdn.example/intro.mp4")).toBe(true);
    expect(isSafeVideoSrc("/media/intro.webm")).toBe(true);
    expect(isSafeVideoSrc("asset:intro-video")).toBe(true);
  });

  const linkRe = new RegExp(SAFE_LINK_HREF_PATTERN);
  it.each([
    "https://example.com/a?b=c#d",
    "HTTP://example.com",
    "http://",
    "https:///x",
    "https://a b",
    "mailto:team@example.com",
    "mailto:",
    "tel:+3511234",
    "tel:abc",
    "#section",
    "#",
    "/docs/intro",
    "/",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "data:text/html,x",
    "relative/path",
    " https://example.com",
    "https://example.com ",
    "https://example.com\n",
    "https://exa\u0001mple.com",
    "https://example.com/\u007f",
    "",
  ])("link href %j", (value) => {
    expect(linkRe.test(value)).toBe(isSafeLinkHref(value));
  });

  const colorRe = new RegExp(SAFE_CSS_COLOR.source);
  it.each([
    "#fff",
    "#3b5bdb",
    "rebeccapurple",
    "rgb(1, 2, 3)",
    "oklch(0.7 0.1 250)",
    "url(https://x)",
    "var(--x)",
    "red; background: url(x)",
    "rgb(calc(1))",
  ])("colour %j", (value) => {
    expect(colorRe.test(value)).toBe(isSafeCssColor(value));
  });
});

describe("fields a module does not use", () => {
  const widget = (type: string, key: string) =>
    (getModuleJsonSchema(type)!.properties as Record<string, { "x-ui"?: { widget?: string } }>)[
      key
    ]?.["x-ui"]?.widget;

  it.each(["callout", "accordion", "tabs", "carousel", "columns"])(
    "%s: feedback and scoring are hidden in forms but still valid in JSON",
    (type) => {
      expect(widget(type, "feedback")).toBe("hidden");
      expect(widget(type, "scoring")).toBe("hidden");
      const schema = getModuleJsonSchema(type)!.properties as Record<string, unknown>;
      expect(schema.feedback).toBeDefined();
      expect(schema.scoring).toBeDefined();
    },
  );

  it("callout: the block title and instructions are hidden, its heading is labelled", () => {
    expect(widget("callout", "title")).toBe("hidden");
    expect(widget("callout", "instructions")).toBe("hidden");
    expect(widget("accordion", "title")).not.toBe("hidden");
    const content = (
      getModuleJsonSchema("callout")!.properties as {
        content: { properties: Record<string, { title?: string }> };
      }
    ).content.properties;
    expect(content.title!.title).toBe("Heading");
  });

  it("activities keep them visible", () => {
    expect(widget("choice-challenge", "feedback")).not.toBe("hidden");
    expect(widget("flashcards", "scoring")).not.toBe("hidden");
  });
});

describe("hints for forms", () => {
  type Node = {
    properties?: Record<string, Node>;
    items?: Node;
    description?: string;
    "x-ui"?: { ref?: string[] };
  };
  const props = (type: string) => getModuleJsonSchema(type) as Node;

  it("ids that point at another item name the lists it may be in", () => {
    const sort = props("category-sort").properties!.content!.properties!;
    expect(sort.items!.items!.properties!.categoryId!["x-ui"]?.ref).toEqual(["categories"]);
    const stage = props("process-explorer").properties!.content!.properties!.stages!.items!;
    expect(stage.properties!.dependsOn!.items!["x-ui"]?.ref).toEqual(["stages"]);
    expect(
      props("branching-scenario").properties!.content!.properties!.start!["x-ui"]?.ref,
    ).toEqual(["nodes"]);
  });

  it("descriptions are written for authors, not for developers", () => {
    const walk = (node: Node, out: string[]) => {
      if (node.description) out.push(node.description);
      for (const child of Object.values(node.properties ?? {})) walk(child, out);
      if (node.items) walk(node.items, out);
      return out;
    };
    for (const type of builtInModuleTypes)
      for (const text of walk(props(type), [])) expect(text).not.toMatch(/[a-z]Schema\b/);
  });

  it("getModuleLimits lists list sizes by path", () => {
    const limits = getModuleLimits("choice-challenge")!;
    expect(limits["content.questions"]).toEqual({ min: 1, max: 50 });
    expect(limits["content.questions.*.options"]?.max).toBeGreaterThan(1);
    expect(getModuleLimits("flashcards")!["content.cards"]?.max).toBe(200);
    expect(getModuleLimits("nope")).toBeUndefined();
  });
});
