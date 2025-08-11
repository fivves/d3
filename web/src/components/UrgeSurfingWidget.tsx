import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';
import confetti from 'canvas-confetti';

type UrgeSurfingWidgetProps = {
  initialMinutes?: number;
};

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function msUntilNextMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, +next - +now);
}

// Deprecated local storage keys (kept for graceful migration)
const STORAGE_KEYS = {
  date: 'urge:date',
  count: 'urge:count',
  scored: 'urge:scored',
};

export default function UrgeSurfingWidget({ initialMinutes = 1 }: UrgeSurfingWidgetProps) {
  const totalMs = useMemo(() => initialMinutes * 60 * 1000, [initialMinutes]);
  const [remainingMs, setRemainingMs] = useState<number>(totalMs);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [breathMs, setBreathMs] = useState<number>(0); // 0..10000
  const [breatheKey, setBreatheKey] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [scored, setScored] = useState<boolean>(false);

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

  // Load today's status from API and set midnight rollover just to refetch UI
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/motivation/breath/status');
        setCount(data.count || 0);
        setScored(!!data.scored);
      } catch {}
    })();
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const { data } = await api.get('/motivation/breath/status');
          setCount(data.count || 0);
          setScored(!!data.scored);
        } catch {}
      })();
    }, msUntilNextMidnight());
    return () => clearTimeout(timer);
  }, []);

  const handlePrimary = () => {
    // Finished → restart fresh and start running
    if (remainingMs <= 0) {
      setRemainingMs(totalMs);
      setBreathMs(0);
      setBreatheKey((k) => k + 1); // reset animation to initial state
      setIsRunning(true);
      return;
    }

    // Toggle pause/resume
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRemainingMs(totalMs);
    setBreathMs(0);
    setBreatheKey((k) => k + 1); // force re-mount to reset CSS animation and phase
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

  useEffect(() => {
    if (remainingMs <= 0 && !isRunning && totalMs > 0) {
      // Completed a 1-min session
      (async () => {
        try {
          const { data } = await api.post('/motivation/breath/record');
          setCount(data.count || 0);
          setScored(!!data.scored);
          if (data.awarded) {
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
          }
        } catch {}
      })();
      // Reset timer to ready state after completion
      setRemainingMs(totalMs);
      setBreathMs(0);
      setBreatheKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, isRunning]);

  return (
    <div className="urge-widget">
      <div className="timer-display" aria-live="polite">{mm}:{ss}</div>
      <div className="breath-label sub">{phaseLabel} 4–6</div>

      <div key={breatheKey} className={`breathe${isRunning ? '' : ' paused'}`} aria-hidden>
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
        <button className="button" onClick={handlePrimary}>
          {remainingMs <= 0
            ? 'Restart 1:00'
            : isRunning
            ? 'Pause'
            : remainingMs === totalMs
            ? 'Start 1:00'
            : 'Resume'}
        </button>
        <button className="button secondary" onClick={handleReset}>Reset</button>
      </div>

      <div className="sub" style={{ textAlign: 'center' }}>
        Breathe slowly. Notice sensations rise and fall like a wave.
      </div>
 
      <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'center', alignItems:'center' }}>
        <div className="pill">1‑min sessions today: <b>{Math.min(count, 3)}</b>/3</div>
        <div className="pill">Earn +1 at 3/day</div>
      </div>
    </div>
  );
}


