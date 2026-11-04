export function StatusBadge({ children, tone = "default" }) {
  const tones = {
    default: "bg-[var(--color-cream)] text-[var(--color-muted)]",
    ember: "bg-[var(--color-ember)] text-white",
    sage: "bg-[var(--color-sage)] text-[var(--color-parchment)]",
    wine: "bg-[var(--color-wine)] text-[var(--color-parchment)]",
  };
  return (
    <span className={`chip ${tones[tone] || tones.default}`}>
      {children}
    </span>
  );
}
