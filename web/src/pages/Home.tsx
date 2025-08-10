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

    function computeMio() {
      try {
        const date = localStorage.getItem('mio:date');
        const raw = localStorage.getItem('mio:checked');
        if (date === todayKey() && raw) {
          const arr = JSON.parse(raw) as boolean[];
          const done = arr.filter(Boolean).length;
          setMioProgress({ done, total: arr.length || 6 });
          return;
        }
      } catch {}
      setMioProgress({ done: 0, total: 6 });
    }
    computeMio();
    const timer = window.setTimeout(() => {
      setMioProgress({ done: 0, total: 6 });
    }, msUntilNextMidnight());
    return () => clearTimeout(timer);
  }, []);

  const streak = useMemo(() => {
    // count consecutive non-used days from latest
    const sorted = [...logs].sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime());
    let count = 0;
    for (const log of sorted) {
      if (log.used) break;
      count += 1;
    }
    return count;
  }, [logs]);

  const daysClean = useMemo(() => {
    const start = user?.startDate ? dayjs(user.startDate) : null;
    if (!start) return 0;
    return dayjs().startOf('day').diff(start.startOf('day'), 'day');
  }, [user]);

  // Live count-up timer from startDate
  const [now, setNow] = useState(dayjs());
  useEffect(() => {
    const id = window.setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = useMemo(() => {
    if (!user?.startDate) return null;
    const start = dayjs(user.startDate);
    const diffMs = Math.max(0, now.diff(start));
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
  }, [now, user?.startDate]);

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="hero" style={{ display:'flex', gap:16, alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:16, alignItems:'center' }}>
          <div className="icon-bubble" aria-hidden>{timeIcon()}</div>
          <div>
            <div className="hero-row">
              <div style={{ fontSize: 22, fontWeight: 800 }}>{greeting()} {user?.firstName}</div>
              {elapsed && (
                <div className="time-clean compact">
                  <div className="time-part"><span className="time-num">{elapsed.days}</span><span className="time-label">d</span></div>
                  <div className="time-part"><span className="time-num">{String(elapsed.hours).padStart(2,'0')}</span><span className="time-label">h</span></div>
                  <div className="time-part"><span className="time-num">{String(elapsed.minutes).padStart(2,'0')}</span><span className="time-label">m</span></div>
                  <div className="time-part"><span className="time-num">{String(elapsed.seconds).padStart(2,'0')}</span><span className="time-label">s</span></div>
                </div>
              )}
            </div>
            <div className="sub">Every choice counts. Keep stacking wins.</div>
          </div>
        </div>
        {user?.avatarUrl && (
          <img
            src={user.avatarUrl}
            alt="avatar"
            className="avatar-glow"
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
          />
        )}
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
            <div><div className="stat-label">Current</div><div className="stat-value">{streak} days</div></div>
            <div><div className="stat-label">Since start</div><div className="stat-value">{daysClean} days</div></div>
          </div>
        </div>

        <div className="card fancy">
          <div className="card-title"><span className="icon">💰</span>Savings</div>
          <div className="stats">
            <div><div className="stat-label">Net saved</div><div className="stat-value positive">${((savings?.net ?? 0)/100).toFixed(2)}</div></div>
          </div>
        </div>

        <div className="card gradient">
          <div className="card-title"><span className="icon">💡</span>Motivation</div>
          <div className="sub" style={{ fontSize: 16 }}>{quotes[0]?.text}</div>
          {quotes[0]?.author && <div style={{ marginTop: 8, opacity:.8 }}>— {quotes[0].author}</div>}
        </div>
      </div>

      {/* At-a-glance widgets */}
      <div className="grid">
        <div className="card gradient">
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
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Link className="button" to="/motivation">Edit</Link>
            <Link className="button secondary" to="/journal">View all</Link>
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
          <div className="card-cta"><Link className="button" to="/motivation">Start 15‑min surf</Link></div>
        </div>
      </div>
    </div>
  );
}


