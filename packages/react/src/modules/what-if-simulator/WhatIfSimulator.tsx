import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, Minus, Plus, RotateCcw, Target } from "lucide-react";
import clsx from "clsx";
import {
  activeInsights,
  challengeMet,
  computeOutputs,
  defaultInputs,
  formatValue,
  whatIfSimulatorSchema,
  type SimulatorInput,
  type SimulatorOutput,
  type SimulatorScope,
  type WhatIfSimulatorConfig,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { Feedback, AnimatedFeedback, type FeedbackTone } from "../../primitives/Feedback";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./what-if-simulator.css";

export type WhatIfSimulatorProps = ModuleProps<WhatIfSimulatorConfig>;

type Format = SimulatorInput["format"];

const INTERACT_DEBOUNCE_MS = 150;
const COMPLETE_DEBOUNCE_MS = 600;
const COUNT_UP_MS = 280;

const INSIGHT_TONE: Record<"info" | "success" | "warning", FeedbackTone> = {
  info: "info",
  success: "correct",
  warning: "partial",
};

export function WhatIfSimulator({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: WhatIfSimulatorProps) {
  const parsed = useMemo(() => whatIfSimulatorSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="what-if-simulator"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <WhatIfSimulatorInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/* ----------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

function decimalsOf(step: number): number {
  const s = String(step);
  const e = s.indexOf("e-");
  if (e >= 0) return Number(s.slice(e + 2));
  const dot = s.indexOf(".");
  return dot >= 0 ? s.length - dot - 1 : 0;
}

/** Snap a raw number to the input's grid and clamp it to [min, max]. */
function snap(input: SimulatorInput, raw: number): number {
  if (!Number.isFinite(raw)) return input.default;
  const steps = Math.round((raw - input.min) / input.step);
  const v = input.min + steps * input.step;
  const clamped = Math.min(input.max, Math.max(input.min, v));
  return Number(clamped.toFixed(decimalsOf(input.step)));
}

function pctOf(input: SimulatorInput, value: number): number {
  const p = ((value - input.min) / (input.max - input.min)) * 100;
  return Math.min(100, Math.max(0, p));
}

/** Format a value, respecting the module's currency and the provider locale. */
function useFormatter(currency: string) {
  const { locale } = useNibblearn();
  return useCallback(
    (value: number, format: Format) => formatValue(value, format, { currency, locale }),
    [currency, locale],
  );
}

/* ----------------------------------------------------------------------------
 * Animated number (rAF count-up, ≤ 300ms, skipped for reduced motion)
 * -------------------------------------------------------------------------- */

function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const canAnimate = !reduced && typeof requestAnimationFrame === "function";
  const [shown, setShown] = useState(value);
  // Last painted value; only touched inside effects / rAF callbacks.
  const paintedRef = useRef(value);

  // Without animation the displayed value simply tracks the target.
  if (!canAnimate && shown !== value) setShown(value);

  useEffect(() => {
    if (!canAnimate) {
      paintedRef.current = value;
      return;
    }
    const from = paintedRef.current;
    const to = value;
    if (from === to) return;
    let frame: number;
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      frame = requestAnimationFrame(() => {
        paintedRef.current = to;
        setShown(to);
      });
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = p >= 1 ? to : from + (to - from) * eased;
      paintedRef.current = current;
      setShown(current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, canAnimate]);

  return (
    <span className={className}>
      <span aria-hidden className="nb-sim__num">
        {format(shown)}
      </span>
      <span className="nb-sr-only">{format(value)}</span>
    </span>
  );
}

/* ----------------------------------------------------------------------------
 * Slider
 * -------------------------------------------------------------------------- */

interface SliderProps {
  moduleId: string;
  input: SimulatorInput;
  value: number;
  format: (v: number, f: Format) => string;
  onChange: (id: string, value: number) => void;
}

function SimSlider({ moduleId, input, value, format, onChange }: SliderProps) {
  const { t } = useNibblearn();
  const id = `${moduleId}-in-${input.id}`;
  const helpId = input.help ? `${id}-help` : undefined;
  const pct = pctOf(input, value);
  const formatted = format(value, input.format);
  const atMin = value <= input.min;
  const atMax = value >= input.max;

  return (
    <div className="nb-sim__field" data-input={input.id}>
      <div className="nb-sim__field-head">
        <label htmlFor={id} className="nb-sim__label">
          {input.label}
        </label>
        <output htmlFor={id} className="nb-sim__pill" aria-live="off">
          {formatted}
        </output>
      </div>
      <div className="nb-sim__control">
        <Button
          icon
          size="sm"
          variant="secondary"
          className="nb-sim__step"
          aria-label={t("sim.decrease", { label: input.label })}
          disabled={atMin}
          onClick={() => onChange(input.id, snap(input, value - input.step))}
        >
          <Minus aria-hidden />
        </Button>
        <input
          id={id}
          type="range"
          className="nb-sim__range"
          min={input.min}
          max={input.max}
          step={input.step}
          value={value}
          aria-valuetext={formatted}
          aria-describedby={helpId}
          style={{ "--_pct": `${pct}%` } as CSSProperties}
          onChange={(e) => onChange(input.id, snap(input, Number(e.target.value)))}
        />
        <Button
          icon
          size="sm"
          variant="secondary"
          className="nb-sim__step"
          aria-label={t("sim.increase", { label: input.label })}
          disabled={atMax}
          onClick={() => onChange(input.id, snap(input, value + input.step))}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      <div className="nb-sim__range-meta" aria-hidden>
        <span>{format(input.min, input.format)}</span>
        <span>{format(input.max, input.format)}</span>
      </div>
      {input.help && (
        <p id={helpId} className="nb-sim__help">
          <RichText text={input.help} />
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Bars chart (pure CSS, with a screen-reader table alternative)
 * -------------------------------------------------------------------------- */

function BarsChart({
  outputs,
  scope,
  peaks,
  format,
}: {
  outputs: SimulatorOutput[];
  scope: SimulatorScope;
  peaks: Record<string, number>;
  format: (v: number, f: Format) => string;
}) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  return (
    <div className="nb-sim__chart">
      <ul className="nb-sim__bars" aria-hidden>
        {outputs.map((o) => {
          const v = scope[o.id] ?? NaN;
          const peak = peaks[o.id] ?? 0;
          const w = Number.isFinite(v) && peak > 0 ? Math.min(100, (Math.abs(v) / peak) * 100) : 0;
          return (
            <li key={o.id} className="nb-sim__bar-row" data-output={o.id}>
              <span className="nb-sim__bar-label">{o.label}</span>
              <span className="nb-sim__bar-track">
                <motion.span
                  className="nb-sim__bar-fill"
                  initial={false}
                  animate={{ width: `${w}%` }}
                  transition={{ duration: reduced ? 0 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </span>
              <span className="nb-sim__bar-value">{format(v, o.format)}</span>
            </li>
          );
        })}
      </ul>
      <div className="nb-sr-only">
        <table>
          <caption>{t("sim.outputs")}</caption>
          <tbody>
            {outputs.map((o) => (
              <tr key={o.id}>
                <th scope="row">{o.label}</th>
                <td>{format(scope[o.id] ?? NaN, o.format)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Module
 * -------------------------------------------------------------------------- */

function WhatIfSimulatorInner({
  config,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: WhatIfSimulatorProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "what-if-simulator",
    onComplete,
    onEvent,
    resetKey,
  });
  const { message, announce } = useAnnounce();
  const { content, behavior } = config;
  const format = useFormatter(content.currency);

  interface RunState {
    runId: number;
    inputs: SimulatorScope;
    /** Largest absolute value seen per output this run; drives relative bar lengths. */
    peaks: Record<string, number>;
  }
  const freshState = useCallback(
    (runId: number): RunState => ({ runId, inputs: defaultInputs(config), peaks: {} }),
    [config],
  );
  const [state, setState] = useState<RunState>(() => freshState(life.runId));

  // Reset local state on lifecycle reset (adjusted during render so children never see stale inputs).
  if (state.runId !== life.runId) setState(freshState(life.runId));

  const { inputs } = state;
  const scope = useMemo(() => computeOutputs(config, inputs), [config, inputs]);
  const insights = useMemo(() => activeInsights(config, scope), [config, scope]);
  const met = useMemo(() => challengeMet(config, scope), [config, scope]);

  // Track session peaks (monotonic) for the bar chart.
  const peaks = useMemo(() => {
    let changed = false;
    const next = { ...state.peaks };
    for (const o of content.outputs) {
      const v = scope[o.id];
      if (v === undefined || !Number.isFinite(v)) continue;
      const abs = Math.abs(v);
      if (abs > (next[o.id] ?? 0)) {
        next[o.id] = abs;
        changed = true;
      }
    }
    return changed ? next : state.peaks;
  }, [content.outputs, scope, state.peaks]);
  if (peaks !== state.peaks) setState((s) => (s.runId === state.runId ? { ...s, peaks } : s));

  const interactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestInputs = useRef(inputs);
  useEffect(() => {
    latestInputs.current = inputs;
  }, [inputs]);
  // Clear pending timers on reset / unmount.
  useEffect(
    () => () => {
      if (interactTimer.current) clearTimeout(interactTimer.current);
      if (completeTimer.current) clearTimeout(completeTimer.current);
      interactTimer.current = null;
      completeTimer.current = null;
    },
    [life.runId],
  );

  const primary = useMemo(() => content.outputs.filter((o) => o.primary), [content.outputs]);
  const secondary = useMemo(() => content.outputs.filter((o) => !o.primary), [content.outputs]);
  const hasChallenge = Boolean(content.challenge);

  const scheduleInteract = useCallback(
    (extra?: Record<string, unknown>) => {
      if (interactTimer.current) clearTimeout(interactTimer.current);
      interactTimer.current = setTimeout(() => {
        interactTimer.current = null;
        life.emit("module:interact", { inputs: { ...latestInputs.current }, ...extra });
      }, INTERACT_DEBOUNCE_MS);
    },
    [life],
  );

  const change = useCallback(
    (id: string, value: number) => {
      if (inputs[id] === value) return;
      const next = { ...inputs, [id]: value };
      latestInputs.current = next;
      setState((s) => ({ ...s, inputs: next }));
      scheduleInteract();
      if (life.completed) return;
      if (hasChallenge) {
        // Complete the moment the goal is met.
        if (challengeMet(config, computeOutputs(config, next))) {
          life.attempt();
          life.complete({ score: 1, details: { inputs: { ...next } } });
          announce(`${t("sim.challengeMet")} ${t("a11y.moduleComplete")}`);
        }
      } else if (behavior.completeOnInteract && !completeTimer.current) {
        // No challenge: complete (without a score) shortly after the first interaction.
        completeTimer.current = setTimeout(() => {
          completeTimer.current = null;
          if (life.complete({ details: { inputs: { ...latestInputs.current } } }))
            announce(t("a11y.moduleComplete"));
        }, COMPLETE_DEBOUNCE_MS);
      }
    },
    [
      inputs,
      scheduleInteract,
      life,
      hasChallenge,
      config,
      behavior.completeOnInteract,
      announce,
      t,
    ],
  );

  const resetDefaults = useCallback(() => {
    const next = defaultInputs(config);
    latestInputs.current = next;
    setState((s) => ({ ...s, inputs: next }));
    scheduleInteract({ reset: true });
  }, [config, scheduleInteract]);

  const retry = useCallback(() => {
    life.reset();
    life.emit("module:reset");
  }, [life]);

  const atDefaults = useMemo(
    () => content.inputs.every((i) => inputs[i.id] === i.default),
    [content.inputs, inputs],
  );
  const showBanner = !hasChallenge && life.completed;

  return (
    <ModuleShell
      type="what-if-simulator"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      announcement={message}
      width="wide"
      footer={<p className="nb-sim__note nb-muted nb-text-xs">{t("sim.illustrative")}</p>}
    >
      <AnimatedFeedback
        show={showBanner}
        tone="correct"
        title={t("common.niceWork")}
        className="nb-sim__banner"
      />

      <div className="nb-sim__layout">
        {/* ---------------- Inputs ---------------- */}
        <section
          className="nb-sim__panel nb-sim__panel--inputs"
          aria-labelledby={`${config.id}-inputs`}
        >
          <div className="nb-sim__panel-head">
            <h3 id={`${config.id}-inputs`} className="nb-sim__panel-title">
              {t("sim.inputs")}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetDefaults}
              disabled={atDefaults}
              leading={<RotateCcw aria-hidden />}
            >
              {t("sim.resetDefaults")}
            </Button>
          </div>
          <div className="nb-sim__fields">
            {content.inputs.map((inp) => (
              <SimSlider
                key={inp.id}
                moduleId={config.id}
                input={inp}
                value={inputs[inp.id] ?? inp.default}
                format={format}
                onChange={change}
              />
            ))}
          </div>
        </section>

        {/* ---------------- Results ---------------- */}
        <section
          className="nb-sim__panel nb-sim__panel--results"
          aria-labelledby={`${config.id}-outputs`}
        >
          <h3 id={`${config.id}-outputs`} className="nb-sim__panel-title">
            {t("sim.outputs")}
          </h3>

          {primary.length > 0 && (
            <div className={clsx("nb-sim__heroes", primary.length > 1 && "nb-sim__heroes--multi")}>
              {primary.map((o) => (
                <div key={o.id} className="nb-sim__hero" data-output={o.id}>
                  <div className="nb-sim__hero-label">{o.label}</div>
                  <AnimatedNumber
                    className="nb-sim__hero-value"
                    value={scope[o.id] ?? NaN}
                    format={(v) => format(v, o.format)}
                  />
                  {o.help && (
                    <p className="nb-sim__hero-help">
                      <RichText text={o.help} />
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {secondary.length > 0 && (
            <dl className="nb-sim__tiles">
              {secondary.map((o) => (
                <div key={o.id} className="nb-sim__tile" data-output={o.id}>
                  <dt className="nb-sim__tile-label">{o.label}</dt>
                  <dd className="nb-sim__tile-value">
                    <AnimatedNumber
                      value={scope[o.id] ?? NaN}
                      format={(v) => format(v, o.format)}
                    />
                  </dd>
                  {o.help && (
                    <dd className="nb-sim__tile-help">
                      <RichText text={o.help} />
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          )}

          {behavior.chart === "bars" && (
            <BarsChart outputs={content.outputs} scope={scope} peaks={peaks} format={format} />
          )}

          {content.insights.length > 0 && (
            <div className="nb-sim__insights" aria-label={t("sim.insights")} role="region">
              <AnimatePresence initial={false}>
                {insights.map((ins) => (
                  <motion.div
                    key={ins.id}
                    layout={!reduced}
                    initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: reduced ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    <Feedback
                      tone={INSIGHT_TONE[ins.tone]}
                      text={ins.text}
                      live={false}
                      className="nb-sim__insight"
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {content.challenge && (
            <motion.div
              className={clsx("nb-sim__challenge", met && "nb-sim__challenge--met")}
              data-met={met ? "true" : "false"}
              animate={met && !reduced ? { scale: [1, 1.02, 1] } : { scale: 1 }}
              transition={{ duration: reduced ? 0 : 0.36, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <div className="nb-sim__challenge-eyebrow">{t("sim.challenge")}</div>
              <p className="nb-sim__challenge-text">
                <RichText text={content.challenge.description} />
              </p>
              <div className="nb-sim__challenge-status" role="status">
                {met ? <CircleCheck aria-hidden strokeWidth={2.5} /> : <Target aria-hidden />}
                <span>{met ? t("sim.challengeMet") : t("sim.challengeOpen")}</span>
              </div>
              {life.completed && (
                <CompletionCard
                  className="nb-sim__complete"
                  title={t("sim.challengeMet")}
                  text={content.challenge.successMessage}
                  onRetry={retry}
                />
              )}
            </motion.div>
          )}
        </section>
      </div>
    </ModuleShell>
  );
}

export default WhatIfSimulator;
