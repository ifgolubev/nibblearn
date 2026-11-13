import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import { motion } from "motion/react";
import { CircleCheck, Lock, LockOpen, Minus, Plus, RotateCcw, Target } from "lucide-react";
import clsx from "clsx";
import {
  allocationBounds,
  allocationGoalMet,
  allocationGoalProgress,
  allocationScore,
  budgetAllocatorSchema,
  channelOutput,
  evaluateAllocation,
  formatValue,
  initialShares,
  optimalAllocation,
  rebalance,
  type AllocationBounds,
  type AllocationShares,
  type BudgetAllocatorConfig,
  type BudgetChannel,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { Badge } from "../../primitives/Badge";
import { ProgressBar } from "../../primitives/ProgressBar";
import { Explanation } from "../../primitives/Explanation";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./budget-allocator.css";

export type BudgetAllocatorProps = ModuleProps<BudgetAllocatorConfig>;

const INTERACT_DEBOUNCE_MS = 250;
const COUNT_UP_MS = 280;
/** Colour tokens a channel may reference by name; anything else is used as a CSS colour. */
const TONES = ["accent", "info", "success", "warning", "pink", "violet", "lime", "sky", "danger"];
/** Default colour per channel position. */
const PALETTE = ["accent", "violet", "pink", "warning", "success", "sky", "info", "lime"];

export function BudgetAllocator({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: BudgetAllocatorProps) {
  const parsed = useMemo(() => budgetAllocatorSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="budget-allocator"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <BudgetAllocatorInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/** Owns the lifecycle; every reset remounts BudgetAllocatorRun with fresh state (keyed by runId). */
function BudgetAllocatorInner(props: BudgetAllocatorProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "budget-allocator",
    onComplete,
    onEvent,
    resetKey,
  });
  return <BudgetAllocatorRun key={life.runId} {...props} life={life} />;
}

/* ----------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

interface Formatters {
  money: (v: number) => string;
  kpi: (v: number) => string;
  pct: (share: number) => string;
}

function useFormatters(currency: string): Formatters {
  const { locale } = useNibblearn();
  return useMemo(
    () => ({
      money: (v: number) => formatValue(v, "currency", { currency, locale }),
      kpi: (v: number) => formatValue(v, "integer", { locale }),
      pct: (share: number) => formatValue(share / 100, "percent", { locale }),
    }),
    [currency, locale],
  );
}

/** Data attribute for a named colour token, or a CSS custom property for a custom colour. */
function toneProps(channel: BudgetChannel, index: number): HTMLAttributes<HTMLElement> {
  const color = channel.color ?? PALETTE[index % PALETTE.length]!;
  if (TONES.includes(color)) return { "data-tone": color } as HTMLAttributes<HTMLElement>;
  return { style: { "--nb-budget-c": color } as CSSProperties };
}

function sameShares(a: AllocationShares, b: AllocationShares): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

function finiteOrNull(v: number): number | null {
  return Number.isFinite(v) ? Number(v.toFixed(2)) : null;
}

/* ----------------------------------------------------------------------------
 * Animated number (rAF count-up, ≤ 300ms, skipped for reduced motion)
 * -------------------------------------------------------------------------- */

function AnimatedNumber({ value, format }: { value: number; format: (v: number) => string }) {
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
    <>
      <span aria-hidden className="nb-budget__num">
        {format(shown)}
      </span>
      <span className="nb-sr-only">{format(value)}</span>
    </>
  );
}

/* ----------------------------------------------------------------------------
 * Stacked allocation bar
 * -------------------------------------------------------------------------- */

function AllocationBar({
  channels,
  shares,
  fmt,
  className,
}: {
  channels: BudgetChannel[];
  shares: AllocationShares;
  fmt: Formatters;
  className?: string;
}) {
  return (
    <div className={clsx("nb-budget__bar", className)} aria-hidden>
      {channels.map((c, i) => {
        const share = shares[c.id] ?? 0;
        const tone = toneProps(c, i);
        return (
          <span
            key={c.id}
            {...tone}
            className="nb-budget__seg"
            data-empty={share <= 0 ? "true" : undefined}
            style={{ ...tone.style, flexGrow: share }}
          >
            <span className="nb-budget__seg-label">{fmt.pct(share)}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Response-curve sparkline
 * -------------------------------------------------------------------------- */

const SPARK_W = 96;
const SPARK_H = 32;
const SPARK_PAD = 4;

function Sparkline({
  channel,
  share,
  totalBudget,
}: {
  channel: BudgetChannel;
  share: number;
  totalBudget: number;
}) {
  const peak = channelOutput(totalBudget, channel) || 1;
  const pt = useCallback(
    (fraction: number) => {
      const y = channelOutput(totalBudget * fraction, channel) / peak;
      return [
        SPARK_PAD + fraction * (SPARK_W - 2 * SPARK_PAD),
        SPARK_H - SPARK_PAD - y * (SPARK_H - 2 * SPARK_PAD),
      ] as const;
    },
    [channel, totalBudget, peak],
  );
  const curve = useMemo(
    () =>
      Array.from({ length: 33 }, (_, i) => pt(i / 32))
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(" "),
    [pt],
  );
  const fraction = Math.min(1, Math.max(0, share / 100));
  const area = useMemo(() => {
    const n = Math.max(2, Math.round(fraction * 32));
    const pts = Array.from({ length: n + 1 }, (_, i) => pt((fraction * i) / n));
    const base = SPARK_H - SPARK_PAD;
    return [
      `${SPARK_PAD},${base}`,
      ...pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`),
      `${pts[pts.length - 1]![0].toFixed(2)},${base}`,
    ].join(" ");
  }, [fraction, pt]);
  const [cx, cy] = pt(fraction);
  return (
    <svg
      className="nb-budget__spark"
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      width={SPARK_W}
      height={SPARK_H}
      aria-hidden
      focusable="false"
    >
      <line
        className="nb-budget__spark-base"
        x1={SPARK_PAD}
        x2={SPARK_W - SPARK_PAD}
        y1={SPARK_H - SPARK_PAD}
        y2={SPARK_H - SPARK_PAD}
      />
      {fraction > 0 && <polygon className="nb-budget__spark-area" points={area} />}
      <polyline className="nb-budget__spark-line" points={curve} />
      <circle className="nb-budget__spark-dot" cx={cx} cy={cy} r={3.5} />
    </svg>
  );
}

/* ----------------------------------------------------------------------------
 * Channel row
 * -------------------------------------------------------------------------- */

interface ChannelRowProps {
  moduleId: string;
  channel: BudgetChannel;
  index: number;
  share: number;
  spend: number;
  output: number;
  step: number;
  totalBudget: number;
  kpiLabel: string;
  locked: boolean;
  allowLock: boolean;
  canLock: boolean;
  canDecrease: boolean;
  canIncrease: boolean;
  readOnly: boolean;
  fmt: Formatters;
  onChange: (id: string, value: number) => void;
  onToggleLock: (id: string) => void;
}

function ChannelRow({
  moduleId,
  channel,
  index,
  share,
  spend,
  output,
  step,
  totalBudget,
  kpiLabel,
  locked,
  allowLock,
  canLock,
  canDecrease,
  canIncrease,
  readOnly,
  fmt,
  onChange,
  onToggleLock,
}: ChannelRowProps) {
  const { t } = useNibblearn();
  const id = `${moduleId}-ch-${channel.id}`;
  const descId = channel.description ? `${id}-desc` : undefined;
  const valueText = t("budget.valueText", { percent: fmt.pct(share), amount: fmt.money(spend) });
  const nextSpend = (totalBudget * Math.min(100, share + step)) / 100;
  const marginal = channelOutput(nextSpend, channel) - output;
  const bounds = [
    channel.min !== undefined && channel.min > 0
      ? t("budget.min", { value: fmt.pct(channel.min) })
      : "",
    channel.max !== undefined && channel.max < 100
      ? t("budget.max", { value: fmt.pct(channel.max) })
      : "",
  ].filter(Boolean);
  const tone = toneProps(channel, index);
  const fixed = readOnly || locked;

  return (
    <li
      {...tone}
      className={clsx(
        "nb-budget__row",
        locked && "nb-budget__row--locked",
        !allowLock && "nb-budget__row--nolock",
      )}
      data-channel={channel.id}
    >
      <div className="nb-budget__info">
        <span className="nb-budget__swatch" aria-hidden />
        <label htmlFor={id} className="nb-budget__label">
          {channel.label}
        </label>
      </div>
      {(channel.description || bounds.length > 0) && (
        <div className="nb-budget__about">
          {channel.description && (
            <p id={descId} className="nb-budget__desc">
              {channel.description}
            </p>
          )}
          {bounds.length > 0 && <p className="nb-budget__bounds">{bounds.join(" · ")}</p>}
        </div>
      )}

      <div className="nb-budget__value" aria-hidden>
        <span className="nb-budget__share">{fmt.pct(share)}</span>
        <span className="nb-budget__spend">{fmt.money(spend)}</span>
      </div>

      {allowLock && (
        <Button
          icon
          variant={locked ? "soft" : "ghost"}
          className="nb-budget__lock"
          aria-label={t("budget.lock", { label: channel.label })}
          aria-pressed={locked}
          title={locked ? t("budget.locked") : undefined}
          disabled={readOnly || (!locked && !canLock)}
          onClick={() => onToggleLock(channel.id)}
        >
          {locked ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
        </Button>
      )}

      <div className="nb-budget__control">
        <Button
          icon
          variant="secondary"
          className="nb-budget__step"
          aria-label={t("budget.decrease", { label: channel.label })}
          disabled={fixed || !canDecrease}
          onClick={() => onChange(channel.id, share - step)}
        >
          <Minus aria-hidden />
        </Button>
        <input
          id={id}
          type="range"
          className="nb-budget__range"
          min={0}
          max={100}
          step={step}
          value={share}
          aria-valuetext={valueText}
          aria-describedby={descId}
          disabled={fixed}
          style={{ "--_pct": `${share}%` } as CSSProperties}
          onChange={(e) => onChange(channel.id, Number(e.target.value))}
        />
        <Button
          icon
          variant="secondary"
          className="nb-budget__step"
          aria-label={t("budget.increase", { label: channel.label })}
          disabled={fixed || !canIncrease}
          onClick={() => onChange(channel.id, share + step)}
        >
          <Plus aria-hidden />
        </Button>
      </div>

      <div className="nb-budget__curve">
        <Sparkline channel={channel} share={share} totalBudget={totalBudget} />
        <div className="nb-budget__curve-text">
          <p className="nb-budget__output">
            <strong>{fmt.kpi(output)}</strong> <span>{kpiLabel}</span>
          </p>
          {share < 100 && (
            <p className="nb-budget__marginal">
              {t("budget.marginal", { step: fmt.pct(step), value: fmt.kpi(marginal) })}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/* ----------------------------------------------------------------------------
 * Module
 * -------------------------------------------------------------------------- */

function BudgetAllocatorRun({
  life,
  config,
  hideHeader,
  className,
}: BudgetAllocatorProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { content, behavior } = config;
  const { channels, goal, totalBudget, kpiLabel } = content;
  const { step, allowLock, showOptimal, scoreAgainstOptimal } = behavior;
  const fmt = useFormatters(content.currency);

  const start = useMemo(() => initialShares(config), [config]);
  const bounds = useMemo<AllocationBounds>(
    () => allocationBounds(channels, step),
    [channels, step],
  );
  const [shares, setShares] = useState<AllocationShares>(start);
  const [locked, setLocked] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const evaluation = useMemo(() => evaluateAllocation(config, shares), [config, shares]);
  const optimal = useMemo(() => optimalAllocation(config), [config]);
  const optimalEval = useMemo(() => evaluateAllocation(config, optimal), [config, optimal]);
  const goalMet = useMemo(() => allocationGoalMet(config, evaluation), [config, evaluation]);
  const score = scoreAgainstOptimal
    ? allocationScore(evaluation.totalKpi, optimalEval.totalKpi)
    : goal
      ? allocationGoalProgress(config, evaluation)
      : undefined;

  const interactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  useEffect(
    () => () => {
      if (interactTimer.current) clearTimeout(interactTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (submitted) resultsRef.current?.focus();
  }, [submitted]);

  const scheduleInteract = useCallback(
    (payload: Record<string, unknown>) => {
      if (interactTimer.current) clearTimeout(interactTimer.current);
      interactTimer.current = setTimeout(() => {
        interactTimer.current = null;
        life.emit("module:interact", payload);
      }, INTERACT_DEBOUNCE_MS);
    },
    [life],
  );

  const apply = useCallback(
    (next: AllocationShares, extra?: Record<string, unknown>) => {
      if (sameShares(next, shares)) return;
      setShares(next);
      scheduleInteract({ shares: { ...next }, locked: [...locked], ...extra });
      if (goal) {
        const nowMet = allocationGoalMet(config, evaluateAllocation(config, next));
        if (nowMet !== goalMet) announce(nowMet ? t("budget.goalMet") : t("budget.goalOpen"));
      }
    },
    [shares, scheduleInteract, locked, goal, config, goalMet, announce, t],
  );

  const change = useCallback(
    (id: string, value: number) => {
      if (submitted) return;
      apply(rebalance(shares, id, value, locked, step, bounds));
    },
    [submitted, apply, shares, locked, step, bounds],
  );

  const unlockedCount = channels.length - locked.length;
  const toggleLock = useCallback(
    (id: string) => {
      if (submitted) return;
      const next = locked.includes(id) ? locked.filter((x) => x !== id) : [...locked, id];
      setLocked(next);
      scheduleInteract({ shares: { ...shares }, locked: next });
    },
    [submitted, locked, scheduleInteract, shares],
  );

  const resetSplit = useCallback(() => {
    setLocked([]);
    apply(start, { reset: true });
  }, [apply, start]);

  const lockIn = useCallback(() => {
    if (submitted) return;
    if (interactTimer.current) {
      clearTimeout(interactTimer.current);
      interactTimer.current = null;
    }
    life.attempt();
    setSubmitted(true);
    const details = {
      shares: { ...shares },
      kpi: finiteOrNull(evaluation.totalKpi),
      costPerKpi: finiteOrNull(evaluation.costPerKpi),
      optimalShares: { ...optimal },
      optimalKpi: finiteOrNull(optimalEval.totalKpi),
      goalMet: goal ? goalMet : null,
    };
    life.emit("module:answer", details);
    life.complete({ score, details });
    const pct = Math.round(allocationScore(evaluation.totalKpi, optimalEval.totalKpi) * 100);
    announce(
      [
        showOptimal ? t("budget.ofOptimal", { percent: pct }) : "",
        goal && goalMet ? t("budget.goalMet") : "",
        t("a11y.moduleComplete"),
      ]
        .filter(Boolean)
        .join(" "),
    );
  }, [
    submitted,
    life,
    shares,
    evaluation,
    optimal,
    optimalEval,
    goal,
    goalMet,
    score,
    announce,
    showOptimal,
    t,
  ]);

  const retry = useCallback(() => {
    life.reset();
    life.emit("module:reset");
  }, [life]);

  const atStart = sameShares(shares, start) && locked.length === 0;
  const canMove = (id: string, dir: 1 | -1) =>
    rebalance(shares, id, (shares[id] ?? 0) + dir * step, locked, step, bounds)[id] !== shares[id];

  const pctOfOptimal = Math.round(allocationScore(evaluation.totalKpi, optimalEval.totalKpi) * 100);
  const gap = Math.max(0, optimalEval.totalKpi - evaluation.totalKpi);
  const matched = Math.round(gap) === 0;

  return (
    <ModuleShell
      type="budget-allocator"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      announcement={message}
      width="wide"
      footer={<p className="nb-budget__note nb-muted nb-text-xs">{t("sim.illustrative")}</p>}
    >
      <div className="nb-budget" data-submitted={submitted ? "true" : "false"}>
        {/* ---------------- Headline stats ---------------- */}
        <dl className="nb-budget__stats">
          <div className="nb-budget__stat nb-budget__stat--budget">
            <dt>{t("budget.totalBudget")}</dt>
            <dd>{fmt.money(totalBudget)}</dd>
          </div>
          <div className="nb-budget__stat nb-budget__stat--kpi">
            <dt>{kpiLabel}</dt>
            <dd>
              <AnimatedNumber value={evaluation.totalKpi} format={fmt.kpi} />
            </dd>
          </div>
          <div className="nb-budget__stat nb-budget__stat--cost">
            <dt>{t("budget.costPerResult")}</dt>
            <dd>
              <AnimatedNumber value={evaluation.costPerKpi} format={fmt.money} />
            </dd>
          </div>
        </dl>

        {/* ---------------- Goal ---------------- */}
        {goal && (
          <motion.div
            className={clsx("nb-budget__goal", goalMet && "nb-budget__goal--met")}
            data-met={goalMet ? "true" : "false"}
            animate={goalMet && !reduced ? { scale: [1, 1.015, 1] } : { scale: 1 }}
            transition={{ duration: reduced ? 0 : 0.36, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div className="nb-budget__goal-head">
              <span className="nb-budget__eyebrow">{t("budget.goal")}</span>
              <span className="nb-budget__goal-status">
                {goalMet ? <CircleCheck aria-hidden strokeWidth={2.5} /> : <Target aria-hidden />}
                {goalMet ? t("budget.goalMet") : t("budget.goalOpen")}
              </span>
            </div>
            <p className="nb-budget__goal-text">
              <RichText text={goal.description} />
            </p>
            {goal.minKpi !== undefined && (
              <div className="nb-budget__goal-meter">
                <ProgressBar
                  value={evaluation.totalKpi / goal.minKpi}
                  label={kpiLabel}
                  showLabel={false}
                  size="sm"
                  tone={goalMet ? "success" : "accent"}
                />
                <span className="nb-budget__goal-count">
                  {t("budget.goalProgress", {
                    value: fmt.kpi(evaluation.totalKpi),
                    target: fmt.kpi(goal.minKpi),
                  })}
                </span>
              </div>
            )}
            {goal.maxCostPerKpi !== undefined && (
              <p className="nb-budget__goal-count">
                {t("budget.costPerResult")}: {fmt.money(evaluation.costPerKpi)} ≤{" "}
                {fmt.money(goal.maxCostPerKpi)}
              </p>
            )}
          </motion.div>
        )}

        {/* ---------------- Allocation bar ---------------- */}
        <section className="nb-budget__section" aria-labelledby={`${config.id}-alloc`}>
          <h3 id={`${config.id}-alloc`} className="nb-budget__heading">
            {t("budget.allocation")}
          </h3>
          <AllocationBar channels={channels} shares={shares} fmt={fmt} />
          <div className="nb-sr-only">
            <table>
              <caption>{t("budget.allocation")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("budget.channel")}</th>
                  <th scope="col">{t("budget.share")}</th>
                  <th scope="col">{t("budget.spend")}</th>
                  <th scope="col">{kpiLabel}</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.channels.map((r, i) => (
                  <tr key={r.id}>
                    <th scope="row">{channels[i]!.label}</th>
                    <td>{fmt.pct(r.share)}</td>
                    <td>{fmt.money(r.spend)}</td>
                    <td>{fmt.kpi(r.output)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------------- Channels ---------------- */}
        <section className="nb-budget__section" aria-labelledby={`${config.id}-channels`}>
          <div className="nb-budget__section-head">
            <h3 id={`${config.id}-channels`} className="nb-budget__heading">
              {t("budget.channels")}
            </h3>
            {allowLock && !submitted && <p className="nb-budget__hint">{t("budget.lockHint")}</p>}
          </div>
          <ul className="nb-budget__rows">
            {channels.map((c, i) => {
              const r = evaluation.channels[i]!;
              const isLocked = locked.includes(c.id);
              return (
                <ChannelRow
                  key={c.id}
                  moduleId={config.id}
                  channel={c}
                  index={i}
                  share={r.share}
                  spend={r.spend}
                  output={r.output}
                  step={step}
                  totalBudget={totalBudget}
                  kpiLabel={kpiLabel}
                  locked={isLocked}
                  allowLock={allowLock}
                  canLock={unlockedCount > 2}
                  canDecrease={!submitted && !isLocked && canMove(c.id, -1)}
                  canIncrease={!submitted && !isLocked && canMove(c.id, 1)}
                  readOnly={submitted}
                  fmt={fmt}
                  onChange={change}
                  onToggleLock={toggleLock}
                />
              );
            })}
          </ul>
        </section>

        {!submitted && (
          <div className="nb-budget__actions">
            <Button
              variant="ghost"
              onClick={resetSplit}
              disabled={atStart}
              leading={<RotateCcw aria-hidden />}
            >
              {t("budget.resetInitial")}
            </Button>
            <Button variant="primary" onClick={lockIn}>
              {t("budget.lockIn")}
            </Button>
          </div>
        )}

        {/* ---------------- Reveal ---------------- */}
        {submitted && (
          <motion.section
            className="nb-budget__results"
            aria-labelledby={`${config.id}-results`}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h3
              id={`${config.id}-results`}
              ref={resultsRef}
              tabIndex={-1}
              className="nb-budget__heading"
            >
              {t("budget.results")}
            </h3>
            <div className="nb-budget__compare">
              {[
                {
                  key: "learner",
                  label: t("budget.yourPlan"),
                  s: shares,
                  kpi: evaluation.totalKpi,
                },
                ...(showOptimal
                  ? [
                      {
                        key: "optimal",
                        label: t("budget.optimalPlan"),
                        s: optimal,
                        kpi: optimalEval.totalKpi,
                      },
                    ]
                  : []),
              ].map((plan, i) => (
                <div key={plan.key} className="nb-budget__compare-row" data-plan={plan.key}>
                  <div className="nb-budget__compare-head">
                    <span className="nb-budget__compare-label">{plan.label}</span>
                    <span className="nb-budget__compare-kpi">
                      <strong>{fmt.kpi(plan.kpi)}</strong> {kpiLabel}
                    </span>
                  </div>
                  <motion.div
                    className="nb-budget__compare-bar"
                    initial={reduced ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{
                      duration: reduced ? 0 : 0.36,
                      delay: reduced ? 0 : 0.1 + i * 0.12,
                      ease: [0.2, 0.8, 0.2, 1],
                    }}
                  >
                    <AllocationBar channels={channels} shares={plan.s} fmt={fmt} />
                  </motion.div>
                </div>
              ))}
            </div>
            {showOptimal && (
              <div className="nb-budget__verdict">
                <Badge
                  tone={pctOfOptimal >= 98 ? "success" : pctOfOptimal >= 90 ? "accent" : "warning"}
                  className="nb-budget__verdict-badge"
                >
                  {t("budget.ofOptimal", { percent: pctOfOptimal })}
                </Badge>
                <span className="nb-budget__verdict-text">
                  {matched ? (
                    t("budget.matchedOptimal")
                  ) : (
                    <>
                      {t("budget.gap")}: <strong>−{fmt.kpi(gap)}</strong> {kpiLabel}
                    </>
                  )}
                </span>
              </div>
            )}
            {showOptimal && (
              <div className="nb-sr-only">
                <table>
                  <caption>{t("budget.comparison")}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t("budget.channel")}</th>
                      <th scope="col">{t("budget.yourPlan")}</th>
                      <th scope="col">{t("budget.optimalShare")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map((c) => (
                      <tr key={c.id}>
                        <th scope="row">{c.label}</th>
                        <td>{fmt.pct(shares[c.id] ?? 0)}</td>
                        <td>{fmt.pct(optimal[c.id] ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Explanation text={content.explanation} />
            <CompletionCard
              className="nb-budget__complete"
              score={score}
              passThreshold={config.scoring.passThreshold > 0 ? config.scoring.passThreshold : 0.9}
              title={goal && goalMet ? t("budget.goalMet") : undefined}
              text={config.feedback.complete}
              stats={[
                { label: kpiLabel, value: fmt.kpi(evaluation.totalKpi) },
                { label: t("budget.costPerResult"), value: fmt.money(evaluation.costPerKpi) },
                ...(showOptimal
                  ? [{ label: t("budget.optimalPlan"), value: fmt.kpi(optimalEval.totalKpi) }]
                  : []),
              ]}
              onRetry={retry}
            />
          </motion.section>
        )}
      </div>
    </ModuleShell>
  );
}

export default BudgetAllocator;
