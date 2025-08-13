import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAppStore } from '../store';

export function Account() {
  const { user, setAuth } = useAppStore();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [weeklySpend, setWeeklySpend] = useState(user ? String((user.weeklySpendCents||0)/100) : '');
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
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    const form = new FormData();
    form.set('firstName', firstName);
    form.set('lastName', lastName);
    form.set('weeklySpendCents', String(Math.round((Number(weeklySpend)||0)*100)));
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
      {/* Left column: cleaner, smaller cards */}
      <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
        <div className="card fancy">
          <div className="card-title"><span className="icon">👤</span>Profile</div>
          <form onSubmit={save}>
            <label>First name</label>
            <input value={firstName} onChange={(e)=>setFirstName(e.target.value)} />
            <label>Last name</label>
            <input value={lastName} onChange={(e)=>setLastName(e.target.value)} />
            <label>Weekly spend (USD)</label>
            <input inputMode="decimal" value={weeklySpend} onChange={(e)=>setWeeklySpend(e.target.value)} />
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="button" type="submit">Save</button>
            </div>
            {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
            {err && <div className="sub" style={{ color:'#f87171' }}>{err}</div>}
          </form>
        </div>

        <div className="card fancy">
          <div className="card-title"><span className="icon">🔒</span>Security</div>
          <form onSubmit={save}>
            <label>Change PIN</label>
            <input inputMode="numeric" maxLength={4} value={newPin} onChange={(e)=>setNewPin(e.target.value)} placeholder="1234" />
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="button" type="submit">Update PIN</button>
            </div>
          </form>
        </div>

        <div className="card fancy">
          <div className="card-title"><span className="icon">🖼️</span>Avatar</div>
          <form onSubmit={save}>
            <label>Profile picture</label>
            <input type="file" accept="image/*" onChange={(e)=>setAvatar(e.target.files?.[0]||null)} />
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="button" type="submit">Upload</button>
            </div>
          </form>
        </div>
      </div>

      {/* Right column: tools */}
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
        {user?.isAdmin ? (
          <>
            <div className="card-title" style={{ marginTop: 8 }}><span className="icon">🛠️</span>Admin tools</div>
            <AdminTools />
            <div style={{ height: 16 }} />
            <div className="card-title" style={{ marginTop: 8 }}><span className="icon">⚠️</span>Danger zone</div>
          </>
        ) : (
          <div className="card-title" style={{ marginTop: 8 }}><span className="icon">⚠️</span>Danger zone</div>
        )}
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

function AdminTools() {
  const [users, setUsers] = useState<Array<{id:number; username:string|null; firstName:string; lastName:string; isAdmin:boolean; balance?:number}>>([]);
  const [err, setErr] = useState('');
  const [pin, setPin] = useState('');
  const [target, setTarget] = useState<number|''>('');
  const [busy, setBusy] = useState(false);
  const [editingBalance, setEditingBalance] = useState<Record<number, string>>({});
  const [fixDate, setFixDate] = useState('');
  const [fixUsed, setFixUsed] = useState<'clean'|'used'>('clean');
  const [fixPaid, setFixPaid] = useState<'yes'|'no'>('no');
  const [fixAmount, setFixAmount] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/admin/users');
        setUsers(data.users || []);
      } catch (e:any) {
        setErr(e?.response?.data?.error || 'Failed to load users');
      }
    })();
  }, []);

  async function resetPin() {
    setErr('');
    if (!target) return;
    try {
      await api.post(`/admin/users/${target}/reset-pin`, { newPin: pin });
      setPin('');
      alert('PIN updated');
    } catch (e:any) {
      setErr(e?.response?.data?.error || 'Failed to reset PIN');
    }
  }

  async function deleteUser(id: number) {
    if (!confirm('Permanently delete this user and all their data? This cannot be undone.')) return;
    setBusy(true); setErr('');
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(users.filter(u => u.id !== id));
      if (target === id) setTarget('');
    } catch (e:any) {
      setErr(e?.response?.data?.error || 'Failed to delete user');
    } finally {
      setBusy(false);
    }
  }

  async function applyPoints(uId: number) {
    const raw = editingBalance[uId];
    if (raw == null || raw.trim() === '') return;
    const desired = Number(raw);
    if (!Number.isFinite(desired)) {
      setErr('Points must be a valid number');
      return;
    }
    setBusy(true); setErr('');
    try {
      const { data } = await api.post(`/admin/users/${uId}/set-points`, { points: desired });
      setUsers(users.map(u => u.id === uId ? { ...u, balance: data.balance } : u));
    } catch (e:any) {
      setErr(e?.response?.data?.error || 'Failed to set points');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="sub">User list</div>
      <div className="list" style={{ marginTop: 8 }}>
        {users.map(u => (
          <div key={u.id} className="list-item">
            <div className="left">
              <div style={{ fontWeight: 700 }}>{u.username || '(no username)'} {u.isAdmin && <span className="pill">admin</span>}</div>
              <div className="sub">{u.firstName} {u.lastName}</div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <div className="sub">Balance</div>
              <input
                inputMode="numeric"
                style={{ width: 100 }}
                placeholder={String(u.balance ?? 0)}
                value={editingBalance[u.id] ?? ''}
                onChange={(e)=>setEditingBalance(prev=>({ ...prev, [u.id]: e.target.value }))}
              />
              <button className="button" onClick={()=>applyPoints(u.id)} disabled={busy}>Set</button>
              <button className="button secondary" onClick={()=>deleteUser(u.id)} disabled={busy || u.isAdmin}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 12 }} />
      <div className="sub">Reset a user's PIN</div>
      <div className="row">
        <select value={target} onChange={(e)=>setTarget(Number(e.target.value))}>
          <option value="">Select user…</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.username || `${u.firstName} ${u.lastName}`}</option>)}
        </select>
        <input inputMode="numeric" maxLength={4} placeholder="1234" value={pin} onChange={(e)=>setPin(e.target.value)} />
        <button className="button" onClick={resetPin} disabled={!target || !pin}>Set PIN</button>
      </div>
      {err && <div className="sub" style={{ color:'#f87171' }}>{err}</div>}

      <div style={{ height: 16 }} />
      <div className="sub">Adjust user's daily log (fix streak)</div>
      <div className="row" style={{ gap:8, flexWrap:'wrap' }}>
        <select value={target} onChange={(e)=>setTarget(Number(e.target.value))}>
          <option value="">Select user…</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.username || `${u.firstName} ${u.lastName}`}</option>)}
        </select>
        <input type="date" value={fixDate} onChange={(e)=>setFixDate(e.target.value)} />
        <select value={fixUsed} onChange={(e)=>setFixUsed(e.target.value as any)}>
          <option value="clean">Mark clean</option>
          <option value="used">Mark used</option>
        </select>
        {fixUsed==='used' && (
          <>
            <select value={fixPaid} onChange={(e)=>setFixPaid(e.target.value as any)}>
              <option value="no">Unpaid</option>
              <option value="yes">Paid</option>
            </select>
            {fixPaid==='yes' && (
              <input inputMode="decimal" placeholder="Amount (USD)" value={fixAmount} onChange={(e)=>setFixAmount(e.target.value)} />
            )}
          </>
        )}
        <button
          className="button"
          disabled={!target || !fixDate || busy}
          onClick={async ()=>{
            setErr(''); setBusy(true);
            try {
              await api.post(`/admin/users/${target}/logs/set-used`, {
                date: fixDate,
                used: fixUsed==='used',
                paid: fixUsed==='used' ? (fixPaid==='yes') : undefined,
                amountCents: fixUsed==='used' && fixPaid==='yes' ? Math.round((Number(fixAmount)||0)*100) : undefined
              });
              alert('Daily log adjusted');
            } catch(e:any) {
              setErr(e?.response?.data?.error || 'Failed to adjust log');
            } finally { setBusy(false); }
          }}>Apply</button>
      </div>
    </div>
  );
}


