import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAppStore } from '../store';

export function Account() {
  const { user, setAuth } = useAppStore();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [weeklySpend, setWeeklySpend] = useState(user ? String((user.weeklySpendCents||0)/100) : '');
  const [startDate, setStartDate] = useState(user?.startDate ? user.startDate.substring(0,10) : '');
  const [newPin, setNewPin] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setWeeklySpend(String((user.weeklySpendCents||0)/100));
    setStartDate(user.startDate ? user.startDate.substring(0,10) : '');
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    const form = new FormData();
    form.set('firstName', firstName);
    form.set('lastName', lastName);
    form.set('weeklySpendCents', String(Math.round((Number(weeklySpend)||0)*100)));
    if (startDate) form.set('startDate', startDate);
    if (newPin) form.set('newPin', newPin);
    if (avatar) form.set('avatar', avatar);
    try {
      const { data } = await api.put('/me', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAuth(localStorage.getItem('token') || '', data.user);
      setMsg('Saved');
    } catch (e:any) {
      setErr(e?.response?.data?.error || 'Failed to save');
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="heading">My Account</div>
      <form onSubmit={save}>
        <label>First name</label>
        <input value={firstName} onChange={(e)=>setFirstName(e.target.value)} />
        <label>Last name</label>
        <input value={lastName} onChange={(e)=>setLastName(e.target.value)} />
        <label>Weekly spend (USD)</label>
        <input inputMode="decimal" value={weeklySpend} onChange={(e)=>setWeeklySpend(e.target.value)} />
        <label>Start date</label>
        <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} />
        <label>Change PIN</label>
        <input inputMode="numeric" maxLength={4} value={newPin} onChange={(e)=>setNewPin(e.target.value)} placeholder="1234" />
        <label>Profile picture</label>
        <input type="file" accept="image/*" onChange={(e)=>setAvatar(e.target.files?.[0]||null)} />
        <button className="button" type="submit">Save</button>
        {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
        {err && <div className="sub" style={{ color:'#f87171' }}>{err}</div>}
      </form>
    </div>
  );
}


