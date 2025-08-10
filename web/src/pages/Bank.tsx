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
      <div className="card">
        <div className="heading">Points Balance</div>
        <div className="row">
          <div className="pill">Balance: <b>{summary?.balance ?? 0}</b></div>
          <div className="pill">Earned: <b>{summary?.totals.earned ?? 0}</b></div>
          <div className="pill">Spent: <b>{summary?.totals.spent ?? 0}</b></div>
        </div>
        <div style={{ height: 12 }} />
        <div className="heading">Transactions</div>
        <div>
          {summary?.transactions.map(t => (
            <div key={t.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #222' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.type}</div>
                <div className="sub">{new Date(t.date).toLocaleString()} {t.note ? `• ${t.note}` : ''}</div>
              </div>
              <div style={{ fontWeight: 700, color: t.points >= 0 ? '#6ee7b7' : '#fda4af' }}>{t.points >= 0 ? `+${t.points}` : t.points}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="heading">Money Saved Log</div>
        <div className="row">
          <div className="pill">Saved: <b>${((money?.saved ?? 0)/100).toFixed(2)}</b></div>
          <div className="pill">Spent: <b>${((money?.spent ?? 0)/100).toFixed(2)}</b></div>
          <div className="pill">Net: <b>${((money?.net ?? 0)/100).toFixed(2)}</b></div>
        </div>
        <div style={{ height: 12 }} />
        <div className="heading">Entries</div>
        <div>
          {money?.events.map((e:any) => (
            <div key={e.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #222' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{e.type}</div>
                <div className="sub">{new Date(e.date).toLocaleString()} {e.note ? `• ${e.note}` : ''}</div>
              </div>
              <div style={{ fontWeight: 700, color: e.amountCents >= 0 ? '#6ee7b7' : '#fda4af' }}>{e.amountCents >= 0 ? `+$${(e.amountCents/100).toFixed(2)}` : `-$${(Math.abs(e.amountCents)/100).toFixed(2)}`}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


