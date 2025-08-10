import React, { useEffect, useState } from 'react';
import api from '../lib/api';

type Prize = { id:number; name:string; description?:string|null; costPoints:number; imageUrl?:string|null; active:boolean; purchases:any[] };

export function Prizes() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    const { data } = await api.get('/prizes');
    setPrizes(data.prizes);
  }

  useEffect(() => { load(); }, []);

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
      setErr(e?.response?.data?.error || 'Failed to purchase');
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
    <div className="grid">
      <div className="card fancy">
        <div className="card-title"><span className="icon">🎁</span>Add New Prize</div>
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

      <div className="card gradient">
        <div className="card-title"><span className="icon">🛒</span>Available</div>
        <div className="grid">
          {available.length === 0 ? (
            <div className="card" style={{ textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', minHeight: 140 }}>
              <div className="sub">No prizes available. Add some to view them here.</div>
            </div>
          ) : (
            available.map(p => (
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
                <button className="button" onClick={()=>purchase(p.id)}>Buy</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card fancy">
        <div className="card-title"><span className="icon">✅</span>Purchases</div>
        <div className="grid">
          {purchased.length === 0 ? (
            <div className="card" style={{ textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', minHeight: 140 }}>
              <div className="sub">No purchases yet. Purchase some to view them here.</div>
            </div>
          ) : (
            purchased.map(p => (
              <div key={p.id} className="card">
                {p.imageUrl && <img src={p.imageUrl} style={{ width:'100%', height:140, objectFit:'cover', borderRadius:12, marginBottom:8 }} />}
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div className="sub">{p.description}</div>
                <button className="button secondary" onClick={()=>restock(p.id)}>Replace with new copy</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


