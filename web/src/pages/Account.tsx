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
  const [resetConfirm, setResetConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoreErr, setRestoreErr] = useState('');

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
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      {/* Left: Profile & preferences */}
      <div className="card fancy">
        <div className="card-title"><span className="icon">👤</span>My Account</div>
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
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button className="button" type="submit">Save</button>
          </div>
          {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
          {err && <div className="sub" style={{ color:'#f87171' }}>{err}</div>}
        </form>
      </div>

      {/* Right: Backup/Restore and Danger Zone */}
      <div className="card fancy">
        <div className="card-title"><span className="icon">💾</span>Backup & Restore</div>
        <div className="row" style={{ gap:8, flexWrap:'wrap' }}>
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true); setErr('');
              try {
                const { data } = await api.get('/admin/backup');
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'd3-backup.json'; a.click();
                URL.revokeObjectURL(url);
                setMsg('Backup downloaded');
              } catch (e:any) {
                setErr(e?.response?.data?.error || 'Failed to backup');
              } finally {
                setBusy(false);
              }
            }}
          >Download backup</button>
          <label className="button secondary" style={{ display:'inline-flex', alignItems:'center', gap:8, cursor:'pointer' }}>
            <input
              type="file"
              accept="application/json"
              style={{ display:'none' }}
              onChange={async (e) => {
                setRestoreErr(''); setErr(''); setMsg('');
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setBusy(true);
                  const text = await file.text();
                  const json = JSON.parse(text);
                  await api.post('/admin/restore', json, { headers: { 'Content-Type': 'application/json' } });
                  setMsg('Restore complete');
                } catch (ex:any) {
                  setRestoreErr(ex?.response?.data?.error || 'Failed to restore. Ensure this is a valid backup file.');
                } finally {
                  setBusy(false);
                  e.currentTarget.value = '';
                }
              }}
            />
            Restore from file
          </label>
        </div>
        {restoreErr && <div className="sub" style={{ color:'#f87171' }}>{restoreErr}</div>}

        <div style={{ height: 16 }} />
        <div className="card-title" style={{ marginTop: 8 }}><span className="icon">⚠️</span>Danger zone</div>
        <div className="sub">Resetting will erase your user, logs, points, prizes, and savings. This cannot be undone.</div>
        <div style={{ marginTop: 8 }}>
          <label>Type "RESET" to confirm</label>
          <input value={resetConfirm} onChange={(e)=>setResetConfirm(e.target.value)} placeholder="RESET" />
        </div>
        <button
          className="button secondary"
          style={{ background: '#7f1d1d', marginTop:8 }}
          disabled={resetConfirm !== 'RESET'}
          onClick={async () => {
            if (resetConfirm !== 'RESET') return;
            try {
              await api.post('/admin/reset');
              localStorage.removeItem('token');
              window.location.href = '/setup';
            } catch (e:any) {
              setErr(e?.response?.data?.error || 'Failed to reset');
            }
          }}
        >Reset database</button>
      </div>
    </div>
  );
}


