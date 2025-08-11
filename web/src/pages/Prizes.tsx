import React, { useEffect, useRef, useState } from 'react';
import api from '../lib/api';

type Prize = { id:number; name:string; description?:string|null; costPoints:number; imageUrl?:string|null; active:boolean; purchases:any[] };

export function Prizes() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [bank, setBank] = useState<{ balance:number; totals:{ earned:number; spent:number } } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const hideToastTimerRef = useRef<number | null>(null);
  const [editing, setEditing] = useState<Prize | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editErr, setEditErr] = useState('');

  function showToast(msg: string) {
    // Clear any previous timers to avoid overlap
    if (hideToastTimerRef.current) {
      window.clearTimeout(hideToastTimerRef.current);
      hideToastTimerRef.current = null;
    }
    // Mount toast in hidden state first, then promote to visible on next frame
    setToast(msg);
    setToastVisible(false);
    requestAnimationFrame(() => {
      setToastVisible(true);
      hideToastTimerRef.current = window.setTimeout(() => {
        setToastVisible(false);
        // Wait for slide-down animation to finish before unmounting
        window.setTimeout(() => setToast(''), 300);
      }, 3000) as unknown as number;
    });
  }

  async function load() {
    const { data } = await api.get('/prizes');
    setPrizes(data.prizes);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/bank/summary');
        setBank(data);
      } catch {}
    })();
  }, []);

  async function addPrize(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    const form = new FormData();
    form.set('name', name);
    if (description) form.set('description', description);
    form.set('costPoints', String(Math.round(Number(cost)||0)));
    if (image) form.set('image', image, image.name || 'upload.jpg');
    try {
      await api.post('/prizes', form);
      setName(''); setDescription(''); setCost(''); setImage(null);
      await load();
    } catch (e:any) {
      setErr(e?.response?.data?.error || 'Failed to add prize');
    }
  }

  async function purchase(id:number) {
    setErr('');
    try {
      await api.post(`/prizes/${id}/purchase`);
      await load();
    } catch (e:any) {
      const msg = e?.response?.data?.error || 'Failed to purchase';
      if (String(msg).toLowerCase().includes('insufficient')) {
        showToast('Insufficient points');
      } else {
        setErr(msg);
      }
    }
  }

  function openEdit(p: Prize) {
    setEditErr('');
    setEditing(p);
    setEditName(p.name);
    setEditDescription(p.description || '');
    setEditCost(String(p.costPoints));
  }

  async function saveEdit() {
    if (!editing) return;
    setEditErr('');
    try {
      await api.put(`/prizes/${editing.id}`, {
        name: editName,
        description: editDescription,
        costPoints: Math.round(Number(editCost) || 0)
      });
      setEditing(null);
      await load();
    } catch (e:any) {
      setEditErr(e?.response?.data?.error || 'Failed to update prize');
    }
  }

  async function restock(id:number) {
    setErr('');
    try {
      await api.post(`/prizes/${id}/restock`);
      await load();
    } catch (e:any) {
      setErr(e?.response?.data?.error || 'Failed to restock');
    }
  }

  const available = prizes.filter(p => p.active);
  const purchased = prizes.filter(p => !p.active);

  async function removePrize(id:number) {
    setErr('');
    try {
      await api.delete(`/prizes/${id}`);
      await load();
    } catch (e:any) {
      setErr(e?.response?.data?.error || 'Failed to delete prize');
    }
  }

  return (
    <div className="grid prizes-layout">
      {/* Left column: stacked cards */}
      <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="card fancy">
          <div className="card-title"><span className="icon">🏆</span>Points</div>
          <div className="stats">
            <div><div className="stat-label">Balance</div><div className="stat-value">{bank?.balance ?? 0}</div></div>
            <div><div className="stat-label">Earned</div><div className="stat-value positive">{bank?.totals.earned ?? 0}</div></div>
            <div><div className="stat-label">Spent</div><div className="stat-value negative">{bank?.totals.spent ?? 0}</div></div>
          </div>
        </div>
        <div className="card fancy">
          <div
            className="card-title"
            style={{ justifyContent:'space-between', cursor:'pointer' }}
            role="button"
            tabIndex={0}
            aria-expanded={addOpen}
            aria-controls="add-prize-panel"
            onClick={() => setAddOpen(o => !o)}
            onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAddOpen(o => !o); } }}
          >
            <span style={{ display:'flex', alignItems:'center', gap:8 }}><span className="icon">🎁</span>Add New Prize</span>
            <span aria-hidden>{addOpen ? '▾' : '▸'}</span>
          </div>
          {addOpen && (
            <div id="add-prize-panel">
              <form onSubmit={addPrize}>
                <label>Name</label>
                <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Massage" />
                <label>Description</label>
                <input value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="60 minute massage" />
                <label>Cost (points)</label>
                <input inputMode="numeric" value={cost} onChange={(e)=>setCost(e.target.value)} placeholder="200" />
                <label>Image</label>
                <input type="file" accept="image/*" onChange={(e)=>setImage(e.target.files?.[0]||null)} />
                <button className="button" type="submit">Add prize</button>
                {err && <div className="sub" style={{ color:'#f87171' }}>{err}</div>}
              </form>
            </div>
          )}
        </div>
        <div className="card fancy" style={{ display:'flex', flexDirection:'column' }}>
          <div
            className="card-title"
            style={{ justifyContent:'space-between', cursor:'pointer' }}
            role="button"
            tabIndex={0}
            aria-expanded={purchasesOpen}
            aria-controls="purchases-panel"
            onClick={() => setPurchasesOpen(o => !o)}
            onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPurchasesOpen(o => !o); } }}
          >
            <span style={{ display:'flex', alignItems:'center', gap:8 }}><span className="icon">✅</span>Purchases</span>
            <span aria-hidden>{purchasesOpen ? '▾' : '▸'}</span>
          </div>
          {purchasesOpen && (
            <div id="purchases-panel" style={{ flex:1, display:'flex' }}>
              {purchased.length === 0 ? (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div className="card" style={{ textAlign:'center' }}>
                    <div className="sub">No purchases yet. Purchase some to view them here.</div>
                  </div>
                </div>
              ) : (
                <div className="grid" style={{ width:'100%' }}>
                  {purchased.map(p => (
                    <div key={p.id} className="card">
                      {p.imageUrl && <img src={p.imageUrl} style={{ width:'100%', height:140, objectFit:'cover', borderRadius:12, marginBottom:8 }} />}
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div className="sub">{p.description}</div>
                      <button className="button secondary" onClick={()=>restock(p.id)}>Replace with new copy</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right column: available prizes, full height */}
      <div className="card gradient" style={{ display:'flex', flexDirection:'column', minHeight: 320 }}>
        <div className="card-title"><span className="icon">🛒</span>Available</div>
        <div style={{ flex:1, display:'flex' }}>
          {available.length === 0 ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div className="card" style={{ textAlign:'center' }}>
                <div className="sub">No prizes available. Add some to view them here.</div>
              </div>
            </div>
          ) : (
            <div className="grid" style={{ width:'100%' }}>
              {available.map(p => (
              <div key={p.id} className="card" style={{ position: 'relative' }}>
                  <button
                    onClick={()=>removePrize(p.id)}
                    title="Delete prize"
                    style={{ position:'absolute', top:8, right:8, background:'transparent', border:'none', color:'#f87171', cursor:'pointer' }}
                    aria-label={`Delete ${p.name}`}
                  >🗑️</button>
                  {p.imageUrl && <img src={p.imageUrl} style={{ width:'100%', height:140, objectFit:'cover', borderRadius:12, marginBottom:8 }} />}
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div className="sub">{p.description}</div>
                  <div className="pill" style={{ margin:'8px 0' }}>Cost: <b>{p.costPoints}</b></div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="button" onClick={()=>purchase(p.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M7 4h-2l-1 2h-2v2h2l3.6 7.59-1.35 2.44c-.16.28-.25.61-.25.97a2 2 0 1 0 2-2h6a2 2 0 1 0 2 2h2v-2h-2l-1-2h-8.1l.9-1.6h6.7c.75 0 1.41-.41 1.75-1.03l3.58-6.48-1.74-.97-3.58 6.48h-7.17l-1.1-2h9.85v-2h-11z"/>
                    </svg>
                    <span style={{ marginLeft:6 }}>Buy</span>
                  </button>
                  <button className="button secondary" title="Edit" aria-label={`Edit ${p.name}`} onClick={()=>openEdit(p)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33l-.84-.84 9.9-9.9.84.84-9.9 9.9zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                  </button>
                </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(toast || toastVisible) && (
        <div className="toast-container" role="status" aria-live="polite">
          <div className={`toast danger ${toastVisible ? 'show' : 'hide'}`}>{toast}</div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-title">Edit prize</div>
            <label>Name</label>
            <input value={editName} onChange={(e)=>setEditName(e.target.value)} />
            <label>Description</label>
            <input value={editDescription} onChange={(e)=>setEditDescription(e.target.value)} />
            <label>Cost (points)</label>
            <input inputMode="numeric" value={editCost} onChange={(e)=>setEditCost(e.target.value)} />
            {editErr && <div className="sub" style={{ color:'#f87171' }}>{editErr}</div>}
            <div className="modal-actions">
              <button className="button secondary" onClick={()=>setEditing(null)}>Cancel</button>
              <button className="button" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


