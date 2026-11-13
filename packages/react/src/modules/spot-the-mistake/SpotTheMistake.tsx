import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "motion/react";
import { AlertCircle, Check, Eye, Lightbulb, Search, X } from "lucide-react";
import clsx from "clsx";
import {
  findAllScore,
  spotTheMistakeSchema,
  type Mistake,
  type SpotTheMistakeConfig,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { Badge } from "../../primitives/Badge";
import { AnimatedFeedback, type FeedbackTone } from "../../primitives/Feedback";
import { RichText } from "../../primitives/RichText";
import { SafeImage } from "../../primitives/SafeImage";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./spot-the-mistake.css";

export type SpotTheMistakeProps = ModuleProps<SpotTheMistakeConfig>;

export function SpotTheMistake({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: SpotTheMistakeProps) {
  const parsed = useMemo(() => spotTheMistakeSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="spot-the-mistake"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <SpotLifecycle
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

function SpotLifecycle({
  config,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: SpotTheMistakeProps) {
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "spot-the-mistake",
    onComplete,
    onEvent,
    resetKey,
  });
  return (
    <SpotBody
      key={life.runId}
      config={config}
      life={life}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

interface BodyProps {
  config: SpotTheMistakeConfig;
  life: ModuleLifecycle;
  hideHeader?: boolean;
  className?: string;
}

type TargetState = "idle" | "selected" | "found" | "wrong" | "missed";

interface FeedbackState {
  key: number;
  tone: FeedbackTone;
  title: string;
  text?: string;
}

/** Values that read better in a monospace face: ids, amounts, dates, URLs, UTM strings. */
const MONO_RE = /^(https?:\/\/|[A-Z0-9_-]{3,}$|[\d\s.,:/+%€$£¥-]+$|[\d]{2,})|[?&]utm_|\{[a-z_]+\}/;

function SpotBody({ config, life, hideHeader, className }: BodyProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { canvas, mistakes, summary } = config.content;
  const { behavior } = config;
  const total = mistakes.length;
  const instant = behavior.checkMode === "instant";

  const mistakeByTarget = useMemo(() => new Map(mistakes.map((m) => [m.targetId, m])), [mistakes]);
  const mistakeIndex = useMemo(
    () => new Map(mistakes.map((m, i) => [m.targetId, i + 1])),
    [mistakes],
  );
  const targetLabel = useMemo(() => {
    const map = new Map<string, string>();
    if (canvas.kind === "image") canvas.regions.forEach((r) => map.set(r.id, r.label));
    else canvas.rows.forEach((r) => map.set(r.id, r.label));
    return map;
  }, [canvas]);
  const sectionOf = useMemo(() => {
    const map = new Map<string, string | undefined>();
    if (canvas.kind === "document") canvas.rows.forEach((r) => map.set(r.id, r.section));
    return map;
  }, [canvas]);

  const [found, setFound] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [shaking, setShaking] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [hint, setHint] = useState<{ text: string; targetId: string } | null>(null);
  const [finished, setFinished] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const remaining = useMemo(
    () => mistakes.filter((m) => !found.includes(m.targetId)),
    [mistakes, found],
  );

  const finish = useCallback(
    (nextFound: string[], nextWrong: string[], reveal: boolean) => {
      const score = findAllScore(nextFound.length, total, nextWrong.length);
      setFinished(true);
      setRevealed(reveal);
      setHint(null);
      life.complete({
        score,
        correct: nextFound.length,
        total,
        details: {
          found: nextFound,
          wrongPicks: nextWrong,
          revealed: reveal,
          hintsUsed: hintCount,
        },
      });
      announce(nextFound.length === total ? t("spot.allFound") : t("a11y.moduleComplete"));
    },
    [total, life, hintCount, announce, t],
  );

  const describe = useCallback(
    (m: Mistake): { title: string; text: string } => ({
      title: m.title ? `${t("spot.foundOne")} ${m.title}` : t("spot.foundOne"),
      text: m.explanation,
    }),
    [t],
  );

  const applyPicks = useCallback(
    (picks: string[]) => {
      const hits = picks.filter((id) => mistakeByTarget.has(id) && !found.includes(id));
      const misses = picks.filter((id) => !mistakeByTarget.has(id) && !wrong.includes(id));
      const nextFound = [...found, ...hits];
      const nextWrong = [...wrong, ...misses];
      setFound(nextFound);
      setWrong(nextWrong);
      setSelected([]);
      life.attempt();
      life.emit("module:answer", {
        picks,
        hits,
        misses,
        found: nextFound.length,
        wrongPicks: nextWrong.length,
      });
      if (hits.length) setHint(null);

      const allFound = nextFound.length >= total;
      const overLimit = behavior.maxWrong > 0 && nextWrong.length > behavior.maxWrong;
      if (instant) {
        const id = picks[0]!;
        const m = mistakeByTarget.get(id);
        if (m) {
          const d = describe(m);
          setFeedback({ key: Date.now(), tone: "correct", ...d });
          announce(`${t("a11y.correctAnswer")} ${d.title}`);
        } else {
          setShaking(id);
          setFeedback({ key: Date.now(), tone: "incorrect", title: t("spot.notAMistake") });
          announce(`${t("a11y.incorrectAnswer")} ${t("spot.notAMistake")}`);
        }
      } else {
        const tone: FeedbackTone =
          hits.length && !misses.length ? "correct" : hits.length ? "partial" : "incorrect";
        setFeedback({
          key: Date.now(),
          tone,
          title: t("spot.found", { found: nextFound.length, total }),
          text: misses.length ? t("spot.wrongPicks", { count: misses.length }) : undefined,
        });
        if (misses.length) setShaking(misses[0]!);
        announce(t("spot.found", { found: nextFound.length, total }));
      }
      if (allFound) finish(nextFound, nextWrong, false);
      else if (overLimit) finish(nextFound, nextWrong, true);
    },
    [
      mistakeByTarget,
      found,
      wrong,
      life,
      total,
      behavior.maxWrong,
      instant,
      describe,
      announce,
      t,
      finish,
    ],
  );

  const onTarget = useCallback(
    (id: string) => {
      if (finished) return;
      if (found.includes(id)) return;
      life.emit("module:interact", { targetId: id });
      if (instant) {
        if (wrong.includes(id)) return;
        applyPicks([id]);
      } else {
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      }
    },
    [finished, found, wrong, instant, applyPicks, life],
  );

  const showHint = useCallback(() => {
    if (remaining.length === 0) return;
    const m = remaining[hintCount % remaining.length]!;
    setHint({ text: m.hint ?? t("spot.hintArea"), targetId: m.targetId });
    setHintCount((c) => c + 1);
    life.emit("module:hint", { targetId: m.targetId, index: hintCount });
  }, [remaining, hintCount, life, t]);

  const stateFor = (id: string): TargetState => {
    if (found.includes(id)) return "found";
    if (revealed && mistakeByTarget.has(id)) return "missed";
    if (wrong.includes(id)) return "wrong";
    if (selected.includes(id)) return "selected";
    return "idle";
  };

  const hintSection =
    hint && !mistakeByTarget.get(hint.targetId)?.hint ? sectionOf.get(hint.targetId) : undefined;
  const hintTarget =
    hint && !mistakeByTarget.get(hint.targetId)?.hint && !hintSection ? hint.targetId : undefined;

  const renderMarker = (id: string, state: TargetState): ReactNode => {
    if (state !== "found" && state !== "missed") return null;
    return (
      <span className="nb-spot__marker" data-state={state} aria-hidden>
        {state === "found" ? mistakeIndex.get(id) : <AlertCircle strokeWidth={2.5} />}
      </span>
    );
  };

  const shakeProps = (id: string) =>
    !reduced && shaking === id
      ? {
          animate: { x: [0, -6, 6, -4, 4, 0] },
          transition: { duration: 0.36 },
          onAnimationComplete: () => setShaking(null),
        }
      : { animate: { x: 0 } };

  // Image regions have no visible text, so they get an aria-label. Document rows keep their
  // visible text as the accessible name (WCAG 2.5.3) with a visually hidden "Select" prefix.
  const targetAria = (id: string, state: TargetState, labelled = true) => ({
    "aria-label": labelled ? t("spot.selectArea", { label: targetLabel.get(id) ?? id }) : undefined,
    "aria-pressed": instant ? undefined : state === "selected" || state === "found",
    disabled: finished || state === "found" || (instant && state === "wrong"),
    "data-state": state,
    "data-hinted": hintTarget === id ? "true" : undefined,
  });

  const documentCanvas = canvas.kind === "document" && (
    <article className="nb-spot__doc" aria-label={canvas.title}>
      <header className="nb-spot__doc-head">
        <div className="nb-spot__doc-kicker">
          <span className="nb-spot__doc-dot" aria-hidden />
          {canvas.title}
        </div>
        {canvas.subtitle && <p className="nb-spot__doc-subtitle">{canvas.subtitle}</p>}
      </header>
      {groupRows(canvas.rows).map((group, gi) => (
        <section
          key={gi}
          className="nb-spot__section"
          data-hinted={hintSection && group.section === hintSection ? "true" : undefined}
          aria-label={group.section}
        >
          {group.section && <h4 className="nb-spot__section-title">{group.section}</h4>}
          <div className="nb-spot__rows">
            {group.rows.map((row) => {
              const state = stateFor(row.id);
              return (
                <motion.div key={row.id} className="nb-spot__row-wrap" {...shakeProps(row.id)}>
                  <button
                    type="button"
                    className="nb-spot__row"
                    onClick={() => onTarget(row.id)}
                    {...targetAria(row.id, state, false)}
                  >
                    <span className="nb-sr-only">
                      {t("spot.selectArea", { label: "" }).trim()}{" "}
                    </span>
                    <span className="nb-spot__row-label">{row.label}</span>
                    <span className="nb-spot__row-body">
                      <span
                        className={clsx(
                          "nb-spot__row-value",
                          MONO_RE.test(row.value) && "nb-spot__row-value--mono",
                        )}
                      >
                        {row.value}
                      </span>
                      {row.note && <span className="nb-spot__row-note">{row.note}</span>}
                    </span>
                    <span className="nb-spot__row-end" aria-hidden>
                      {state === "idle" || state === "selected" ? (
                        <span className="nb-spot__magnifier">
                          {state === "selected" ? <Check strokeWidth={3} /> : <Search />}
                        </span>
                      ) : state === "wrong" ? (
                        <span className="nb-spot__marker" data-state="wrong">
                          <X strokeWidth={3} />
                        </span>
                      ) : (
                        renderMarker(row.id, state)
                      )}
                    </span>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </section>
      ))}
    </article>
  );

  const imageCanvas = canvas.kind === "image" && (
    <div
      className="nb-spot__stage"
      style={
        canvas.image.width && canvas.image.height
          ? { aspectRatio: `${canvas.image.width} / ${canvas.image.height}` }
          : undefined
      }
    >
      <SafeImage media={canvas.image} className="nb-spot__image" showCaption={false} />
      {canvas.regions.map((r) => {
        const state = stateFor(r.id);
        const style: CSSProperties = {
          left: `${r.x}%`,
          top: `${r.y}%`,
          width: `${r.width}%`,
          height: `${r.height}%`,
        };
        return (
          <motion.button
            key={r.id}
            type="button"
            className="nb-spot__region"
            style={style}
            onClick={() => onTarget(r.id)}
            {...targetAria(r.id, state)}
            {...shakeProps(r.id)}
          >
            {state === "wrong" ? (
              <span className="nb-spot__marker" data-state="wrong" aria-hidden>
                <X strokeWidth={3} />
              </span>
            ) : (
              renderMarker(r.id, state)
            )}
          </motion.button>
        );
      })}
    </div>
  );

  const score = findAllScore(found.length, total, wrong.length);

  return (
    <ModuleShell
      type="spot-the-mistake"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={
        hideHeader ? undefined : (config.instructions ?? t("spot.instructions", { count: total }))
      }
      appearance={config.appearance}
      className={className}
      announcement={message}
      aside={
        <span className="nb-spot__stats">
          <Badge tone={found.length === total ? "success" : "accent"}>
            <Check aria-hidden strokeWidth={3} />
            {t("spot.found", { found: found.length, total })}
          </Badge>
          <Badge tone={wrong.length ? "danger" : "neutral"}>
            <X aria-hidden strokeWidth={3} />
            {t("spot.wrongPicks", { count: wrong.length })}
          </Badge>
        </span>
      }
    >
      {documentCanvas}
      {imageCanvas}

      {hint && !finished && (
        <motion.div
          key={hint.targetId + hintCount}
          className="nb-spot__hint"
          role="note"
          initial={reduced ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <Lightbulb aria-hidden />
          <RichText text={hint.text} />
        </motion.div>
      )}

      <AnimatedFeedback
        show={feedback !== null && !finished}
        tone={feedback?.tone ?? "info"}
        title={feedback?.title}
        text={feedback?.text}
      />

      {!finished && (
        <div className="nb-spot__footer">
          <div className="nb-spot__footer-left">
            {behavior.allowHints && remaining.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                leading={<Lightbulb aria-hidden />}
                onClick={showHint}
              >
                {t("common.showHint")}
              </Button>
            )}
            {wrong.length >= 2 && (
              <Button
                variant="ghost"
                size="sm"
                leading={<Eye aria-hidden />}
                onClick={() => finish(found, wrong, true)}
              >
                {t("spot.revealRemaining")}
              </Button>
            )}
          </div>
          {!instant && (
            <div className="nb-module__actions">
              <Button
                variant="primary"
                onClick={() => applyPicks(selected)}
                disabled={selected.length === 0}
              >
                {t("common.submit")}
              </Button>
            </div>
          )}
        </div>
      )}

      {finished && (
        <CompletionCard
          score={score}
          passThreshold={Math.max(config.scoring.passThreshold, 0.7)}
          title={found.length === total ? t("spot.allFound") : undefined}
          text={config.feedback.complete ?? summary ?? undefined}
          onRetry={
            behavior.allowRetry
              ? () => {
                  life.reset();
                  life.emit("module:reset");
                }
              : undefined
          }
        >
          <div className="nb-spot__result-badges">
            <Badge tone={found.length === total ? "success" : "accent"}>
              <Check aria-hidden strokeWidth={3} />
              {t("spot.found", { found: found.length, total })}
            </Badge>
            <Badge tone={wrong.length ? "danger" : "neutral"}>
              <X aria-hidden strokeWidth={3} />
              {t("spot.wrongPicks", { count: wrong.length })}
            </Badge>
          </div>
          <section className="nb-spot__list" aria-label={t("spot.mistakeList")}>
            <h4 className="nb-spot__list-title">{t("spot.mistakeList")}</h4>
            <ol className="nb-spot__list-items">
              {mistakes.map((m, i) => {
                const ok = found.includes(m.targetId);
                return (
                  <li
                    key={m.targetId}
                    className="nb-spot__list-item"
                    data-ok={ok ? "true" : "false"}
                  >
                    <span className="nb-spot__list-icon" aria-hidden>
                      {ok ? <Check strokeWidth={3} /> : <X strokeWidth={3} />}
                    </span>
                    <span className="nb-spot__list-body">
                      <span className="nb-spot__list-head">
                        <span className="nb-spot__list-num">{i + 1}</span>
                        <strong>{m.title ?? targetLabel.get(m.targetId)}</strong>
                        <span className="nb-spot__list-target">{targetLabel.get(m.targetId)}</span>
                        <span className="nb-sr-only">
                          {ok ? t("common.correct") : t("common.incorrect")}
                        </span>
                      </span>
                      <span className="nb-spot__list-text">
                        <RichText text={m.explanation} />
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
          {summary && config.feedback.complete && (
            <p className="nb-spot__summary">
              <RichText text={summary} />
            </p>
          )}
        </CompletionCard>
      )}
    </ModuleShell>
  );
}

/** Group document rows by section, preserving first-appearance order. Rows without a section form their own group. */
function groupRows<T extends { section?: string }>(rows: T[]): { section?: string; rows: T[] }[] {
  const groups: { section?: string; rows: T[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.section === row.section) last.rows.push(row);
    else groups.push({ section: row.section, rows: [row] });
  }
  return groups;
}

export default SpotTheMistake;
