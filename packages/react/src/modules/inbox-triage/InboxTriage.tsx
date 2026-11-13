import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { motion } from "motion/react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CircleCheck,
  CircleDot,
  CircleX,
  Crown,
  Flag,
  Forward,
  Globe,
  Inbox,
  Mail,
  Paperclip,
  Reply,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";
import {
  evaluateTriage,
  gradeTriageDecision,
  inboxTriageSchema,
  isPriorityMessage,
  nextUnhandledIndex,
  type InboxAction,
  type InboxFlag,
  type InboxMessage,
  type InboxTriageConfig,
  type TriageDecisions,
  type TriageStatus,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Badge } from "../../primitives/Badge";
import { Button } from "../../primitives/Button";
import { ProgressBar } from "../../primitives/ProgressBar";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./inbox-triage.css";

export type InboxTriageProps = ModuleProps<InboxTriageConfig>;

const ACTION_ICON: Record<NonNullable<InboxAction["icon"]>, ReactNode> = {
  reply: <Reply aria-hidden />,
  forward: <Forward aria-hidden />,
  calendar: <CalendarClock aria-hidden />,
  archive: <Archive aria-hidden />,
  flag: <Flag aria-hidden />,
  alert: <TriangleAlert aria-hidden />,
};

const FLAG_ICON: Record<InboxFlag, ReactNode> = {
  vip: <Crown aria-hidden />,
  external: <Globe aria-hidden />,
  attachment: <Paperclip aria-hidden />,
  "suspicious-link": <ShieldAlert aria-hidden />,
};

const STATUS_ICON: Record<TriageStatus, ReactNode> = {
  correct: <CircleCheck aria-hidden />,
  acceptable: <CircleDot aria-hidden />,
  wrong: <CircleX aria-hidden />,
  pending: <Mail aria-hidden />,
};

const AVATAR_TONES = ["accent", "sky", "violet", "pink", "highlight"] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Deterministic avatar tone per sender. */
function avatarTone(name: string): (typeof AVATAR_TONES)[number] {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

/** Action tone as used by the CSS ("lime" maps to the highlight token). */
function toneOf(action: InboxAction | undefined): string {
  if (!action?.tone) return "neutral";
  return action.tone === "lime" ? "highlight" : action.tone;
}

function actionIcon(action: InboxAction | undefined): ReactNode {
  return action?.icon ? ACTION_ICON[action.icon] : <Mail aria-hidden />;
}

function uniqueFlags(flags: readonly InboxFlag[]): InboxFlag[] {
  return [...new Set(flags)];
}

export function InboxTriage({ config: rawConfig, ...rest }: InboxTriageProps) {
  const parsed = useMemo(() => inboxTriageSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="inbox-triage"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return <InboxTriageInner config={parsed.data} {...rest} />;
}

/** Owns the lifecycle; every reset remounts InboxTriageRun with fresh state (keyed by runId). */
function InboxTriageInner(props: InboxTriageProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "inbox-triage",
    onComplete,
    onEvent,
    resetKey,
  });
  return <InboxTriageRun key={life.runId} {...props} life={life} />;
}

type FocusTarget = "subject" | "summary" | number;

function InboxTriageRun({
  life,
  config,
  hideHeader,
  className,
}: InboxTriageProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message: announcement, announce } = useAnnounce();
  const { owner, actions, messages } = config.content;
  const { behavior } = config;
  const instant = behavior.feedback === "instant";

  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "message">("list");
  const [read, setRead] = useState<Record<string, true>>({});
  const [focusIndex, setFocusIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const subjectRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusRequest = useRef<FocusTarget | null>(null);

  const actionById = useMemo(() => new Map(actions.map((a) => [a.id, a])), [actions]);
  const handled = Object.keys(decisions).length;
  const total = messages.length;
  const allHandled = handled >= total;
  const active = activeIndex === null ? null : messages[activeIndex]!;

  const requestFocus = useCallback((target: FocusTarget) => {
    focusRequest.current = target;
    setFocusTick((n) => n + 1);
  }, []);

  // Move focus after the view has re-rendered (refs are attached before effects run).
  useEffect(() => {
    const target = focusRequest.current;
    if (target === null) return;
    focusRequest.current = null;
    if (target === "subject") subjectRef.current?.focus();
    else if (target === "summary") summaryRef.current?.focus();
    else itemRefs.current[target]?.focus();
  }, [focusTick]);

  const open = useCallback(
    (index: number) => {
      const m = messages[index]!;
      setActiveIndex(index);
      setFocusIndex(index);
      setView("message");
      setRead((prev) => (prev[m.id] ? prev : { ...prev, [m.id]: true }));
      life.emit("module:interact", { action: "open", messageId: m.id });
      requestFocus("subject");
    },
    [messages, life, requestFocus],
  );

  const backToList = useCallback(() => {
    setView("list");
    if (activeIndex !== null) requestFocus(activeIndex);
  }, [activeIndex, requestFocus]);

  const choose = useCallback(
    (action: InboxAction) => {
      if (!active || finished) return;
      const prev = decisions[active.id];
      if (prev === action.id || (instant && prev !== undefined)) return;
      life.attempt();
      setDecisions({ ...decisions, [active.id]: action.id });
      const { status, points } = gradeTriageDecision(active, action.id);
      life.emit("module:answer", {
        messageId: active.id,
        action: action.id,
        status,
        points,
        changed: prev !== undefined,
      });
      if (instant) {
        const expert = actionById.get(active.correctAction)?.label ?? active.correctAction;
        announce(
          status === "correct"
            ? `${t("inbox.status.correct")}.`
            : `${t(`inbox.status.${status}`)}. ${t("inbox.expertCall", { action: expert })}.`,
        );
      } else {
        announce(t("inbox.filedAs", { action: action.label }));
      }
    },
    [active, finished, decisions, instant, life, actionById, announce, t],
  );

  const finish = useCallback(() => {
    if (!allHandled) return;
    const ev = evaluateTriage(config, decisions);
    setFinished(true);
    life.complete({
      score: ev.score,
      correct: ev.correct,
      total: ev.total,
      details: {
        decisions,
        statuses: Object.fromEntries(ev.messages.map((m) => [m.id, m.status])),
        actionCounts: ev.actionCounts,
        missedPriority: ev.missedPriority,
      },
    });
    announce(
      `${t("inbox.summary", { correct: ev.correct, total: ev.total })} ${t("a11y.moduleComplete")}`,
    );
    requestFocus("summary");
  }, [allHandled, config, decisions, life, announce, t, requestFocus]);

  const goNext = useCallback(() => {
    const idx = nextUnhandledIndex(messages, decisions, activeIndex ?? -1);
    if (idx === -1) finish();
    else open(idx);
  }, [messages, decisions, activeIndex, finish, open]);

  const retry = useCallback(() => {
    life.reset();
    life.emit("module:reset");
  }, [life]);

  // Roving focus in the message list.
  const onListKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
      let next: number | null = null;
      if (e.key === "ArrowDown") next = Math.min(total - 1, index + 1);
      else if (e.key === "ArrowUp") next = Math.max(0, index - 1);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = total - 1;
      if (next === null) return;
      e.preventDefault();
      setFocusIndex(next);
      itemRefs.current[next]?.focus();
    },
    [total],
  );

  // Module-wide shortcuts: 1–5 pick an action, Escape returns to the list.
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (finished || !active || e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === "Escape" && view === "message") {
        e.preventDefault();
        backToList();
        return;
      }
      if (!/^[1-9]$/.test(e.key)) return;
      const action = actions[Number(e.key) - 1];
      if (!action) return;
      e.preventDefault();
      choose(action);
    },
    [finished, active, view, backToList, actions, choose],
  );

  if (finished) {
    return (
      <ModuleShell
        type="inbox-triage"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        announcement={announcement}
        width="wide"
      >
        <div ref={summaryRef} tabIndex={-1} className="nb-inbox__done">
          <TriageSummary config={config} decisions={decisions} onRetry={retry} />
        </div>
      </ModuleShell>
    );
  }

  const unread = messages.filter((m) => !read[m.id]).length;
  const handledLabel = t("inbox.handledCount", { count: handled, total });

  return (
    <ModuleShell
      type="inbox-triage"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      announcement={announcement}
      width="wide"
      onKeyDown={onKeyDown}
      aside={<span className="nb-counter">{handledLabel}</span>}
      eyebrow={
        <ProgressBar value={handled / total} showLabel={false} size="sm" label={handledLabel} />
      }
    >
      <div
        className="nb-inbox"
        data-view={view}
        data-open={active ? "true" : "false"}
        data-feedback={behavior.feedback}
      >
        <div className="nb-inbox__topbar">
          <span className="nb-inbox__brand" aria-hidden>
            <Inbox />
          </span>
          <div className="nb-inbox__owner">
            <span className="nb-inbox__folder">{t("inbox.title")}</span>
            <span className="nb-inbox__owner-name">
              {owner.name}
              {owner.role && <span className="nb-inbox__owner-role"> · {owner.role}</span>}
            </span>
          </div>
          <span className="nb-inbox__kbd-hint" aria-hidden>
            {t("inbox.keyboardHint", { count: actions.length })}
          </span>
          <span className="nb-inbox__unread" data-zero={unread === 0 ? "true" : undefined}>
            {t("inbox.unreadCount", { count: unread })}
          </span>
        </div>

        <div className="nb-inbox__panes">
          <div className="nb-inbox__list-pane">
            <ul className="nb-inbox__list" aria-label={t("inbox.messages")}>
              {messages.map((m, i) => {
                const decision = decisions[m.id];
                const action = decision ? actionById.get(decision) : undefined;
                const status = decision ? gradeTriageDecision(m, decision).status : "pending";
                const flags = uniqueFlags(m.flags);
                const isUnread = !read[m.id];
                const extras = [
                  isUnread ? t("inbox.unread") : null,
                  ...flags.map((f) => t(`inbox.flag.${f}`)),
                  action ? t("inbox.handledAs", { action: action.label }) : null,
                  action && instant ? t(`inbox.status.${status}`) : null,
                ].filter(Boolean);
                return (
                  <li key={m.id} className="nb-inbox__row">
                    <button
                      ref={(el) => {
                        itemRefs.current[i] = el;
                      }}
                      type="button"
                      className="nb-inbox__item"
                      data-unread={isUnread ? "true" : undefined}
                      data-handled={decision ? "true" : undefined}
                      aria-current={activeIndex === i ? "true" : undefined}
                      tabIndex={i === focusIndex ? 0 : -1}
                      onClick={() => open(i)}
                      onFocus={() => setFocusIndex(i)}
                      onKeyDown={(e) => onListKeyDown(e, i)}
                    >
                      <span className="nb-inbox__unread-dot" aria-hidden />
                      <motion.span
                        key={decision ?? "avatar"}
                        className="nb-inbox__avatar"
                        data-tone={action ? toneOf(action) : avatarTone(m.from.name)}
                        data-kind={action ? "action" : "person"}
                        data-initials={action ? undefined : initials(m.from.name)}
                        aria-hidden
                        initial={reduced || !action ? false : { scale: 0.8, opacity: 0.4 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: reduced ? 0 : 0.24, ease: [0.34, 1.56, 0.64, 1] }}
                      >
                        {/* Initials are drawn via CSS so they never become part of the row's text. */}
                        {action ? actionIcon(action) : null}
                      </motion.span>
                      <span className="nb-inbox__item-main">
                        <span className="nb-inbox__item-top">
                          <span className="nb-inbox__sender">{m.from.name}</span>
                          {flags.length > 0 && (
                            <span className="nb-inbox__mini-flags">
                              {flags.map((f) => (
                                <span
                                  key={f}
                                  className="nb-inbox__mini-flag"
                                  data-flag={f}
                                  title={t(`inbox.flag.${f}`)}
                                  aria-hidden
                                >
                                  {FLAG_ICON[f]}
                                </span>
                              ))}
                            </span>
                          )}
                          <span className="nb-inbox__time">{m.time}</span>
                        </span>
                        <span className="nb-inbox__subject">{m.subject}</span>
                        {action ? (
                          <span className="nb-inbox__tag" data-tone={toneOf(action)}>
                            {instant && (
                              <span className="nb-inbox__tag-status" data-status={status}>
                                {STATUS_ICON[status]}
                              </span>
                            )}
                            {action.label}
                          </span>
                        ) : (
                          <span className="nb-inbox__preview">{m.preview}</span>
                        )}
                      </span>
                      {/* Name = visible text (WCAG 2.5.3) + state that is only shown as icons. */}
                      {extras.length > 0 && (
                        <span className="nb-sr-only">. {extras.join(", ")}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="nb-inbox__reader">
            {active ? (
              <MessageView
                key={active.id}
                moduleId={config.id}
                message={active}
                ownerName={owner.name}
                actions={actions}
                decision={decisions[active.id]}
                instant={instant}
                allHandled={allHandled}
                subjectRef={subjectRef}
                onBack={backToList}
                onChoose={choose}
                onNext={goNext}
              />
            ) : (
              <div className="nb-inbox__empty">
                <span className="nb-inbox__empty-icon" aria-hidden>
                  <Inbox />
                </span>
                <p className="nb-inbox__empty-title">{t("inbox.emptyTitle", { count: total })}</p>
                <p className="nb-inbox__empty-body">{t("inbox.emptyBody")}</p>
                <ul className="nb-inbox__legend">
                  {actions.map((a) => (
                    <li key={a.id} className="nb-inbox__legend-item" data-tone={toneOf(a)}>
                      <span className="nb-inbox__action-icon" aria-hidden>
                        {actionIcon(a)}
                      </span>
                      <span>
                        <strong>{a.label}</strong>
                        {a.description && (
                          <span className="nb-inbox__legend-desc"> {a.description}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}

/* ----------------------------------------------------------------------------
 * Reading pane
 * -------------------------------------------------------------------------- */

interface MessageViewProps {
  moduleId: string;
  message: InboxMessage;
  ownerName: string;
  actions: InboxAction[];
  decision?: string;
  instant: boolean;
  allHandled: boolean;
  subjectRef: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onChoose: (action: InboxAction) => void;
  onNext: () => void;
}

function MessageView({
  moduleId,
  message: m,
  ownerName,
  actions,
  decision,
  instant,
  allHandled,
  subjectRef,
  onBack,
  onChoose,
  onNext,
}: MessageViewProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const flags = uniqueFlags(m.flags);
  const chosen = decision ? actions.find((a) => a.id === decision) : undefined;
  const expert = actions.find((a) => a.id === m.correctAction);
  const status = decision ? gradeTriageDecision(m, decision).status : "pending";
  const locked = instant && decision !== undefined;
  const subjectId = `${moduleId}-inbox-subject`;
  const dockId = `${moduleId}-inbox-dock`;

  return (
    <motion.article
      className="nb-inbox__message"
      aria-labelledby={subjectId}
      initial={reduced ? false : { opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduced ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="nb-inbox__reader-bar">
        <Button
          variant="ghost"
          size="sm"
          className="nb-inbox__back"
          leading={<ArrowLeft aria-hidden />}
          onClick={onBack}
        >
          {t("inbox.back")}
        </Button>
      </div>

      <header className="nb-inbox__msg-head">
        <h3 ref={subjectRef} id={subjectId} tabIndex={-1} className="nb-inbox__msg-subject">
          {m.subject}
        </h3>
        <div className="nb-inbox__sender-block">
          <span
            className="nb-inbox__avatar nb-inbox__avatar--lg"
            data-tone={avatarTone(m.from.name)}
            aria-hidden
          >
            {initials(m.from.name)}
          </span>
          <div className="nb-inbox__sender-meta">
            <div className="nb-inbox__sender-line">
              <span className="nb-inbox__sender-name">{m.from.name}</span>
              {m.from.email && <span className="nb-inbox__email">{m.from.email}</span>}
            </div>
            <div className="nb-inbox__sender-sub">
              {m.from.role && <span>{m.from.role}</span>}
              <span>{t("inbox.to", { name: ownerName })}</span>
            </div>
          </div>
          <span className="nb-inbox__msg-time">{m.time}</span>
        </div>
        {flags.length > 0 && (
          <ul className="nb-inbox__flags" aria-label={t("inbox.flags")}>
            {flags.map((f) => (
              <li key={f} className="nb-inbox__flag" data-flag={f}>
                {FLAG_ICON[f]}
                {t(`inbox.flag.${f}`)}
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="nb-inbox__msg-body">
        <RichText text={m.body} paragraphs />
      </div>

      <div className="nb-inbox__dock" role="group" aria-labelledby={dockId}>
        <div className="nb-inbox__dock-label" id={dockId}>
          {t("inbox.yourCall")}
        </div>
        <div className="nb-inbox__actions">
          {actions.map((a, i) => {
            const isChosen = decision === a.id;
            const descId = a.description ? `${moduleId}-inbox-action-${a.id}` : undefined;
            return (
              <button
                key={a.id}
                type="button"
                className="nb-inbox__action"
                data-tone={toneOf(a)}
                data-chosen={isChosen ? "true" : undefined}
                aria-pressed={isChosen}
                aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                aria-describedby={descId}
                title={a.description}
                disabled={locked}
                onClick={() => onChoose(a)}
              >
                <span className="nb-inbox__action-icon" aria-hidden>
                  {isChosen ? <Check /> : actionIcon(a)}
                </span>
                <span className="nb-inbox__action-label">{a.label}</span>
                {i < 9 && (
                  <kbd className="nb-inbox__key" aria-hidden>
                    {i + 1}
                  </kbd>
                )}
                {descId && (
                  <span id={descId} className="nb-sr-only">
                    {a.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {chosen && instant && (
          <motion.div
            className="nb-inbox__coach"
            data-status={status}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="nb-inbox__coach-head">
              <span className="nb-inbox__coach-icon" aria-hidden>
                {STATUS_ICON[status]}
              </span>
              <span className="nb-inbox__coach-title">{t(`inbox.status.${status}`)}</span>
              {status !== "correct" && (
                <span className="nb-inbox__coach-expert" data-tone={toneOf(expert)}>
                  {t("inbox.expertCall", { action: expert?.label ?? m.correctAction })}
                </span>
              )}
            </div>
            <RichText className="nb-inbox__coach-text" text={m.explanation} paragraphs />
          </motion.div>
        )}

        {chosen && !instant && (
          <p className="nb-inbox__filed">
            <Check aria-hidden />
            {t("inbox.filedAs", { action: chosen.label })}
          </p>
        )}

        {chosen && (
          <div className="nb-inbox__dock-foot">
            <Button
              variant="primary"
              autoFocus
              onClick={onNext}
              trailing={<ArrowRight aria-hidden />}
            >
              {allHandled ? t("inbox.seeResults") : t("inbox.nextMessage")}
            </Button>
          </div>
        )}
      </div>
    </motion.article>
  );
}

/* ----------------------------------------------------------------------------
 * Summary
 * -------------------------------------------------------------------------- */

function TriageSummary({
  config,
  decisions,
  onRetry,
}: {
  config: InboxTriageConfig;
  decisions: TriageDecisions;
  onRetry: () => void;
}) {
  const { t } = useNibblearn();
  const { actions, messages, summary } = config.content;
  const { behavior } = config;
  const ev = useMemo(() => evaluateTriage(config, decisions), [config, decisions]);
  const byId = new Map(actions.map((a) => [a.id, a]));
  const labelOf = (id?: string) => (id ? (byId.get(id)?.label ?? id) : "—");
  const priorityCount = messages.filter((m) => isPriorityMessage(m, actions)).length;
  const missed = messages.filter((m) => ev.missedPriority.includes(m.id));

  return (
    <CompletionCard
      score={behavior.showScore ? ev.score : undefined}
      passThreshold={Math.max(config.scoring.passThreshold, 0.7)}
      title={t("inbox.doneTitle")}
      text={
        config.feedback.complete ??
        summary ??
        t("inbox.summary", { correct: ev.correct, total: ev.total })
      }
      stats={[
        { label: t("inbox.expertCalls"), value: `${ev.correct}/${ev.total}` },
        { label: t("inbox.acceptableCalls"), value: ev.acceptable },
        { label: t("inbox.missedCount"), value: ev.missedPriority.length },
      ]}
      onRetry={behavior.allowRetry ? onRetry : undefined}
    >
      <div className="nb-inbox__report">
        <section className="nb-inbox__report-section">
          <h4 className="nb-inbox__section-title">{t("inbox.yourCalls")}</h4>
          <ul className="nb-inbox__chips">
            {actions.map((a) => {
              const mine = ev.actionCounts[a.id] ?? 0;
              const expertN = ev.expertCounts[a.id] ?? 0;
              return (
                <li
                  key={a.id}
                  className="nb-inbox__chip"
                  data-tone={toneOf(a)}
                  data-match={mine === expertN ? "true" : "false"}
                >
                  <span className="nb-inbox__action-icon" aria-hidden>
                    {actionIcon(a)}
                  </span>
                  <span className="nb-sr-only">
                    {t("inbox.callCount", { label: a.label, mine, expert: expertN })}
                  </span>
                  <span className="nb-inbox__chip-label" aria-hidden>
                    {a.label}
                  </span>
                  <strong className="nb-inbox__chip-count" aria-hidden>
                    {mine}
                  </strong>
                  <span className="nb-inbox__chip-expert" aria-hidden>
                    {t("inbox.expertShort", { count: expertN })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {priorityCount > 0 &&
          (missed.length > 0 ? (
            <div className="nb-inbox__callout" data-tone="danger">
              <TriangleAlert aria-hidden />
              <div>
                <p className="nb-inbox__callout-title">{t("inbox.missedTitle")}</p>
                <p className="nb-inbox__callout-body">{t("inbox.missedBody")}</p>
                <ul className="nb-inbox__missed">
                  {missed.map((m) => (
                    <li key={m.id}>
                      <strong>{m.from.name}</strong> · {m.subject} ·{" "}
                      {t("inbox.expert", { action: labelOf(m.correctAction) })}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="nb-inbox__callout" data-tone="success">
              <CircleCheck aria-hidden />
              <p className="nb-inbox__callout-title">{t("inbox.noneMissed")}</p>
            </div>
          ))}

        <section className="nb-inbox__report-section">
          <h4 className="nb-inbox__section-title">{t("inbox.review")}</h4>
          <ol className="nb-inbox__review">
            {ev.messages.map((r, i) => {
              const m = messages[i]!;
              return (
                <li key={r.id} className="nb-inbox__review-item" data-status={r.status}>
                  <span
                    className="nb-inbox__review-icon"
                    role="img"
                    aria-label={t(`inbox.status.${r.status}`)}
                  >
                    {STATUS_ICON[r.status]}
                  </span>
                  <div className="nb-inbox__review-body">
                    <div className="nb-inbox__review-head">
                      <span className="nb-inbox__review-subject">{m.subject}</span>
                      {r.priority && <Badge tone="warning">{t("inbox.priority")}</Badge>}
                    </div>
                    <div className="nb-inbox__review-from">{m.from.name}</div>
                    <div className="nb-inbox__review-calls">
                      <span
                        className={clsx("nb-inbox__call", "nb-inbox__call--mine")}
                        data-tone={toneOf(byId.get(r.decision ?? ""))}
                      >
                        {t("inbox.youChose", { action: labelOf(r.decision) })}
                      </span>
                      <span
                        className={clsx("nb-inbox__call", "nb-inbox__call--expert")}
                        data-tone={toneOf(byId.get(r.correctAction))}
                      >
                        {t("inbox.expert", { action: labelOf(r.correctAction) })}
                      </span>
                      {m.acceptable.length > 0 && (
                        <span className="nb-inbox__also">
                          {t("inbox.alsoFine", { actions: m.acceptable.map(labelOf).join(", ") })}
                        </span>
                      )}
                    </div>
                    <RichText className="nb-inbox__review-text" text={m.explanation} paragraphs />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </CompletionCard>
  );
}

export default InboxTriage;
