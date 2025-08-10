import React, { useEffect, useState } from 'react';
import api from '../lib/api';

type Tx = { id:number; date:string; points:number; type:string; note?:string|null };

export function Bank() {
  const [summary, setSummary] = useState<{ balance:number; totals:{ earned:number; spent:number }; transactions:Tx[] } | null>(null);
  const [money, setMoney] = useState<{ saved:number; spent:number; net:number; events:any[] } | null>(null);

  useEffect(() => {
    (async () => {
      const [b, m] = await Promise.all([ api.get('/bank/summary'), api.get('/savings') ]);
      setSummary(b.data);
      setMoney(m.data);
    })();
  }, []);

  return (
    <div className="grid">
      <div className="card fancy">
        <div className="card-title"><span className="icon">🏦</span>Points Balance</div>
        <div className="stats">
          <div><div className="stat-label">Balance</div><div className="stat-value">{summary?.balance ?? 0}</div></div>
          <div><div className="stat-label">Earned</div><div className="stat-value positive">{summary?.totals.earned ?? 0}</div></div>
          <div><div className="stat-label">Spent</div><div className="stat-value negative">{summary?.totals.spent ?? 0}</div></div>
        </div>
        <div style={{ height: 12 }} />
        <div className="card-title"><span className="icon">📄</span>Transactions</div>
        <div className="list">
          {summary?.transactions.map(t => (
            <div key={t.id} className="list-item">
              <div className="left">
                <div style={{ fontWeight: 600 }}>{t.type}</div>
                <div className="sub">{new Date(t.date).toLocaleString()} {t.note ? `• ${t.note}` : ''}</div>
              </div>
              <div className={`stat-value ${t.points >= 0 ? 'positive' : 'negative'}`}>{t.points >= 0 ? `+${t.points}` : t.points}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card gradient">
        <div className="card-title"><span className="icon">💵</span>Money Saved</div>
        <div className="stats">
          <div><div className="stat-label">Saved</div><div className="stat-value positive">${((money?.saved ?? 0)/100).toFixed(2)}</div></div>
          <div><div className="stat-label">Spent</div><div className="stat-value negative">${((money?.spent ?? 0)/100).toFixed(2)}</div></div>
          <div><div className="stat-label">Net</div><div className="stat-value">${((money?.net ?? 0)/100).toFixed(2)}</div></div>
        </div>
        <div style={{ height: 12 }} />
        <div className="card-title"><span className="icon">📄</span>Entries</div>
        <div className="list">
          {money?.events.map((e:any) => (
            <div key={e.id} className="list-item">
              <div className="left">
                <div style={{ fontWeight: 600 }}>{e.type}</div>
                <div className="sub">{new Date(e.date).toLocaleString()} {e.note ? `• ${e.note}` : ''}</div>
              </div>
              <div className={`stat-value ${e.amountCents >= 0 ? 'positive' : 'negative'}`}>{e.amountCents >= 0 ? `+$${(e.amountCents/100).toFixed(2)}` : `-$${(Math.abs(e.amountCents)/100).toFixed(2)}`}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


