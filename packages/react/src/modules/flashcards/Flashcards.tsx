import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Shuffle, X } from "lucide-react";
import { flashcardsSchema, shuffle, type Flashcard, type FlashcardsConfig } from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { Badge } from "../../primitives/Badge";
import { ProgressBar } from "../../primitives/ProgressBar";
import { Hint } from "../../primitives/Hint";
import { SafeImage } from "../../primitives/SafeImage";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./flashcards.css";

export type FlashcardsProps = ModuleProps<FlashcardsConfig>;

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function Flashcards({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: FlashcardsProps) {
  const parsed = useMemo(() => flashcardsSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="flashcards"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <FlashcardsInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

type Rating = "again" | "got";

/** Owns the lifecycle; every reset remounts FlashcardsRun with fresh state (keyed by runId). */
function FlashcardsInner(props: FlashcardsProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "flashcards",
    onComplete,
    onEvent,
    resetKey,
  });
  return <FlashcardsRun key={life.runId} {...props} life={life} />;
}

function FlashcardsRun({
  life,
  config,
  hideHeader,
  className,
}: FlashcardsProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { cards } = config.content;
  const { behavior } = config;
  const total = cards.length;

  const initialQueue = useCallback(() => {
    const ids = cards.map((_, i) => i);
    return behavior.shuffle ? shuffle(ids, life.runId * 97 + 13) : ids;
  }, [cards, behavior.shuffle, life.runId]);

  /** Indices of cards in the current round, in order. */
  const [queue, setQueue] = useState<number[]>(initialQueue);
  const [pos, setPos] = useState(0);
  const [round, setRound] = useState(1);
  const [flipped, setFlipped] = useState(behavior.autoFlip);
  const [mastered, setMastered] = useState<number[]>([]);
  const [firstPassMastered, setFirstPassMastered] = useState(0);
  const [again, setAgain] = useState<number[]>([]);
  const [interstitial, setInterstitial] = useState(false);
  const [lastRating, setLastRating] = useState<Rating | null>(null);
  const [finished, setFinished] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const deckRef = useRef<HTMLDivElement>(null);

  /** Focus the newest card so keyboard shortcuts keep working after a rating button is disabled. */
  const focusCard = useCallback(() => {
    requestAnimationFrame(() => {
      const cards = deckRef.current?.querySelectorAll<HTMLButtonElement>(".nb-flash__card");
      cards?.[cards.length - 1]?.focus({ preventScroll: true });
    });
  }, []);

  const cardIndex = queue[pos];
  const card: Flashcard | undefined = cardIndex === undefined ? undefined : cards[cardIndex];
  const remainingInRound = queue.length - pos;
  const toReview = total - mastered.length;

  const finish = useCallback(
    (fpm: number, rounds: number, masteredCount: number) => {
      setFinished(true);
      life.complete({
        score: fpm / total,
        correct: fpm,
        total,
        details: { firstPassMastered: fpm, rounds, mastered: masteredCount },
      });
      announce(t("a11y.moduleComplete"));
    },
    [life, total, announce, t],
  );

  const rate = useCallback(
    (rating: Rating) => {
      if (card === undefined || cardIndex === undefined || finished || interstitial) return;
      life.attempt();
      const nextMastered = rating === "got" ? [...mastered, cardIndex] : mastered;
      const nextAgain = rating === "again" ? [...again, cardIndex] : again;
      const nextFpm = rating === "got" && round === 1 ? firstPassMastered + 1 : firstPassMastered;
      setMastered(nextMastered);
      setAgain(nextAgain);
      setFirstPassMastered(nextFpm);
      setLastRating(rating);
      life.emit("module:answer", { cardIndex, rating, round, correct: rating === "got" });
      announce(rating === "got" ? t("flash.gotIt") : t("flash.practiceAgain"));

      if (pos + 1 < queue.length) {
        setPos(pos + 1);
        setFlipped(behavior.autoFlip);
        focusCard();
        return;
      }
      // End of round.
      if (behavior.requireMastery && nextAgain.length > 0) {
        setInterstitial(true);
        return;
      }
      finish(nextFpm, round, nextMastered.length);
    },
    [
      card,
      cardIndex,
      finished,
      interstitial,
      life,
      mastered,
      again,
      round,
      firstPassMastered,
      pos,
      queue.length,
      behavior,
      announce,
      t,
      finish,
      focusCard,
    ],
  );

  const startReviewRound = useCallback(() => {
    setQueue(again);
    setAgain([]);
    setPos(0);
    setRound((r) => r + 1);
    setFlipped(behavior.autoFlip);
    setLastRating(null);
    setInterstitial(false);
    focusCard();
    life.emit("module:interact", { action: "reviewRound", round: round + 1, count: again.length });
  }, [again, behavior.autoFlip, life, round, focusCard]);

  const flip = useCallback(() => {
    if (!card) return;
    life.emit("module:interact", { action: "flip", cardIndex, side: flipped ? "front" : "back" });
    setFlipped(!flipped);
  }, [card, cardIndex, flipped, life]);

  const reshuffle = useCallback(() => {
    // Shuffle only the cards not yet rated in this round.
    const seed = shuffleSeed + 1;
    setShuffleSeed(seed);
    setQueue((q) => [...q.slice(0, pos), ...shuffle(q.slice(pos), life.runId * 31 + seed * 7 + 3)]);
    setFlipped(behavior.autoFlip);
    life.emit("module:interact", { action: "shuffle" });
  }, [shuffleSeed, pos, life, behavior.autoFlip]);

  const restart = useCallback(() => {
    life.reset();
    life.emit("module:reset");
  }, [life]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (finished || interstitial) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === "ArrowLeft" && flipped) {
        e.preventDefault();
        rate("again");
      } else if (e.key === "ArrowRight" && flipped) {
        e.preventDefault();
        rate("got");
      } else if ((e.key === " " || e.key === "Enter") && !(target instanceof HTMLButtonElement)) {
        e.preventDefault();
        flip();
      }
    },
    [finished, interstitial, flipped, rate, flip],
  );

  const progress = finished ? 1 : mastered.length / total;
  const counters = (
    <div className="nb-flash__counters">
      <span className="nb-flash__counter" data-tone="success">
        <Check aria-hidden strokeWidth={3} />
        {t("flash.mastered", { count: mastered.length })}
      </span>
      <span className="nb-flash__counter" data-tone="muted">
        {t("flash.toReview", { count: toReview })}
      </span>
    </div>
  );

  if (finished) {
    return (
      <ModuleShell
        type="flashcards"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        announcement={message}
      >
        <CompletionCard
          title={mastered.length === total ? t("flash.allMastered") : undefined}
          score={firstPassMastered / total}
          passThreshold={config.scoring.passThreshold}
          text={
            config.feedback.complete ?? t("flash.summary", { mastered: firstPassMastered, total })
          }
          stats={[
            { label: t("flash.gotIt"), value: `${firstPassMastered}/${total}` },
            { label: t("flash.rounds"), value: round },
          ]}
          onRetry={restart}
          retryLabel={t("common.restart")}
        />
      </ModuleShell>
    );
  }

  const faceId = `${config.id}-face-${cardIndex ?? 0}-${flipped ? "back" : "front"}`;

  return (
    <ModuleShell
      type="flashcards"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      announcement={message}
      eyebrow={
        <ProgressBar
          value={progress}
          showLabel={false}
          size="sm"
          tone="success"
          label={t("common.progress")}
        />
      }
      aside={
        <span className="nb-counter">
          {t("common.item", { current: Math.min(pos + 1, queue.length), total: queue.length })}
        </span>
      }
      onKeyDown={onKeyDown}
    >
      <div className="nb-flash">
        {counters}

        <div className="nb-flash__deck" ref={deckRef} data-flipped={flipped ? "true" : "false"}>
          {!interstitial && remainingInRound > 2 && (
            <div className="nb-flash__stack nb-flash__stack--2" aria-hidden />
          )}
          {!interstitial && remainingInRound > 1 && (
            <div className="nb-flash__stack nb-flash__stack--1" aria-hidden />
          )}

          <AnimatePresence mode="popLayout" initial={false} custom={lastRating}>
            {interstitial ? (
              <motion.div
                key={`inter-${round}`}
                className="nb-flash__interstitial"
                initial={reduced ? false : { opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.97 }}
                transition={{ duration: reduced ? 0 : 0.26, ease: EASE }}
                role="status"
              >
                <span className="nb-icon-circle">
                  <RotateCcw aria-hidden />
                </span>
                <h3 className="nb-flash__interstitial-title">{t("flash.reviewRound")}</h3>
                <p className="nb-muted">{t("flash.reviewRoundBody", { count: again.length })}</p>
                <Button
                  variant="primary"
                  onClick={startReviewRound}
                  autoFocus
                  trailing={<ArrowRight aria-hidden />}
                >
                  {t("common.continue")}
                </Button>
              </motion.div>
            ) : (
              card && (
                <motion.div
                  key={`${life.runId}-${round}-${pos}-${cardIndex}`}
                  className="nb-flash__card-wrap"
                  variants={{
                    enter: reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 },
                    center: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 },
                    exit: (r: Rating | null) =>
                      reduced
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            x: r === "again" ? -360 : 360,
                            rotate: r === "again" ? -8 : 8,
                            scale: 0.96,
                          },
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
                >
                  <button
                    type="button"
                    className="nb-flash__card"
                    aria-pressed={flipped}
                    data-motion={reduced ? "fade" : "flip"}
                    onClick={flip}
                  >
                    {/* Accessible name = "Flip card:" + the visible face (WCAG 2.5.3 label in name). */}
                    <span className="nb-sr-only">{t("flash.flip")}: </span>
                    <motion.div
                      className="nb-flash__inner"
                      animate={reduced ? undefined : { rotateY: flipped ? 180 : 0 }}
                      transition={{ duration: 0.42, ease: EASE }}
                    >
                      <FlashFace
                        side="front"
                        id={flipped ? undefined : faceId}
                        hidden={flipped}
                        text={card.front}
                        image={card.frontImage}
                        tag={card.tag}
                        caption={t("flash.showAnswer")}
                        reduced={reduced}
                      />
                      <FlashFace
                        side="back"
                        id={flipped ? faceId : undefined}
                        hidden={!flipped}
                        text={card.back}
                        image={card.backImage}
                        tag={card.tag}
                        caption={t("flash.showQuestion")}
                        reduced={reduced}
                      />
                    </motion.div>
                    <motion.span
                      className="nb-flash__tint"
                      data-tone="danger"
                      aria-hidden
                      variants={{
                        exit: (r: Rating | null) => ({ opacity: r === "again" ? 1 : 0 }),
                      }}
                    />
                    <motion.span
                      className="nb-flash__tint"
                      data-tone="success"
                      aria-hidden
                      variants={{ exit: (r: Rating | null) => ({ opacity: r === "got" ? 1 : 0 }) }}
                    />
                  </button>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>

        {!interstitial && card && !flipped && (
          <Hint
            text={card.hint}
            className="nb-flash__hint"
            onReveal={() => life.emit("module:hint", { cardIndex })}
          />
        )}

        {!interstitial && (
          <div className="nb-flash__actions" data-visible={flipped ? "true" : "false"}>
            <Button
              variant="danger"
              size="lg"
              className="nb-flash__rate nb-flash__rate--again"
              onClick={() => rate("again")}
              disabled={!flipped}
              leading={<X aria-hidden strokeWidth={3} />}
            >
              {t("flash.practiceAgain")}
            </Button>
            <Button
              variant="success"
              size="lg"
              className="nb-flash__rate nb-flash__rate--got"
              onClick={() => rate("got")}
              disabled={!flipped}
              leading={<Check aria-hidden strokeWidth={3} />}
            >
              {t("flash.gotIt")}
            </Button>
          </div>
        )}

        <div className="nb-flash__toolbar">
          {behavior.allowShuffle && !interstitial && remainingInRound > 1 && (
            <Button variant="ghost" size="sm" onClick={reshuffle} leading={<Shuffle aria-hidden />}>
              {t("flash.shuffle")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={restart} leading={<RotateCcw aria-hidden />}>
            {t("common.restart")}
          </Button>
          {!interstitial && (
            <span className="nb-flash__keys nb-subtle nb-text-xs" aria-hidden>
              <kbd>
                <ArrowLeft />
              </kbd>
              <kbd>
                <ArrowRight />
              </kbd>
            </span>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}

function FlashFace({
  side,
  id,
  hidden,
  text,
  image,
  tag,
  caption,
  reduced,
}: {
  side: "front" | "back";
  id?: string;
  hidden: boolean;
  text: string;
  image?: Flashcard["frontImage"];
  tag?: string;
  caption: string;
  reduced: boolean;
}) {
  const { t } = useNibblearn();
  return (
    <motion.div
      className={`nb-flash__face nb-flash__face--${side}`}
      id={id}
      aria-hidden={hidden}
      animate={reduced ? { opacity: hidden ? 0 : 1 } : undefined}
      transition={{ duration: 0 }}
    >
      <div className="nb-flash__face-head">
        {tag ? <Badge tone={side === "front" ? "accent" : "success"}>{tag}</Badge> : <span />}
        <span className="nb-flash__side">
          {side === "front" ? t("flash.front") : t("flash.back")}
        </span>
      </div>
      <div className="nb-flash__face-body">
        {image && <SafeImage media={image} className="nb-flash__image" showCaption={false} />}
        <div className="nb-flash__text" data-long={text.length > 120 ? "true" : "false"}>
          <RichText text={text} paragraphs />
        </div>
      </div>
      <div className="nb-flash__caption">{caption}</div>
    </motion.div>
  );
}

export default Flashcards;
