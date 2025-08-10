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
    <div className="grid">
      <div className="card">
        <div className="heading">{greeting()} {user?.firstName}</div>
        <div className="row" style={{ alignItems: 'center' }}>
          {user?.avatarUrl && <img src={user.avatarUrl} alt="avatar" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid #222' }} />}
          <div className="pill">Days clean: <b>{daysClean}</b></div>
          <div className="pill">Current streak: <b>{streak}</b></div>
        </div>
      </div>

      <div className="card">
        <div className="heading">Points</div>
        <div className="row">
          <div className="pill">Balance: <b>{bank?.balance ?? 0}</b></div>
          <div className="pill">Earned: <b>{bank?.totals.earned ?? 0}</b></div>
          <div className="pill">Spent: <b>{bank?.totals.spent ?? 0}</b></div>
        </div>
      </div>

      <div className="card">
        <div className="heading">Savings</div>
        <div className="pill">Net saved: <b>${((savings?.net ?? 0)/100).toFixed(2)}</b></div>
      </div>

      <div className="card">
        <div className="heading">Motivation</div>
        <div className="sub">{quote?.text}</div>
        {quote?.author && <div style={{ marginTop: 6 }}>— {quote.author}</div>}
      </div>
    </div>
  );
}


