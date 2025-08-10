import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAppStore } from '../store';

export function Setup() {
  const navigate = useNavigate();
  const { setAuth } = useAppStore();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pin, setPin] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [startDate, setStartDate] = useState('');
  const [weeklySpend, setWeeklySpend] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/setup/status').then(({ data }) => {
      if (data.initialized) navigate('/');
    });
  }, [navigate]);

  function next() { setStep((s) => s + 1); }
  function back() { setStep((s) => Math.max(0, s - 1)); }

  async function finish() {
    setError('');
    const form = new FormData();
    form.set('firstName', firstName);
    form.set('lastName', lastName);
    if (pin) form.set('pin', pin);
    if (avatar) form.set('avatar', avatar);
    if (startDate) form.set('startDate', startDate);
    form.set('weeklySpendCents', String(Math.round((Number(weeklySpend) || 0) * 100)));
    try {
      const { data } = await api.post('/setup', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAuth(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Setup failed');
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 40 }}>
      <div className="hero">
        <h1 style={{ margin: 0 }}>Welcome to D3</h1>
        <p className="sub">Let’s set up your account. You can change settings later.</p>
      </div>
      <div style={{ height: 16 }} />
      {step === 0 && (
        <div className="card">
          <div className="heading">Your Name</div>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>First name</label>
              <input value={firstName} onChange={(e)=>setFirstName(e.target.value)} placeholder="Eddie" />
            </div>
            <div style={{ flex: 1 }}>
              <label>Last name</label>
              <input value={lastName} onChange={(e)=>setLastName(e.target.value)} placeholder="Lucitt" />
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop: 12 }}>
            <button className="button" onClick={next} disabled={!firstName || !lastName}>Next</button>
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="card">
          <div className="heading">Set a 4‑digit PIN (optional)</div>
          <label>PIN</label>
          <input inputMode="numeric" maxLength={4} value={pin} onChange={(e)=>setPin(e.target.value)} placeholder="1234" />
          <div style={{ display:'flex', gap:8, marginTop: 12 }}>
            <button className="button secondary" onClick={back}>Back</button>
            <button className="button" onClick={next}>Next</button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="card">
          <div className="heading">Profile picture</div>
          <input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] || null)} />
          <div style={{ display:'flex', gap:8, marginTop: 12 }}>
            <button className="button secondary" onClick={back}>Back</button>
            <button className="button" onClick={next}>Next</button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="card">
          <div className="heading">Start date for quitting</div>
          <label>Start date</label>
          <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} />
          <div style={{ display:'flex', gap:8, marginTop: 12 }}>
            <button className="button secondary" onClick={back}>Back</button>
            <button className="button" onClick={next}>Next</button>
          </div>
        </div>
      )}
      {step === 4 && (
        <div className="card">
          <div className="heading">Weekly THC spend</div>
          <label>How much do you spend per week? (USD)</label>
          <input inputMode="decimal" value={weeklySpend} onChange={(e)=>setWeeklySpend(e.target.value)} placeholder="50" />
          <div style={{ display:'flex', gap:8, marginTop: 12 }}>
            <button className="button secondary" onClick={back}>Back</button>
            <button className="button" onClick={next} disabled={!weeklySpend}>Next</button>
          </div>
        </div>
      )}
      {step === 5 && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>Ready to begin?</h2>
          <p className="sub">You can change settings later in My Account.</p>
          {error && <div className="sub" style={{ color: '#f87171' }}>{error}</div>}
          <button className="button" onClick={finish}>Begin my journey</button>
        </div>
      )}
    </div>
  );
}


