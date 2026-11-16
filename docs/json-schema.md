# JSON Schema

Nibblearn's schemas are written in Zod, but backends that are not written in JavaScript still need to check a module or a lesson before storing it. `@nibblearn/core` ships a [JSON Schema](https://json-schema.org/) (draft 2020-12) for every built-in module and for the lesson format.

## Files in the package

| Import path                                  | Contents                                       |
| -------------------------------------------- | ---------------------------------------------- |
| `@nibblearn/core/schemas/<type>.schema.json` | One module type, e.g. `true-false.schema.json` |
| `@nibblearn/core/schemas/module.schema.json` | Any built-in module (`oneOf` over all types)   |
| `@nibblearn/core/schemas/lesson.schema.json` | A whole lesson, `schemaVersion: 1`             |
| `@nibblearn/core/schemas/index.json`         | Package version and the list of module files   |

Every schema has an `$id`: `urn:nibblearn:module:<type>:<version>`, `urn:nibblearn:module` and `urn:nibblearn:lesson:1`. Schemas are self-contained (no `$ref`).

To copy them into a Java or Python project, take them from the installed package (`node_modules/@nibblearn/core/dist/schemas/`) or from the npm tarball.

## Generating schemas at runtime

```ts
import { getModuleJsonSchema, getAnyModuleJsonSchema, getLessonJsonSchema } from "@nibblearn/core";

const flashcards = getModuleJsonSchema("flashcards");
const anyModule = getAnyModuleJsonSchema();
const lesson = getLessonJsonSchema();
```

Pass `{ registry }` to include custom modules, and `{ io: "output" }` for the parsed form, in which every field that has a default is required. The default, `io: "input"`, describes what authors write.

## Validating on the JVM

With [networknt/json-schema-validator](https://github.com/networknt/json-schema-validator):

```java
JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
JsonSchema schema = factory.getSchema(getClass().getResourceAsStream("/nibblearn/module.schema.json"));

Set<ValidationMessage> errors = schema.validate(new ObjectMapper().readTree(blockJson));
if (!errors.isEmpty()) {
    throw new IllegalArgumentException(errors.toString());
}
```

## What JSON Schema does not check

JSON Schema describes shapes and value ranges. Some rules depend on several fields at once; Nibblearn writes them as Zod refinements and they are **not** part of the exported schemas. Run `validateModule()` / `validateLesson()` where you can (for example in a Node service or in the authoring UI), and treat the JSON Schema as the first line of defence.

Safety checks are covered: colours (`appearance.accent`, `theme.accent`, colour fields of modules), fonts and image addresses carry a `pattern` equivalent to the runtime checks. The colour pattern does not trim surrounding spaces, so `" #fff"` passes `validateModule()` but not the JSON Schema. Validators that use Java's regular expressions treat `\s` as ASCII whitespace only.

Checks not covered by JSON Schema:

| Module             | Rule                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| lesson             | module ids are unique                                                                                                   |
| branching-scenario | node ids are unique; the start node exists; decision nodes have choices; every choice points to a node                  |
| budget-allocator   | `step` divides 100; channel ids are unique; `initial` covers every channel exactly and sums to 100                      |
| category-sort      | every item refers to an existing category                                                                               |
| choice-challenge   | every question has at least one correct option                                                                          |
| conversation       | the start node exists; every response points to a node                                                                  |
| estimate           | question ids are unique; `max > min`; the answer is within range; `step` and `tolerance` fit the range                  |
| fill-blanks        | every `{{id}}` in the template has a blank and every blank is used                                                      |
| image-compare      | annotation and option ids are unique; at least one option is correct                                                    |
| inbox-triage       | action and message ids are unique; messages refer to existing actions; acceptable actions do not repeat the correct one |
| label-diagram      | labels and target ids are unique                                                                                        |
| priority-matrix    | quadrant and item ids are unique; positions and items refer to existing quadrants                                       |
| process-explorer   | stage and branch references point to existing stages                                                                    |
| spot-the-mistake   | every mistake refers to an existing target                                                                              |
| what-if-simulator  | formulas parse and only reference known inputs; `max > min`; defaults are within range                                  |
| word-builder       | tokens are not blank; item ids are unique; alternatives use exactly the same tokens                                     |
