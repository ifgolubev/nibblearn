import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, MessageCircle, Send, Smile } from "lucide-react";
import clsx from "clsx";
import {
  conversationSchema,
  createScriptedProvider,
  responsesOf,
  summarizeConversation,
  typingDelay,
  type ConversationConfig,
  type ConversationNode,
  type ConversationProvider,
  type ConversationTurn,
  type ScriptedResponse,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Badge } from "../../primitives/Badge";
import { SafeImage } from "../../primitives/SafeImage";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./conversation.css";

export interface ConversationProps extends ModuleProps<ConversationConfig> {
  /**
   * Custom engine deciding what happens next (e.g. an AI-backed provider supplied by the host).
   * Defaults to the scripted provider that follows the JSON graph.
   */
  provider?: ConversationProvider;
}

type Outcome = NonNullable<ConversationNode["outcome"]>;

interface ChatMessage {
  key: string;
  from: "them" | "system" | "you";
  text: string;
  /** Coaching note attached to a learner message. */
  note?: { tone?: string; effectiveness: number; feedback?: string };
}

const SYSTEM_DELAY = 400;
const STAGGER = 180;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function badgeTone(effectiveness: number): "success" | "warning" | "danger" {
  return effectiveness >= 0.7 ? "success" : effectiveness >= 0.4 ? "warning" : "danger";
}

function OutcomeIcon({ outcome }: { outcome: Outcome }) {
  if (outcome === "success") return <Smile aria-hidden />;
  if (outcome === "failure") return <AlertTriangle aria-hidden />;
  return <MessageCircle aria-hidden />;
}

function EffectivenessMeter({ value, label }: { value: number; label: string }) {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * 5);
  return (
    <span
      className="nb-conv__meter"
      role="img"
      aria-label={`${label}: ${Math.round(value * 100)}%`}
      data-tone={badgeTone(value)}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="nb-conv__meter-dot" data-on={i < filled ? "true" : "false"} />
      ))}
    </span>
  );
}

export function Conversation({ config: rawConfig, ...rest }: ConversationProps) {
  const parsed = useMemo(() => conversationSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="conversation"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return <ConversationInner config={parsed.data} {...rest} />;
}

function ConversationInner({
  config,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
  provider,
}: ConversationProps) {
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "conversation",
    onComplete,
    onEvent,
    resetKey,
  });
  // Keyed by runId so every reset remounts with a fresh transcript and a restarted provider.
  return (
    <ConversationRun
      key={life.runId}
      config={config}
      life={life}
      provider={provider}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

interface ConversationRunProps {
  config: ConversationConfig;
  life: ModuleLifecycle;
  provider?: ConversationProvider;
  hideHeader?: boolean;
  className?: string;
}

function ConversationRun({ config, life, provider, hideHeader, className }: ConversationRunProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { contact } = config.content;
  const { behavior } = config;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [turn, setTurn] = useState<ConversationTurn | null>(null);
  const [playing, setPlaying] = useState(true);
  const [chosen, setChosen] = useState<ScriptedResponse[]>([]);
  const [done, setDone] = useState(false);

  const providerRef = useRef<ConversationProvider | null>(null);
  /** Returns false once this run is unmounted; pending playback then stops. */
  const aliveRef = useRef<() => boolean>(() => false);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const logRef = useRef<HTMLDivElement>(null);
  const repliesRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(() => {
          timersRef.current.delete(id);
          resolve();
        }, ms);
        timersRef.current.add(id);
      }),
    [],
  );

  // Play a turn's messages one by one, honouring typing delays. Aborts once the run is unmounted.
  const playTurn = useCallback(
    async (next: ConversationTurn) => {
      const alive = aliveRef.current;
      setPlaying(true);
      setTurn(next);
      for (const [i, m] of next.node.messages.entries()) {
        if (!alive()) return;
        if (m.from === "system") {
          await wait(m.delayMs ?? SYSTEM_DELAY);
        } else if (behavior.typingIndicator) {
          setTyping(true);
          await wait(typingDelay(m.text, m.delayMs));
          setTyping(false);
        } else {
          await wait(m.delayMs ?? STAGGER);
        }
        if (!alive()) return;
        setMessages((prev) => [
          ...prev,
          { key: `${next.node.id}-${i}`, from: m.from, text: m.text },
        ]);
      }
      if (!alive()) return;
      setPlaying(false);
      if (next.done) setDone(true);
      else
        requestAnimationFrame(() =>
          repliesRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
        );
    },
    [behavior.typingIndicator, wait],
  );

  // Start the conversation on mount; stop playback and clear timers on unmount.
  useEffect(() => {
    let alive = true;
    aliveRef.current = () => alive;
    const timers = timersRef.current;
    providerRef.current = provider ?? createScriptedProvider(config);
    Promise.resolve(providerRef.current.start()).then((first) => {
      if (alive) void playTurn(first);
    });
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [config, provider, playTurn]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [messages.length, typing, done, reduced]);

  const summary = useMemo(
    () => (done ? summarizeConversation(chosen, turn?.node) : null),
    [done, chosen, turn],
  );

  // Complete once the ending has fully played out.
  useEffect(() => {
    if (!done || !summary || completedRef.current) return;
    completedRef.current = true;
    life.complete({
      score: summary.score,
      details: {
        outcome: summary.outcome,
        tones: summary.tones,
        path: chosen.map((r) => r.id),
        ending: turn?.node.id,
      },
    });
    announce(`${t(`conv.outcome.${summary.outcome}`)}. ${t("a11y.moduleComplete")}`);
  }, [done, summary, chosen, turn, life, announce, t]);

  const responses = useMemo(() => (turn && !turn.done ? responsesOf(turn.node) : []), [turn]);
  const canReply = !playing && !done && responses.length > 0;

  const reply = useCallback(
    (r: ScriptedResponse) => {
      if (!canReply || !providerRef.current) return;
      life.attempt();
      life.emit("module:answer", {
        nodeId: turn?.node.id,
        responseId: r.id,
        tone: r.tone,
        effectiveness: r.effectiveness,
        next: r.next,
      });
      setChosen((prev) => [...prev, r]);
      setMessages((prev) => [
        ...prev,
        {
          key: `you-${prev.length}`,
          from: "you",
          text: r.text,
          note: behavior.showFeedback
            ? { tone: r.tone, effectiveness: r.effectiveness, feedback: r.feedback }
            : undefined,
        },
      ]);
      if (behavior.showFeedback && r.feedback) announce(r.feedback);
      setPlaying(true);
      Promise.resolve(providerRef.current.respond(r.id)).then((next) => {
        if (aliveRef.current()) void playTurn(next);
      });
    },
    [canReply, life, turn, behavior.showFeedback, announce, playTurn],
  );

  const restart = useCallback(() => {
    life.reset();
    life.emit("module:reset");
  }, [life]);

  // Keyboard: number keys 1–5 pick a reply.
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (!canReply) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (!/^[1-5]$/.test(e.key)) return;
      const r = responses[Number(e.key) - 1];
      if (!r) return;
      e.preventDefault();
      reply(r);
    },
    [canReply, responses, reply],
  );

  const bubbleMotion = {
    initial: reduced ? false : { opacity: 0, y: 10, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: reduced ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] as const },
  };

  return (
    <ModuleShell
      type="conversation"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      announcement={message}
      onKeyDown={onKeyDown}
    >
      <div className="nb-conv">
        <header className="nb-conv__header">
          {contact.avatar ? (
            <SafeImage media={contact.avatar} className="nb-conv__avatar" showCaption={false} />
          ) : (
            <span className="nb-conv__avatar nb-conv__avatar--initials" aria-hidden>
              {initials(contact.name)}
            </span>
          )}
          <div className="nb-conv__contact">
            <div className="nb-conv__name">{contact.name}</div>
            {(contact.role || contact.status) && (
              <div className="nb-conv__meta">
                {contact.role && <span>{contact.role}</span>}
                {contact.status && (
                  <span className="nb-conv__status">
                    <span className="nb-conv__status-dot" aria-hidden />
                    {contact.status}
                  </span>
                )}
              </div>
            )}
          </div>
        </header>

        <div
          ref={logRef}
          className="nb-conv__log"
          role="log"
          aria-live="polite"
          aria-label={contact.name}
        >
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.key}
                className={clsx("nb-conv__row", `nb-conv__row--${m.from}`)}
                {...bubbleMotion}
                layout={!reduced}
              >
                {m.from === "system" ? (
                  <span className="nb-conv__system">
                    <RichText text={m.text} />
                  </span>
                ) : (
                  <div className="nb-conv__stack">
                    <span className="nb-sr-only">
                      {m.from === "you" ? t("conv.you") : contact.name}:{" "}
                    </span>
                    <div className="nb-conv__bubble">
                      <RichText text={m.text} />
                    </div>
                    {m.note && (
                      <div className="nb-conv__note" data-tone={badgeTone(m.note.effectiveness)}>
                        <div className="nb-conv__note-head">
                          {m.note.tone && (
                            <Badge tone={badgeTone(m.note.effectiveness)}>{m.note.tone}</Badge>
                          )}
                          <EffectivenessMeter
                            value={m.note.effectiveness}
                            label={t("conv.effectiveness")}
                          />
                        </div>
                        {m.note.feedback && (
                          <div className="nb-conv__note-text">
                            <RichText text={m.note.feedback} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
            {typing && (
              <motion.div
                key="typing"
                className="nb-conv__row nb-conv__row--them"
                {...bubbleMotion}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
              >
                <div className="nb-conv__bubble nb-conv__bubble--typing">
                  <span className="nb-sr-only">{t("conv.typing", { name: contact.name })}</span>
                  <span className="nb-conv__dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {canReply && (
            <motion.div
              key={`composer-${turn?.node.id}`}
              className="nb-conv__composer"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
            >
              <div className="nb-conv__composer-label" id={`${config.id}-replies`}>
                <Send aria-hidden />
                {t("conv.chooseReply")}
              </div>
              <div
                ref={repliesRef}
                className="nb-conv__replies"
                role="group"
                aria-labelledby={`${config.id}-replies`}
              >
                {responses.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    className="nb-conv__reply"
                    onClick={() => reply(r)}
                  >
                    <span className="nb-conv__reply-key" aria-hidden>
                      {i + 1}
                    </span>
                    <span className="nb-conv__reply-text">
                      <RichText text={r.text} />
                    </span>
                    {r.tone && <Badge className="nb-conv__reply-tone">{r.tone}</Badge>}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {done && summary && (
          <div className="nb-conv__summary" data-outcome={summary.outcome}>
            <CompletionCard
              score={summary.score}
              passThreshold={0.7}
              title={t("conv.summary")}
              text={turn?.node.summary ?? config.feedback.complete}
              stats={[
                { label: t("conv.replies"), value: chosen.length },
                { label: t("conv.tone"), value: summary.tones.length },
              ]}
              onRetry={behavior.allowRetry ? restart : undefined}
              retryLabel={t("conv.replay")}
            >
              <div className="nb-conv__outcome" role="status">
                <OutcomeIcon outcome={summary.outcome} />
                <span>{t(`conv.outcome.${summary.outcome}`)}</span>
              </div>
              {summary.tones.length > 0 && (
                <div className="nb-conv__tones">
                  <div className="nb-conv__section-title">{t("conv.tones")}</div>
                  <div className="nb-conv__chips">
                    {summary.tones.map((tone) => (
                      <Badge key={tone} tone="accent">
                        {tone}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {chosen.length > 0 && (
                <div className="nb-conv__transcript">
                  <div className="nb-conv__section-title">{t("conv.transcript")}</div>
                  <ol className="nb-conv__transcript-list">
                    {chosen.map((r, i) => (
                      <li
                        key={`${r.id}-${i}`}
                        className="nb-conv__transcript-item"
                        data-tone={badgeTone(r.effectiveness)}
                      >
                        <div className="nb-conv__transcript-head">
                          <span className="nb-conv__transcript-text">
                            <RichText text={r.text} />
                          </span>
                          <EffectivenessMeter
                            value={r.effectiveness}
                            label={t("conv.effectiveness")}
                          />
                        </div>
                        {r.feedback && (
                          <div className="nb-conv__transcript-feedback">
                            <RichText text={r.feedback} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </CompletionCard>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}

export default Conversation;
