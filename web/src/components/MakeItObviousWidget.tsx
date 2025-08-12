import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import confetti from 'canvas-confetti';
import api from '../lib/api';
import { useAppStore } from '../store';

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

function makeStorageKeys(username?: string | null, userId?: number) {
  const scope = (username && username.trim()) ? username.trim().toLowerCase() : (userId ? String(userId) : 'guest');
  return {
    date: `mio:${scope}:date`,
    checked: `mio:${scope}:checked`,
    scored: `mio:${scope}:scored`, // '', 'complete', 'missed'
  } as const;
}

function todayKey(): string {
  return dayjs().format('YYYY-MM-DD');
}

function msUntilNextMidnight(): number {
  const next = dayjs().add(1, 'day').startOf('day');
  return Math.max(0, next.diff(dayjs(), 'millisecond'));
}

export default function MakeItObviousWidget() {
  const { user } = useAppStore();
  const STORAGE_KEYS = useMemo(() => makeStorageKeys(user?.username, user?.id), [user?.username, user?.id]);
  const items = useMemo(() => DEFAULT_ITEMS, []);
  const [checked, setChecked] = useState<boolean[]>(items.map(() => false));
  const [scored, setScored] = useState<'complete' | 'missed' | ''>('');
  const [loaded, setLoaded] = useState(false);

  const allDone = checked.every(Boolean);

  useEffect(() => {
    if (!loaded) return;
    // Persist to API for today
    (async () => {
      try { await api.put(`/motivation/checklist/status?date=${todayKey()}` , { checked, scored: scored || null }); } catch {}
    })();
  }, [checked, scored, loaded]);

  useEffect(() => {
    // Award points once when all tasks are complete
    async function awardIfNeeded() {
      if (allDone && scored !== 'complete') {
        try {
          await api.post('/motivation/checklist/score', { status: 'complete', date: todayKey() });
          setScored('complete');
          try { await api.put(`/motivation/checklist/status?date=${todayKey()}`, { checked, scored: 'complete' }); } catch {}
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        } catch (e) {
          // ignore silently for now
        }
      }
    }
    awardIfNeeded();
  }, [allDone, scored]);

  useEffect(() => {
    // Initial sync from API
    async function syncFromApi() {
      try {
        const { data } = await api.get('/motivation/checklist/status', { params: { date: todayKey() } });
        const arr = Array.isArray(data.checked) ? data.checked : [];
        setChecked(items.map((_, i) => Boolean(arr[i])));
        setScored(data.scored === 'complete' || data.scored === 'missed' ? data.scored : '');
      } catch {}
      finally { setLoaded(true); }
    }
    syncFromApi();

    // Periodic poll to keep in sync across devices while visible
    const pollId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFromApi();
      }
    }, 15000);

    function onVisibility() {
      if (document.visibilityState === 'visible') syncFromApi();
    }
    document.addEventListener('visibilitychange', onVisibility);

    const timer = window.setTimeout(async () => {
      // Midnight rollover: if not complete yet and not scored missed, score missed then reset
      try {
        if (!allDone && scored !== 'missed') {
          await api.post('/motivation/checklist/score', { status: 'missed', date: todayKey() });
        }
      } catch {}
      setChecked(items.map(() => false));
      setScored('');
      try { await api.put(`/motivation/checklist/status?date=${todayKey()}`, { checked: items.map(() => false), scored: null }); } catch {}
    }, msUntilNextMidnight());
    return () => { clearTimeout(timer); clearInterval(pollId); document.removeEventListener('visibilitychange', onVisibility); };
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
      <div className="sub" style={{ marginBottom: 8 }}>Daily checklist resets at midnight.</div>
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
