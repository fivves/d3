import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import confetti from 'canvas-confetti';
import dayjs from 'dayjs';

export function Log() {
  const [used, setUsed] = useState<boolean | null>(null);
  const [context, setContext] = useState('social');
  const [paid, setPaid] = useState<'yes'|'no'>('no');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [already, setAlready] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/logs/today', { params: { date: dayjs().format('YYYY-MM-DD') } });
        setAlready(!!data.log);
      } catch {}
    })();
    const id = window.setTimeout(() => setAlready(false), Math.max(0, dayjs().add(1,'day').startOf('day').diff(dayjs())));
    return () => clearTimeout(id);
  }, []);

  function fireConfetti() {
    confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
  }

  async function submitNo() {
    setErr(''); setMsg('');
    try {
      await api.post('/logs/daily', { used: false });
      fireConfetti();
      setMsg('Logged clean day! +10 points');
    } catch (e:any) {
      setErr(e?.response?.data?.error || 'Failed to log');
    }
  }

  async function submitYes() {
    setErr(''); setMsg('');
    try {
      await api.post('/logs/daily', {
        used: true,
        context,
        paid: paid === 'yes',
        amountCents: paid === 'yes' ? Math.round((Number(amount)||0)*100) : undefined
      });
      setMsg('Logged use day. −20 points');
    } catch (e:any) {
      setErr(e?.response?.data?.error || 'Failed to log');
    }
  }

  if (already) {
    return (
      <div className="card" style={{ textAlign:'center', borderStyle:'dashed' }}>
        <div className="card-title" style={{ justifyContent:'center' }}><span className="icon">🗓️</span>Daily Log</div>
        <div className="sub">You've already logged today. Come back tomorrow to submit a new log.</div>
      </div>
    );
  }

  if (used === null) {
    return (
      <div className="card gradient" style={{ textAlign:'center' }}>
        <div className="card-title" style={{ justifyContent:'center' }}><span className="icon">🗓️</span>Did you use today?</div>
        <div className="big-choices">
          <button className="big-choice primary" onClick={submitNo}>No</button>
          <button className="big-choice secondary" onClick={() => setUsed(true)}>Yes</button>
        </div>
        {msg && <div style={{ marginTop: 12 }}>{msg}</div>}
        {err && <div className="sub" style={{ color:'#f87171' }}>{err}</div>}
      </div>
    );
  }

  return (
    <div className="card fancy" style={{ maxWidth: 540 }}>
      <div className="card-title"><span className="icon">📝</span>Tell us more</div>
      <label>Context</label>
      <select value={context} onChange={(e)=>setContext(e.target.value)}>
        <option value="social">Social</option>
        <option value="medical">Medical</option>
      </select>
      <label>Did you pay for it?</label>
      <div className="row">
        <button className={`button ${paid==='no'?'':'secondary'}`} onClick={()=>setPaid('no')}>No</button>
        <button className={`button ${paid==='yes'?'':'secondary'}`} onClick={()=>setPaid('yes')}>Yes</button>
      </div>
      {paid==='yes' && (
        <>
          <label>How much did it cost? (USD)</label>
          <input inputMode="decimal" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="20" />
        </>
      )}
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button className="button" onClick={submitYes}>Submit</button>
        <button className="button secondary" onClick={()=>setUsed(null)}>Cancel</button>
      </div>
      {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
      {err && <div className="sub" style={{ color:'#f87171' }}>{err}</div>}
    </div>
  );
}


