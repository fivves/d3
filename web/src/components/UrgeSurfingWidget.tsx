import React, { useEffect, useMemo, useRef, useState } from 'react';

type UrgeSurfingWidgetProps = {
  initialMinutes?: number;
};

export default function UrgeSurfingWidget({ initialMinutes = 15 }: UrgeSurfingWidgetProps) {
  const totalMs = useMemo(() => initialMinutes * 60 * 1000, [initialMinutes]);
  const [remainingMs, setRemainingMs] = useState<number>(totalMs);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [breathMs, setBreathMs] = useState<number>(0); // 0..10000

  const intervalRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) return;

    const tick = (now: number) => {
      if (lastTickRef.current == null) {
        lastTickRef.current = now;
      }
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      setRemainingMs((prev) => {
        const next = Math.max(0, prev - delta);
        if (next <= 0) {
          setIsRunning(false);
        }
        return next;
      });

      setBreathMs((prev) => (prev + delta) % 10000); // 10s cycle
      intervalRef.current = window.requestAnimationFrame(tick);
    };

    intervalRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (intervalRef.current != null) {
        cancelAnimationFrame(intervalRef.current);
      }
      intervalRef.current = null;
      lastTickRef.current = null;
    };
  }, [isRunning]);

  const handleStart = () => {
    if (remainingMs <= 0) setRemainingMs(totalMs);
    setIsRunning(true);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingMs(totalMs);
    setBreathMs(0);
  };

  const mm = Math.floor(remainingMs / 60000)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor((remainingMs % 60000) / 1000)
    .toString()
    .padStart(2, '0');

  const phaseMs = breathMs % 10000; // 0..9999
  const isInhale = phaseMs < 4000; // 4s in, 6s out
  const phaseLabel = isInhale ? 'Inhale' : 'Exhale';

  const petals = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);

  return (
    <div className="urge-widget">
      <div className="timer-display" aria-live="polite">{mm}:{ss}</div>
      <div className="breath-label sub">{phaseLabel} 4–6</div>

      <div className={`breathe${isRunning ? '' : ' paused'}`} aria-hidden>
        {petals.map((p) => (
          <div
            key={p}
            className="petal"
            style={{ transform: `rotate(${p * 45}deg) translate(68px) scale(1)` }}
          />
        ))}
        <div className="petal center" />
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="button" onClick={handleStart} disabled={isRunning && remainingMs > 0}>
          {remainingMs <= 0 ? 'Restart 15:00' : 'Start 15:00'}
        </button>
        <button className="button secondary" onClick={handleReset}>Reset</button>
      </div>

      <div className="sub" style={{ textAlign: 'center' }}>
        Breathe slowly. Notice sensations rise and fall like a wave.
      </div>
    </div>
  );
}


