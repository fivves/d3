import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import confetti from 'canvas-confetti';
import api from '../lib/api';

type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  category: 'Environment' | 'Nutrition' | 'Sleep' | 'Social' | 'Mind' | 'Music';
  icon: string;
};

const DEFAULT_ITEMS: ChecklistItem[] = [
  {
    id: 'env-water-visible',
    title: 'Water visible',
    description: 'Fill a water bottle and keep it in your line of sight.',
    category: 'Environment',
    icon: '💧',
  },
  {
    id: 'env-tidy-up',
    title: 'Tidy up',
    description: "Clean a part of the house, even though you don't have to.",
    category: 'Environment',
    icon: '🧹',
  },
  {
    id: 'nutrition-snack',
    title: 'Snack ready',
    description: 'Stage a quick snack for the next craving window.',
    category: 'Nutrition',
    icon: '🍳',
  },
  {
    id: 'sleep-winddown',
    title: 'Wind‑down anchor',
    description: 'Set a bedtime reminder and prep your wind‑down routine.',
    category: 'Sleep',
    icon: '🛌',
  },
  {
    id: 'social-checkin',
    title: 'Check‑in',
    description: 'Let a trusted person know you are doing well.',
    category: 'Social',
    icon: '💬',
  },
  {
    id: 'play-music',
    title: 'Play music',
    description: 'Play music to help you relax for 30 minutes.',
    category: 'Music',
    icon: '🎹',
  },
];

const STORAGE_KEYS = {
  date: 'mio:date',
  checked: 'mio:checked',
  scored: 'mio:scored', // '', 'complete', 'missed'
};

function todayKey(): string {
  return dayjs().format('YYYY-MM-DD');
}

function msUntilNextMidnight(): number {
  const next = dayjs().add(1, 'day').startOf('day');
  return Math.max(0, next.diff(dayjs(), 'millisecond'));
}

export default function MakeItObviousWidget() {
  const items = useMemo(() => DEFAULT_ITEMS, []);
  const [checked, setChecked] = useState<boolean[]>(() => {
    try {
      const storedDate = localStorage.getItem(STORAGE_KEYS.date);
      const stored = localStorage.getItem(STORAGE_KEYS.checked);
      if (storedDate === todayKey() && stored) {
        const arr = JSON.parse(stored) as boolean[];
        return items.map((_, i) => Boolean(arr[i]));
      }
    } catch {}
    return items.map(() => false);
  });
  const [scored, setScored] = useState<'complete' | 'missed' | ''>(() => {
    try {
      const storedDate = localStorage.getItem(STORAGE_KEYS.date);
      const s = localStorage.getItem(STORAGE_KEYS.scored) as any;
      if (storedDate === todayKey() && (s === 'complete' || s === 'missed')) return s;
    } catch {}
    return '';
  });

  const allDone = checked.every(Boolean);

  useEffect(() => {
    // Persist for today
    localStorage.setItem(STORAGE_KEYS.date, todayKey());
    localStorage.setItem(STORAGE_KEYS.checked, JSON.stringify(checked));
  }, [checked]);

  useEffect(() => {
    // Award points once when all tasks are complete
    async function awardIfNeeded() {
      if (allDone && scored !== 'complete') {
        try {
          await api.post('/motivation/checklist/score', { status: 'complete', date: todayKey() });
          setScored('complete');
          localStorage.setItem(STORAGE_KEYS.scored, 'complete');
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        } catch (e) {
          // ignore silently for now
        }
      }
    }
    awardIfNeeded();
  }, [allDone, scored]);

  useEffect(() => {
    // On mount, if stored date is yesterday and not complete, mark missed
    async function handleMissedIfNeeded() {
      try {
        const storedDate = localStorage.getItem(STORAGE_KEYS.date);
        const storedScored = localStorage.getItem(STORAGE_KEYS.scored);
        if (!storedDate) return;
        const isToday = storedDate === todayKey();
        if (isToday) return; // nothing to do

        // We are on a new day. If previous day not completed and not scored, deduct 5.
        const prevAllDone = (JSON.parse(localStorage.getItem(STORAGE_KEYS.checked) || '[]') as boolean[]).every(Boolean);
        if (!prevAllDone && storedScored !== 'missed') {
          await api.post('/motivation/checklist/score', { status: 'missed', date: storedDate });
        }

        // Reset for today
        localStorage.setItem(STORAGE_KEYS.date, todayKey());
        localStorage.setItem(STORAGE_KEYS.checked, JSON.stringify(items.map(() => false)));
        localStorage.setItem(STORAGE_KEYS.scored, '');
        setChecked(items.map(() => false));
        setScored('');
      } catch {}
    }
    handleMissedIfNeeded();

    const timer = window.setTimeout(() => {
      // Midnight rollover: if not complete yet and not scored missed, score missed then reset
      (async () => {
        try {
          const storedScored = localStorage.getItem(STORAGE_KEYS.scored);
          if (!allDone && storedScored !== 'missed') {
            await api.post('/motivation/checklist/score', { status: 'missed', date: todayKey() });
          }
        } catch {}
        // Reset
        localStorage.setItem(STORAGE_KEYS.date, todayKey());
        localStorage.setItem(STORAGE_KEYS.checked, JSON.stringify(items.map(() => false)));
        localStorage.setItem(STORAGE_KEYS.scored, '');
        setChecked(items.map(() => false));
        setScored('');
      })();
    }, msUntilNextMidnight());
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(idx: number) {
    setChecked((prev) => {
      const next = prev.slice();
      next[idx] = !next[idx];
      if (next[idx]) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
      }
      return next;
    });
  }

  return (
    <div>
      <div className="card-title"><span className="icon">👀</span>Make it Obvious</div>
      <div className="sub" style={{ marginBottom: 8 }}>Daily checklist resets at midnight. Complete all to earn +1 point.</div>
      <div className="list">
        {items.map((it, idx) => (
          <div key={it.id} className="list-item">
            <div className="left">
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className="icon" aria-hidden>{it.icon}</span>
                <b>{it.title}</b>
                <span className="badge">{it.category}</span>
              </div>
              <div className="sub">{it.description}</div>
            </div>
            <div>
              <input
                type="checkbox"
                checked={checked[idx]}
                onChange={() => toggle(idx)}
                aria-label={`Mark ${it.title} as done`}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'center' }}>
        <div className="pill">{allDone ? 'All done! +1 point will be awarded' : 'Complete all to earn +1 point'}</div>
      </div>
    </div>
  );
}
