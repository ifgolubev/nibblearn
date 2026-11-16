# xAPI and cmi5

Corporate learning systems record learning as [xAPI](https://github.com/adlnet/xAPI-Spec) statements in a Learning Record Store (LRS). `@nibblearn/core` turns Nibblearn events into xAPI statements. It does not send anything: you pass the statements to your own LRS client, with your own authentication.

> **Status:** the statement structure is covered by unit tests, but this integration has not been tested against a real LRS or LMS yet. Please report what you find.

## Quick start

```ts
import { createXapiAdapter } from "@nibblearn/core";
import { LessonPlayer } from "@nibblearn/react";

const xapi = createXapiAdapter({
  actor: { name: "Ada Lovelace", account: { homePage: "https://learn.example.com", name: "user-42" } },
  activityBaseIri: "https://learn.example.com/xapi/lessons",
  lesson: { id: lesson.id, title: lesson.title },
  registration: crypto.randomUUID(),
  send: (statement) =>
    fetch("/api/lrs/statements", { method: "POST", body: JSON.stringify(statement) }),
});

<LessonPlayer lesson={lesson} onEvent={xapi.track} />;
```

Send statements to your own server and forward them to the LRS from there, so LRS credentials never reach the browser.

## Mapping

| Nibblearn event                  | xAPI verb (`http://adlnet.gov/expapi/verbs/…`)                              | Result                                                                           |
| -------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `lesson:start`                   | `initialized`                                                               | —                                                                                |
| `lesson:resume`                  | `resumed`                                                                   | —                                                                                |
| `module:start`                   | `attempted`                                                                 | —                                                                                |
| `module:answer`                  | `answered`                                                                  | `success`, `response` (JSON for non-strings), `score.scaled`                     |
| `module:complete`                | `completed`, plus `passed` / `failed` when there is a score and a threshold | `completion`, `score` (`scaled`, `raw` / `max` from correct / total), `duration` |
| `lesson:complete`                | `completed` + `passed` / `failed`                                           | as above                                                                         |
| `module:interact`, `module:hint` | `interacted`, only with `includeInteractions: true`                         | the action as an extension                                                       |
| `*:reset`, `lesson:navigate`     | no statement                                                                |                                                                                  |

Activities: the lesson is `{activityBaseIri}/{lessonId}` with type `…/activities/lesson`; a module is `{activityBaseIri}/{lessonId}/{moduleId}` with type `…/activities/assessment` (scored) or `…/activities/module`, and the lesson as its parent. The pass threshold of a module comes from `options.module.passThreshold` (use the module's `scoring.passThreshold`) or the cmi5 mastery score.

`eventToXapiStatements(event, options)` returns the statements for one event if you prefer to batch them yourself.

## cmi5

Pass `cmi5: { sessionId, activityId?, masteryScore? }` when Nibblearn runs as a cmi5 assignable unit (AU). `activityId` is the `activityId` from the launch URL.

- Lesson statements (`initialized`, `completed`, `passed`, `failed`) are "cmi5 defined" statements: their object is the AU (`activityId`), they carry the `cmi5` category, and `completed` / `passed` / `failed` also carry the `moveon` category and a `duration`. `passed` / `failed` include the `masteryscore` extension when `masteryScore` is set.
- Module statements are "cmi5 allowed": no cmi5 or moveon category, with the session id.
- Every statement carries the `…/cmi5/context/extensions/sessionid` extension.

The cmi5 launch sequence (reading the launch URL, fetching the auth token, sending `terminated`) is the host's job.
