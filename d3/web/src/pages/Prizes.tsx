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
    if (image) form.set('image', image);
    try {
      await api.post('/prizes', form, { headers: { 'Content-Type': 'multipart/form-data' } });
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

  return (
    <div className="grid">
      <div className="card">
        <div className="heading">Add New Prize</div>
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

      <div className="card">
        <div className="heading">Available</div>
        <div className="grid">
          {available.map(p => (
            <div key={p.id} className="card">
              {p.imageUrl && <img src={p.imageUrl} style={{ width:'100%', height:140, objectFit:'cover', borderRadius:12, marginBottom:8 }} />}
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div className="sub">{p.description}</div>
              <div className="pill" style={{ margin:'8px 0' }}>Cost: <b>{p.costPoints}</b></div>
              <button className="button" onClick={()=>purchase(p.id)}>Buy</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="heading">Purchases</div>
        <div className="grid">
          {purchased.map(p => (
            <div key={p.id} className="card">
              {p.imageUrl && <img src={p.imageUrl} style={{ width:'100%', height:140, objectFit:'cover', borderRadius:12, marginBottom:8 }} />}
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div className="sub">{p.description}</div>
              <button className="button secondary" onClick={()=>restock(p.id)}>Replace with new copy</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


