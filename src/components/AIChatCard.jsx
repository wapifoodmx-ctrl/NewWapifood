"use client";

import * as React from "react";
import { motion, useInView } from "motion/react";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";

/**
 * @typedef {Object} AIChatCardProps
 * @property {string} [title]
 * @property {string} [subtitle]
 * @property {string} [greeting]
 * @property {string} [prompt]
 * @property {string[]} [prompts]
 * @property {boolean} [autoType]
 * @property {string} [placeholder]
 * @property {React.ReactNode} [icon]
 * @property {(message: string) => string | void} [onSend]
 * @property {() => void} [onReset]
 * @property {() => void} [onAttach]
 * @property {string} [className]
 */

const DEFAULT_PROMPTS = [
  "I'm building a chat for our app and the scroll behavior is driving me nuts. Every…",
  "Add a pricing table with a monthly/annual toggle",
  "Make my hero section feel more premium",
  "Generate a changelog page from our GitHub releases",
];

export function AIChatCard({
  title = "New Chat",
  subtitle = "How can I help you today?",
  greeting = "Morning, Arihant!",
  prompt = DEFAULT_PROMPTS[0],
  prompts = DEFAULT_PROMPTS,
  autoType = true,
  placeholder = "Ask anything…",
  icon,
  onSend,
  onReset,
  onAttach,
  className,
}) {
  const rootRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const inView = useInView(rootRef, { margin: "-10% 0px" });
  const [userActive, setUserActive] = React.useState(false);
  const [userMessage, setUserMessage] = React.useState("");
  const [spins, setSpins] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [phase, setPhase] = React.useState("idle");
  const [history, setHistory] = React.useState([]);

  const list = React.useMemo(() => (prompts && prompts.length ? prompts : [prompt || ""]), [prompts, prompt]);

  React.useEffect(() => {
    if (!autoType || !inView || userActive) return undefined;
    let index = 0;
    let char = 0;
    let deleting = false;
    let timer = null;

    const tick = () => {
      const text = list[Math.min(index, list.length - 1)];
      if (!deleting) {
        char += 1;
        setTyped(text.slice(0, char));
        if (char >= text.length) {
          setPhase("holding");
          timer = setTimeout(() => {
            deleting = true;
            setPhase("typing");
            tick();
          }, 3400);
          return;
        }
        timer = setTimeout(tick, 48);
      } else {
        char -= 1;
        setTyped(text.slice(0, Math.max(0, char)));
        if (char <= 0) {
          index = (index + 1) % list.length;
          char = 0;
          deleting = false;
          setPhase("typing");
          timer = setTimeout(tick, 900);
          return;
        }
        timer = setTimeout(tick, 14);
      }
    };

    tick();
    return () => clearTimeout(timer);
  }, [autoType, inView, userActive, list, prompt]);

  const message = userActive || !autoType ? userMessage : typed;

  function sendMessage(message) {
    const q = String(message ?? "").trim();
    if (!q) return;
    const reply = onSend?.(q);
    setHistory((h) => [...h, { role: "user", text: q }, ...(reply ? [{ role: "bot", text: reply }] : [])]);
    setUserActive(false);
    setUserMessage("");
  }

  const takeOver = () => {
    if (userActive || !autoType) return;
    setUserMessage(typed);
    setUserActive(true);
  };

  const reset = () => {
    setSpins((count) => count + 1);
    setUserActive(false);
    setUserMessage("");
    setHistory([]);
    onReset?.();
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-[var(--color-warm-stone)] bg-[var(--color-paper)] shadow-xl",
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-warm-stone)] px-5 pb-4 pt-5">
        <div>
          <h3 className="text-[16px] font-medium leading-6 text-[var(--color-onyx-warm)]">{title}</h3>
          <p className="mt-0.5 text-sm leading-5 text-[var(--color-muted)]">{subtitle}</p>
        </div>
        <motion.button
          type="button"
          onClick={reset}
          whileTap={{ scale: 0.9 }}
          aria-label="Reset conversation"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[18px] border border-[var(--color-warm-stone)] bg-[var(--color-cream)] text-[var(--color-muted)] transition-colors hover:text-[var(--color-onyx-warm)]"
        >
          <motion.span animate={{ rotate: spins * 360 }} transition={{ type: "spring", bounce: 0.2, duration: 0.7 }} className="flex">
            <Icon name="close" size={14} />
          </motion.span>
        </motion.button>
      </div>

      {history.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-3">
            {history.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-5 ${
                    m.role === "user"
                      ? "bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
                      : "bg-[var(--color-linen)] text-[var(--color-onyx-warm)]"
                  }`}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 py-10 text-center">
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--color-linen)]"
          >
            {icon ?? <Icon name="receipt" size={20} />}
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            className="mt-4 text-[18px] font-medium leading-7 tracking-[-0.45px] text-[var(--color-onyx-warm)]"
          >
            {greeting}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
            className="mt-1.5 max-w-[190px] text-sm leading-[22.75px] text-[var(--color-muted)]"
          >
            {prompt}
          </motion.p>
        </div>
      )}

      <div className="shrink-0 px-5 pb-5">
        <div className="rounded-[18px] bg-[var(--color-parchment)] p-3 transition-colors focus-within:bg-[var(--color-linen)]">
          {userActive || !autoType ? (
            <textarea
              ref={textareaRef}
              value={userMessage}
              onChange={(event) => setUserMessage(event.target.value)}
              placeholder={placeholder}
              rows={2}
              className="w-full resize-none bg-transparent text-sm leading-5 text-[var(--color-onyx-warm)] outline-hidden placeholder:text-[var(--color-muted)]"
            />
          ) : (
            <div onClick={takeOver} className="min-h-10 cursor-text text-left text-sm leading-5 text-[var(--color-onyx-warm)]">
              {message}
              <motion.span
                aria-hidden
                className="ml-px inline-block h-3.5 w-px bg-[var(--color-onyx-warm)] align-middle"
                animate={{ opacity: [1, 1, 0, 0] }}
                transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
              />
              {!message ? <span className="text-[var(--color-muted)]">{placeholder}</span> : null}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            {onAttach ? (
              <motion.button
                type="button"
                onClick={onAttach}
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", bounce: 0.4, duration: 0.4 }}
                aria-label="Add files"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[18px] border border-[var(--color-warm-stone)] bg-[var(--color-cream)] text-[var(--color-onyx-warm)]"
              >
                <Icon name="plus" size={14} />
              </motion.button>
            ) : null}
            <motion.button
              type="button"
              onClick={() => sendMessage(message)}
              whileHover={{ scale: 1.08, transition: { type: "spring", bounce: 0.5, duration: 0.4 } }}
              whileTap={{ scale: 0.88, transition: { type: "spring", bounce: 0.5, duration: 0.4 } }}
              animate={phase === "holding" && !userActive ? { scale: [1, 1.14, 1] } : { scale: 1 }}
              transition={{ duration: 0.5, ease: "easeInOut", times: [0, 0.35, 1] }}
              aria-label="Send message"
              className="group flex h-[30px] w-[30px] items-center justify-center rounded-[18px] bg-[var(--color-onyx-warm)] text-[var(--color-parchment)]"
            >
              <Icon name="arrow-up" size={14} />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChatCard;
