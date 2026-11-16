import type { AnalyticsAdapter, NibblearnEvent } from "./events";

/** The learner, identified by exactly one of `mbox` or `account`. */
export interface XapiActor {
  name?: string;
  mbox?: `mailto:${string}`;
  account?: { homePage: string; name: string };
}

export interface XapiOptions {
  actor: XapiActor;
  /** Absolute http(s) IRI prefix for activity ids, e.g. "https://example.com/learning". */
  activityBaseIri: string;
  lesson?: { id: string; title?: string };
  /** Describes the module the event comes from (title, pass threshold). */
  module?: { id: string; type: string; title?: string; passThreshold?: number };
  /** xAPI registration (UUID) of this attempt. */
  registration?: string;
  /** Language of names in activity definitions. Default "en". */
  language?: string;
  /** Also send `interacted` statements for `module:interact` and `module:hint`. Default false. */
  includeInteractions?: boolean;
  /**
   * Add cmi5 context. Lesson statements (initialized, completed, passed, failed) become
   * "cmi5 defined" statements about the AU: the `cmi5` category, `moveon` on completed /
   * passed / failed, `masteryscore` on passed / failed, and `activityId` (the AU id from the
   * launch URL) as their object. Module statements are "cmi5 allowed": session id only.
   * Launching the AU and sending `terminated` are up to the host.
   */
  cmi5?: { sessionId: string; masteryScore?: number; activityId?: string };
}

/** A minimal xAPI statement (1.0.3). The LRS assigns `id` and `stored`. */
export interface XapiStatement {
  actor: { objectType: "Agent" } & XapiActor;
  verb: { id: string; display: Record<string, string> };
  object: {
    objectType: "Activity";
    id: string;
    definition: { type: string; name?: Record<string, string> };
  };
  result?: {
    success?: boolean;
    completion?: boolean;
    response?: string;
    duration?: string;
    score?: { scaled?: number; raw?: number; min?: number; max?: number };
    extensions?: Record<string, unknown>;
  };
  context?: {
    registration?: string;
    contextActivities?: {
      parent?: { objectType: "Activity"; id: string }[];
      category?: { objectType: "Activity"; id: string }[];
    };
    extensions?: Record<string, unknown>;
  };
  timestamp: string;
}

const VERB = "http://adlnet.gov/expapi/verbs/";
const ACTIVITY = "http://adlnet.gov/expapi/activities/";
const EXT = "https://github.com/ifgolubev/nibblearn/xapi/extensions/";
const CMI5 = "https://w3id.org/xapi/cmi5/";

const verb = (name: string) => ({ id: `${VERB}${name}`, display: { "en-US": name } });

/** Milliseconds as an ISO 8601 duration with centisecond precision, e.g. 12345 → "PT12.35S". */
export function toIsoDuration(ms: number): string {
  const cs = Math.max(0, Math.round(ms / 10));
  const hours = Math.floor(cs / 360000);
  const minutes = Math.floor((cs % 360000) / 6000);
  const seconds = (cs % 6000) / 100;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${seconds || (!hours && !minutes) ? `${seconds}S` : ""}`;
}

function checkOptions(o: XapiOptions) {
  if (!/^https?:\/\/[^\s/]+/i.test(o.activityBaseIri))
    throw new TypeError("xAPI: activityBaseIri must be an absolute http(s) IRI");
  const ids = [o.actor.mbox, o.actor.account].filter(Boolean).length;
  if (ids !== 1) throw new TypeError("xAPI: the actor needs exactly one of mbox or account");
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/**
 * Turn a Nibblearn event into xAPI statements (zero, one or two). Nothing is sent: pass the
 * statements to your LRS client, or use `createXapiAdapter`.
 */
export function eventToXapiStatements(
  event: NibblearnEvent,
  options: XapiOptions,
): XapiStatement[] {
  checkOptions(options);
  const lang = options.language ?? "en";
  const base = options.activityBaseIri.replace(/\/+$/, "");
  const lessonId = event.lessonId ?? options.lesson?.id;
  const moduleId = event.moduleId ?? options.module?.id;
  const lessonIri = lessonId ? `${base}/${encodeURIComponent(lessonId)}` : base;
  const isModule = event.type.startsWith("module:");
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  const object = (): XapiStatement["object"] => {
    if (isModule && moduleId) {
      const scored = num(payload.score) !== undefined || event.type === "module:answer";
      const title = options.module?.id === moduleId ? options.module.title : undefined;
      return {
        objectType: "Activity",
        id: `${lessonIri}/${encodeURIComponent(moduleId)}`,
        definition: {
          type: `${ACTIVITY}${scored ? "assessment" : "module"}`,
          ...(title ? { name: { [lang]: title } } : {}),
        },
      };
    }
    const title = options.lesson?.title;
    return {
      objectType: "Activity",
      id: options.cmi5?.activityId ?? lessonIri,
      definition: { type: `${ACTIVITY}lesson`, ...(title ? { name: { [lang]: title } } : {}) },
    };
  };

  // cmi5 defined statements are the lesson (AU) statements; module statements are "allowed".
  const cmi5Defined = Boolean(options.cmi5) && !isModule;
  const context = (moveOn = false, mastery = false): XapiStatement["context"] => {
    const categories = cmi5Defined
      ? [
          { objectType: "Activity" as const, id: `${CMI5}context/categories/cmi5` },
          ...(moveOn
            ? [{ objectType: "Activity" as const, id: `${CMI5}context/categories/moveon` }]
            : []),
        ]
      : [];
    const extensions: Record<string, unknown> = {};
    if (event.moduleType) extensions[`${EXT}module-type`] = event.moduleType;
    if (options.cmi5) extensions[`${CMI5}context/extensions/sessionid`] = options.cmi5.sessionId;
    if (cmi5Defined && mastery && options.cmi5?.masteryScore !== undefined)
      extensions[`${CMI5}context/extensions/masteryscore`] = options.cmi5.masteryScore;
    return {
      ...(options.registration ? { registration: options.registration } : {}),
      contextActivities: {
        ...(isModule && lessonId
          ? { parent: [{ objectType: "Activity" as const, id: lessonIri }] }
          : {}),
        ...(categories.length ? { category: categories } : {}),
      },
      ...(Object.keys(extensions).length ? { extensions } : {}),
    };
  };

  const statement = (
    name: string,
    result?: XapiStatement["result"],
    moveOn = false,
    mastery = false,
  ): XapiStatement => ({
    actor: { objectType: "Agent", ...options.actor },
    verb: verb(name),
    object: object(),
    ...(result ? { result } : {}),
    context: context(moveOn, mastery),
    timestamp: event.timestamp,
  });

  const scoreResult = (score: number | undefined, correct?: number, total?: number) =>
    score === undefined && correct === undefined
      ? undefined
      : {
          ...(score !== undefined ? { scaled: Math.round(score * 10000) / 10000 } : {}),
          ...(correct !== undefined && total !== undefined
            ? { raw: correct, min: 0, max: total }
            : {}),
        };

  switch (event.type) {
    case "lesson:start":
      return [statement("initialized")];
    case "lesson:resume":
      return [statement("resumed")];
    case "module:start":
      return [statement("attempted")];
    case "module:answer": {
      const response = payload.response;
      return [
        statement("answered", {
          ...(typeof payload.correct === "boolean" ? { success: payload.correct } : {}),
          ...(response !== undefined
            ? { response: typeof response === "string" ? response : JSON.stringify(response) }
            : {}),
          ...(num(payload.score) !== undefined ? { score: { scaled: num(payload.score) } } : {}),
        }),
      ];
    }
    case "module:complete":
    case "lesson:complete": {
      const score = num(payload.score);
      const threshold =
        event.type === "lesson:complete"
          ? options.cmi5?.masteryScore
          : ((options.module?.id === moduleId ? options.module?.passThreshold : undefined) ??
            options.cmi5?.masteryScore);
      const passedFlag =
        event.type === "lesson:complete" && typeof payload.passed === "boolean"
          ? payload.passed
          : score !== undefined && threshold !== undefined
            ? score >= threshold
            : undefined;
      const durationMs = num(payload.durationMs);
      const result: XapiStatement["result"] = {
        completion: true,
        ...(durationMs !== undefined ? { duration: toIsoDuration(durationMs) } : {}),
        ...(scoreResult(score, num(payload.correct), num(payload.total))
          ? { score: scoreResult(score, num(payload.correct), num(payload.total)) }
          : {}),
        ...(num(payload.attempts) !== undefined
          ? { extensions: { [`${EXT}attempts`]: payload.attempts } }
          : {}),
      };
      const out = [statement("completed", result, true)];
      if (passedFlag !== undefined)
        out.push(
          statement(
            passedFlag ? "passed" : "failed",
            {
              success: passedFlag,
              ...(result.duration ? { duration: result.duration } : {}),
              ...(result.score ? { score: result.score } : {}),
            },
            true,
            true,
          ),
        );
      return out;
    }
    case "module:interact":
    case "module:hint":
      if (!options.includeInteractions) return [];
      return [
        statement("interacted", {
          extensions: {
            [`${EXT}action`]:
              event.type === "module:hint" ? "hint" : (payload.action ?? "interact"),
          },
        }),
      ];
    default:
      return [];
  }
}

/**
 * An analytics adapter that converts every event and hands the statements to `send`
 * (your LRS client). Nibblearn does not send anything itself.
 */
export function createXapiAdapter(
  options: XapiOptions & { send: (statement: XapiStatement) => void | Promise<void> },
): AnalyticsAdapter {
  checkOptions(options);
  const { send, ...rest } = options;
  return {
    track: (event) => {
      for (const s of eventToXapiStatements(event, rest)) void send(s);
    },
  };
}
