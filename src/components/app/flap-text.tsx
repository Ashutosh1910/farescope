import { useEffect, useRef, useState } from 'react';

/**
 * Departure-board text: when the value changes, each character flips in, left to right.
 * The first render is static, and reduced-motion users get the plain swap (see index.css).
 */
export function FlapText({ text, className }: { text: string; className?: string }) {
  const first = useRef(true);
  const [gen, setGen] = useState(0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setGen((g) => g + 1);
  }, [text]);
  return (
    <span className={className} aria-label={text}>
      {[...text].map((c, i) => (
        <span key={`${gen}-${i}`} aria-hidden className={gen ? 'flap-char' : 'inline-block'} style={gen ? { animationDelay: `${i * 70}ms` } : undefined}>
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  );
}
