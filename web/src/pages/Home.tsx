import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import api from '../lib/api';
import { useAppStore } from '../store';
import { Link } from 'react-router-dom';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeIcon() {
  const h = new Date().getHours();
  if (h < 12) return '🌅';
  if (h < 18) return '🌤️';
  return '🌙';
}

function todayKey(): string {
  return dayjs().format('YYYY-MM-DD');
}

function msUntilNextMidnight(): number {
  const next = dayjs().add(1, 'day').startOf('day');
  return Math.max(0, next.diff(dayjs(), 'millisecond'));
}

export function Home() {
  const { user } = useAppStore();
  const [bank, setBank] = useState<{ balance: number; totals: { earned: number; spent: number } } | null>(null);
  const [savings, setSavings] = useState<{ net: number } | null>(null);
  const [quotes, setQuotes] = useState<{ text: string; author?: string | null }[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [journal, setJournal] = useState<{ journal?: string | null; mood?: number | null } | null>(null);
  const [mioProgress, setMioProgress] = useState<{ done: number; total: number }>({ done: 0, total: 6 });
  const moodValue: number | null = typeof journal?.mood === 'number' ? (journal!.mood as number) : null;

  useEffect(() => {
    (async () => {
      const [b, s, qs, l, j] = await Promise.all([
        api.get('/bank/summary'),
        api.get('/savings'),
        api.get('/motivation/quotes'),
        api.get('/logs'),
        api.get('/journal/today')
      ]);
      setBank(b.data);
      setSavings(s.data);
      setQuotes(qs.data.quotes || []);
      setLogs(l.data.logs);
      setJournal(j.data.log || null);
    })();

    async function computeMioFromApi() {
      try {
        const { data } = await api.get('/motivation/checklist/status');
        const arr = Array.isArray(data.checked) ? (data.checked as boolean[]) : [];
        const done = arr.filter(Boolean).length;
        setMioProgress({ done, total: arr.length || 6 });
      } catch {
        setMioProgress({ done: 0, total: 6 });
      }
    }
    computeMioFromApi();
    const timer = window.setTimeout(() => {
      computeMioFromApi();
    }, msUntilNextMidnight());
    return () => clearTimeout(timer);
  }, [user?.username, user?.id]);

  // Single source of truth: clean start timestamp
  const cleanStartAt = useMemo(() => {
    const usedLogs = (logs || []).filter((l:any) => l.used);
    if (usedLogs.length > 0) {
      // Most recent use by when it was logged (createdAt). Fall back to date if needed.
      const latest = [...usedLogs].sort((a:any,b:any)=> new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())[0];
      return dayjs(latest.createdAt || latest.date);
    }
    // No use logs yet: start from setup completion
    return user?.startDate ? dayjs(user.startDate) : null;
  }, [logs, user?.startDate]);

  // Streak = full days since cleanStartAt
  const streak = useMemo(() => {
    if (!cleanStartAt) return 0;
    return dayjs().startOf('day').diff(cleanStartAt.startOf('day'), 'day');
  }, [cleanStartAt]);

  const daysClean = useMemo(() => {
    const start = user?.startDate ? dayjs(user.startDate) : null;
    if (!start) return 0;
    return dayjs().startOf('day').diff(start.startOf('day'), 'day');
  }, [user]);

  // Live count-up timer from last use (resets on use day)
  const [now, setNow] = useState(dayjs());
  useEffect(() => {
    const id = window.setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(id);
  }, []);

  
  const elapsed = useMemo(() => {
    if (!cleanStartAt) return null;
    const diffMs = Math.max(0, now.diff(cleanStartAt));
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
  }, [now, cleanStartAt]);

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="hero home-hero">
        <div className="left">
          {user?.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt="avatar"
              className="avatar-glow"
              style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }}
            />
          )}
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{greeting()} {user?.firstName}</div>
            <div className="sub">Every choice counts. Keep stacking wins.</div>
          </div>
        </div>
        <div className="right">
          <span className="clean-label">CLEAN FOR</span>
          {elapsed ? (
            <div className="time-clean compact">
              <div className="time-part"><span className="time-num">{elapsed.days}</span><span className="time-label">d</span></div>
              <div className="time-part"><span className="time-num">{String(elapsed.hours).padStart(2,'0')}</span><span className="time-label">h</span></div>
              <div className="time-part"><span className="time-num">{String(elapsed.minutes).padStart(2,'0')}</span><span className="time-label">m</span></div>
              <div className="time-part"><span className="time-num">{String(elapsed.seconds).padStart(2,'0')}</span><span className="time-label">s</span></div>
            </div>
          ) : (
            <div className="sub">—</div>
          )}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        
        <div className="card fancy">
          <div className="card-title"><span className="icon">🏆</span>Points</div>
          <div className="stats">
            <div><div className="stat-label">Balance</div><div className="stat-value">{bank?.balance ?? 0}</div></div>
            <div><div className="stat-label">Earned</div><div className="stat-value positive">{bank?.totals.earned ?? 0}</div></div>
            <div><div className="stat-label">Spent</div><div className="stat-value negative">{bank?.totals.spent ?? 0}</div></div>
          </div>
        </div>

        <div className="card fancy">
          <div className="card-title"><span className="icon">🔥</span>Streak</div>
          <div className="stats">
            <div><div className="stat-label">Current</div><div className="stat-value">{streak} d</div></div>
            <div><div className="stat-label">Since start</div><div className="stat-value">{daysClean} d</div></div>
            <div><div className="stat-label">Longest</div><div className="stat-value">{user?.longestStreakDays ?? 0} d</div></div>
          </div>
        </div>

        <div className="card fancy">
          <div className="card-title"><span className="icon">💰</span>Savings</div>
          <div className="stats">
            <div><div className="stat-label">Net saved</div><div className="stat-value positive">${((savings?.net ?? 0)/100).toFixed(2)}</div></div>
          </div>
        </div>

        <div className="card gradient" style={{ display:'flex', flexDirection:'column', minHeight: 180 }}>
          <div className="card-title"><span className="icon">💡</span>Motivation</div>
          <div className="sub" style={{ fontSize: 16 }}>{quotes[0]?.text}</div>
          {quotes[0]?.author && <div style={{ marginTop: 8, opacity:.8 }}>— {quotes[0].author}</div>}
        </div>
      </div>

      {/* At-a-glance widgets */}
      <div className="grid">
        <div className="card gradient" style={{ display:'flex', flexDirection:'column', minHeight: 180 }}>
          <div className="card-title" style={{ justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span className="icon">📓</span>Today’s Journal
            </div>
            {moodValue !== null && (
              <div className="mood-chip" aria-label={`Mood ${moodValue} out of 5`}>
                <span className="mood-label">Mood</span>
                <div className="mood-dots">
                  {[1,2,3,4,5].map((n) => (
                    <span key={n} className={`dot ${moodValue >= n ? 'on' : ''}`} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ flex:1 }}>
            {journal ? (
              <>
                {journal.journal ? (
                  <div className="sub truncate" style={{ marginTop: 8 }}>{journal.journal}</div>
                ) : (
                  <div className="sub">No entry yet.</div>
                )}
              </>
            ) : (
              <div className="sub">No entry yet.</div>
            )}
          </div>
          <div className="card-cta">
            <Link className="button" to="/motivation">Edit</Link>
            <Link className="button secondary" to="/journal" style={{ marginLeft: 8 }}>View all</Link>
          </div>
        </div>

        <div className="card gradient" style={{ display: 'flex', flexDirection: 'column', minHeight: 180 }}>
          <div>
            <div className="card-title"><span className="icon">👀</span>Make it Obvious</div>
            <div className="sub">{mioProgress.done}/{mioProgress.total} completed today</div>
          </div>
          <div className="card-cta"><Link className="button" to="/motivation">Continue checklist</Link></div>
        </div>

        <div className="card gradient" style={{ display: 'flex', flexDirection: 'column', minHeight: 180 }}>
          <div>
            <div className="card-title"><span className="icon">🌊</span>Urge Surfing</div>
            <div className="sub">Cravings rise and fall like waves. Ride one for 15 minutes.</div>
          </div>
          <div className="card-cta"><Link className="button" to="/motivation">Start surfing</Link></div>
        </div>
      </div>
    </div>
  );
}


