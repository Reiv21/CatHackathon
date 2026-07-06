import { useEffect, useRef, useState } from "react";

export interface CatArmyCounterProps {
  targetCount: number;
  lang: "pl" | "en";
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Formats the counter display string for a given count and language.
 * Exported for property-based testing (Property 6).
 *
 * @example
 * formatCounterDisplay(1234, "pl") // "🐱 1 234 Kocia Armia"
 * formatCounterDisplay(1234, "en") // "🐱 1,234 Cat Army"
 */
export function formatCounterDisplay(count: number, lang: "pl" | "en"): string {
  const locale = lang === "pl" ? "pl-PL" : "en-US";
  const formatted = Math.floor(count).toLocaleString(locale);
  const label = lang === "pl" ? "Kocia Armia" : "Cat Army";
  return `🐱 ${formatted} ${label}`;
}

const ANIMATION_DURATION_MS = 2000;

export function CatArmyCounter({ targetCount, lang }: CatArmyCounterProps) {
  const [displayCount, setDisplayCount] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset animation when targetCount changes
    setDisplayCount(0);
    startTimeRef.current = null;

    if (targetCount <= 0) {
      setDisplayCount(0);
      return;
    }

    function animate(timestamp: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
      const easedProgress = easeOutCubic(progress);
      const currentValue = Math.floor(easedProgress * targetCount);

      setDisplayCount(currentValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure we land exactly on targetCount
        setDisplayCount(targetCount);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [targetCount]);

  return (
    <div
      className="text-3xl sm:text-4xl font-display font-bold text-primary-600 text-center"
      aria-live="polite"
      aria-atomic="true"
    >
      {formatCounterDisplay(displayCount, lang)}
    </div>
  );
}
