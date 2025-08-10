import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import api from '../lib/api';
import { useAppStore } from '../store';

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

export function Home() {
  const { user } = useAppStore();
  const [bank, setBank] = useState<{ balance: number; totals: { earned: number; spent: number } } | null>(null);
  const [savings, setSavings] = useState<{ net: number } | null>(null);
  const [quote, setQuote] = useState<{ text: string; author?: string | null } | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [b, s, q, l] = await Promise.all([
        api.get('/bank/summary'),
        api.get('/savings'),
        api.get('/motivation/random'),
        api.get('/logs')
      ]);
      setBank(b.data);
      setSavings(s.data);
      setQuote(q.data.quote);
      setLogs(l.data.logs);
    })();
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

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="hero" style={{ display:'flex', gap:16, alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:16, alignItems:'center' }}>
          <div className="icon-bubble" aria-hidden>{timeIcon()}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{greeting()} {user?.firstName}</div>
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
          <div className="sub" style={{ fontSize: 16 }}>{quote?.text}</div>
          {quote?.author && <div style={{ marginTop: 8, opacity:.8 }}>— {quote.author}</div>}
        </div>
      </div>
    </div>
  );
}


