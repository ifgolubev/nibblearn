import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Quote } from "lucide-react";
import {
  storyCardsSchema,
  splitParagraphs,
  type StoryCard,
  type StoryCardsConfig,
} from "@nibblearn/core";
import type { ModuleProps } from "../types";
import { useNibblearn } from "../../context/NibblearnProvider";
import { useModuleLifecycle, type ModuleLifecycle } from "../../hooks/useModuleLifecycle";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { useAnnounce } from "../../hooks/useAnnounce";
import { Button } from "../../primitives/Button";
import { StepDots } from "../../primitives/ProgressBar";
import { OptionCard, type OptionState } from "../../primitives/OptionCard";
import { AnimatedFeedback } from "../../primitives/Feedback";
import { SafeImage } from "../../primitives/SafeImage";
import { RichText } from "../../primitives/RichText";
import { CompletionCard } from "../../primitives/CompletionCard";
import { ModuleShell, InvalidModule } from "../../primitives/ModuleShell";
import "./story-cards.css";

export type StoryCardsProps = ModuleProps<StoryCardsConfig>;

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function StoryCards({
  config: rawConfig,
  onComplete,
  onEvent,
  resetKey,
  hideHeader,
  className,
}: StoryCardsProps) {
  const parsed = useMemo(() => storyCardsSchema.safeParse(rawConfig), [rawConfig]);
  if (!parsed.success) {
    return (
      <InvalidModule
        type="story-cards"
        issues={parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))}
      />
    );
  }
  return (
    <StoryCardsInner
      config={parsed.data}
      onComplete={onComplete}
      onEvent={onEvent}
      resetKey={resetKey}
      hideHeader={hideHeader}
      className={className}
    />
  );
}

/** Owns the lifecycle; every reset remounts StoryCardsRun with fresh state (keyed by runId). */
function StoryCardsInner(props: StoryCardsProps) {
  const { config, onComplete, onEvent, resetKey } = props;
  const life = useModuleLifecycle({
    moduleId: config.id,
    moduleType: "story-cards",
    onComplete,
    onEvent,
    resetKey,
  });
  return <StoryCardsRun key={life.runId} {...props} life={life} />;
}

function StoryCardsRun({
  life,
  config,
  hideHeader,
  className,
}: StoryCardsProps & { life: ModuleLifecycle }) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const { message, announce } = useAnnounce();
  const { cards } = config.content;
  const { behavior } = config;

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  /** cardIndex -> chosen option index */
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  /** Move focus onto the card once it has animated in (keyboard navigation). */
  const focusCard = useRef(false);
  const cardRef = useRef<HTMLElement | null>(null);

  const card = cards[index]!;
  const isLast = index + 1 >= cards.length;
  const answered = answers[index] !== undefined;
  const checkTotal = useMemo(() => cards.filter((c) => c.check).length, [cards]);
  const checkCorrect = useMemo(
    () =>
      cards.reduce(
        (n, c, i) =>
          c.check && answers[i] !== undefined && c.check.options[answers[i]!]?.correct ? n + 1 : n,
        0,
      ),
    [cards, answers],
  );
  const nextBlocked = Boolean(behavior.requireChecks && card.check && !answered);

  const finish = useCallback(() => {
    setFinished(true);
    const details = {
      checks: { correct: checkCorrect, total: checkTotal },
      cardsViewed: cards.length,
    };
    if (checkTotal > 0) {
      life.complete({
        score: checkCorrect / checkTotal,
        correct: checkCorrect,
        total: checkTotal,
        details,
      });
    } else {
      life.complete({ details });
    }
    announce(t("a11y.moduleComplete"));
  }, [checkCorrect, checkTotal, cards.length, life, announce, t]);

  const next = useCallback(() => {
    if (finished || nextBlocked) return;
    if (isLast) {
      finish();
      return;
    }
    setDirection(1);
    setIndex((i) => i + 1);
    focusCard.current = true;
    life.emit("module:interact", { action: "next", cardIndex: index + 1 });
  }, [finished, nextBlocked, isLast, finish, life, index]);

  const back = useCallback(() => {
    if (finished || !behavior.allowBack || index === 0) return;
    setDirection(-1);
    setIndex((i) => i - 1);
    focusCard.current = true;
    life.emit("module:interact", { action: "back", cardIndex: index - 1 });
  }, [finished, behavior.allowBack, index, life]);

  const answer = useCallback(
    (optionIndex: number) => {
      if (!card.check || answered) return;
      const correct = Boolean(card.check.options[optionIndex]?.correct);
      setAnswers((prev) => ({ ...prev, [index]: optionIndex }));
      life.attempt();
      life.emit("module:answer", { cardIndex: index, optionIndex, correct });
      announce(correct ? t("a11y.correctAnswer") : t("a11y.incorrectAnswer"));
    },
    [card.check, answered, index, life, announce, t],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (finished) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    },
    [finished, next, back],
  );

  const restart = () => {
    life.reset();
    life.emit("module:reset");
  };

  if (finished) {
    const hasChecks = checkTotal > 0;
    return (
      <ModuleShell
        type="story-cards"
        id={config.id}
        title={hideHeader ? undefined : config.title}
        appearance={config.appearance}
        className={className}
        announcement={message}
      >
        <CompletionCard
          score={hasChecks ? checkCorrect / checkTotal : undefined}
          passThreshold={config.scoring.passThreshold}
          text={
            config.feedback.complete ??
            (hasChecks
              ? t("common.youGot", { correct: checkCorrect, total: checkTotal })
              : undefined)
          }
          stats={[
            {
              label: t("common.completed"),
              value: t("common.item", { current: cards.length, total: cards.length }),
            },
            ...(hasChecks
              ? [{ label: t("common.correct"), value: `${checkCorrect}/${checkTotal}` }]
              : []),
          ]}
          onRetry={restart}
          retryLabel={t("common.restart")}
        />
      </ModuleShell>
    );
  }

  const variants = {
    enter: (dir: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: dir * 56, scale: 0.98 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: dir * -56, scale: 0.98 }),
  };

  return (
    <ModuleShell
      type="story-cards"
      id={config.id}
      title={hideHeader ? undefined : config.title}
      instructions={hideHeader ? undefined : config.instructions}
      appearance={config.appearance}
      className={className}
      announcement={message}
      aside={
        behavior.showProgress && cards.length > 1 ? (
          <span className="nb-counter">
            {t("story.card", { current: index + 1, total: cards.length })}
          </span>
        ) : undefined
      }
      eyebrow={
        behavior.showProgress && cards.length > 1 ? (
          <StepDots
            total={cards.length}
            current={index}
            label={t("story.card", { current: index + 1, total: cards.length })}
          />
        ) : undefined
      }
      onKeyDown={onKeyDown}
    >
      <div className="nb-story__stage">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.article
            key={`${life.runId}-${index}`}
            ref={cardRef}
            className="nb-story__card"
            data-layout={card.layout}
            tabIndex={-1}
            onAnimationComplete={(def) => {
              if (def === "center" && focusCard.current) {
                focusCard.current = false;
                cardRef.current?.focus({ preventScroll: true });
              }
            }}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduced ? 0 : 0.28, ease: EASE }}
            aria-roledescription="card"
            aria-label={card.title ?? t("story.card", { current: index + 1, total: cards.length })}
          >
            <StoryCardBody
              card={card}
              cardIndex={index}
              reveal={behavior.progressiveReveal && !reduced}
              chosen={answers[index]}
              onAnswer={answer}
              onExpand={() => life.emit("module:interact", { action: "expand", cardIndex: index })}
            />
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="nb-story__nav">
        {behavior.allowBack ? (
          <Button
            variant="ghost"
            onClick={back}
            disabled={index === 0}
            leading={<ArrowLeft aria-hidden />}
          >
            {t("common.back")}
          </Button>
        ) : (
          <span />
        )}
        {index === 0 && cards.length > 1 && (
          <span className="nb-story__hint nb-subtle nb-text-xs">{t("story.swipeHint")}</span>
        )}
        <Button
          variant="primary"
          onClick={next}
          disabled={nextBlocked}
          trailing={isLast ? <Check aria-hidden strokeWidth={3} /> : <ArrowRight aria-hidden />}
          className="nb-story__next"
        >
          {isLast ? t("story.lastCard") : t("common.next")}
        </Button>
      </div>
    </ModuleShell>
  );
}

interface StoryCardBodyProps {
  card: StoryCard;
  cardIndex: number;
  reveal: boolean;
  chosen: number | undefined;
  onAnswer: (optionIndex: number) => void;
  onExpand: () => void;
}

function StoryCardBody({
  card,
  cardIndex,
  reveal,
  chosen,
  onAnswer,
  onExpand,
}: StoryCardBodyProps) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  // The card is keyed by index, so this state is fresh for every card.
  const [expanded, setExpanded] = useState(false);

  const paragraphs = useMemo(() => (card.body ? splitParagraphs(card.body) : []), [card.body]);
  const baseDelay = card.layout === "cover" ? 0.18 : 0.08;
  const layout = card.layout;

  const para = (text: string, i: number, className?: string) => (
    <motion.p
      key={i}
      className={className}
      initial={reveal ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE, delay: baseDelay + i * 0.14 }}
    >
      <RichText text={text} />
    </motion.p>
  );

  const header = (
    <>
      {card.eyebrow && <div className="nb-story__eyebrow">{card.eyebrow}</div>}
      {card.title && layout !== "quote" && <h3 className="nb-story__title">{card.title}</h3>}
    </>
  );

  return (
    <>
      {layout === "cover" && (
        <div className="nb-story__hero">
          {card.image ? (
            <SafeImage
              media={card.image}
              className="nb-story__hero-image"
              rounded={false}
              showCaption={false}
            />
          ) : (
            <div className="nb-story__hero-fallback" aria-hidden />
          )}
          <div className="nb-story__hero-overlay">{header}</div>
        </div>
      )}
      {layout !== "cover" && card.image && (
        <SafeImage media={card.image} className="nb-story__image" />
      )}

      <div className="nb-story__content">
        {layout !== "cover" && layout !== "quote" && header}

        {layout === "stat" && card.stat && (
          <motion.div
            className="nb-story__stat"
            initial={reveal ? { opacity: 0, scale: 0.85 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.05 }}
          >
            <div className="nb-story__stat-value">{card.stat.value}</div>
            <div className="nb-story__stat-label">{card.stat.label}</div>
          </motion.div>
        )}

        {layout === "quote" ? (
          <blockquote className="nb-story__quote">
            <Quote aria-hidden className="nb-story__quote-mark" />
            {card.eyebrow && <div className="nb-story__eyebrow">{card.eyebrow}</div>}
            {paragraphs.map((p, i) => para(p, i, "nb-story__quote-text"))}
            {card.title && (
              <motion.footer
                className="nb-story__quote-cite"
                initial={reveal ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: baseDelay + paragraphs.length * 0.14 }}
              >
                {card.title}
              </motion.footer>
            )}
          </blockquote>
        ) : (
          paragraphs.length > 0 && (
            <div className="nb-story__body">{paragraphs.map((p, i) => para(p, i))}</div>
          )
        )}

        {card.expandable && (
          <div className="nb-story__expand">
            <button
              type="button"
              className="nb-story__expand-btn"
              aria-expanded={expanded}
              onClick={() => {
                if (!expanded) onExpand();
                setExpanded((v) => !v);
              }}
            >
              <span>{expanded ? t("common.showLess") : card.expandable.label}</span>
              <motion.span
                className="nb-story__expand-icon"
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: reduced ? 0 : 0.2 }}
              >
                <ChevronDown aria-hidden />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  className="nb-story__expand-body"
                  initial={reduced ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.26, ease: EASE }}
                >
                  <div className="nb-story__expand-inner">
                    <RichText text={card.expandable.body} paragraphs />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {card.check && (
          <StoryCheck
            check={card.check}
            chosen={chosen}
            onAnswer={onAnswer}
            labelId={`nb-story-check-${cardIndex}`}
            delay={reveal ? baseDelay + paragraphs.length * 0.14 : 0}
          />
        )}
      </div>
    </>
  );
}

function StoryCheck({
  check,
  chosen,
  onAnswer,
  labelId,
  delay,
}: {
  check: NonNullable<StoryCard["check"]>;
  chosen: number | undefined;
  onAnswer: (i: number) => void;
  labelId: string;
  delay: number;
}) {
  const { t } = useNibblearn();
  const reduced = useReducedMotion();
  const answered = chosen !== undefined;
  const correct = answered && Boolean(check.options[chosen]?.correct);

  const stateFor = (i: number): OptionState => {
    if (!answered) return "idle";
    const opt = check.options[i]!;
    if (i === chosen) return opt.correct ? "correct" : "incorrect";
    if (opt.correct) return "missed";
    return "idle";
  };

  return (
    <motion.div
      className="nb-story__check"
      initial={reduced || delay === 0 ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE, delay }}
    >
      <div className="nb-story__check-head">
        <span className="nb-story__check-label">{t("story.checkTitle")}</span>
        {answered && <span className="nb-badge nb-badge--accent">{t("story.answered")}</span>}
      </div>
      <p className="nb-story__check-question" id={labelId}>
        <RichText text={check.question} />
      </p>
      <div className="nb-story__check-options" role="radiogroup" aria-labelledby={labelId}>
        {check.options.map((o, i) => (
          <OptionCard
            key={i}
            text={o.text}
            state={stateFor(i)}
            disabled={answered}
            onClick={() => onAnswer(i)}
          />
        ))}
      </div>
      <AnimatedFeedback
        show={answered}
        tone={correct ? "correct" : "incorrect"}
        title={correct ? t("common.correct") : t("common.incorrect")}
        text={check.explanation}
      />
    </motion.div>
  );
}

export default StoryCards;
