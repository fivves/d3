import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAppStore } from '../store';

export function App() {
  const navigate = useNavigate();
  const { token, user, setAuth, clearAuth } = useAppStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSetup() {
      try {
        const { data } = await api.get('/setup/status');
        if (!data.initialized) {
          navigate('/setup');
          return;
        }
        if (!data.hasPin && !token) {
          const { data: unlocked } = await api.post('/auth/unlocked');
          setAuth(unlocked.token, unlocked.user);
          return;
        }
        if (token && !user) {
          const me = await api.get('/me');
          setAuth(token, me.data.user);
        }
      } catch (_) {
        // ignore
      } finally {
        setChecking(false);
      }
    }
    checkSetup();
  }, [token, user, navigate, setAuth]);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', { pin });
      setAuth(data.token, data.user);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed');
    }
  }

  function logout() {
    clearAuth();
  }

  if (checking) return null;

  if (!user) {
    return (
      <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
        <h1 style={{ marginBottom: 8 }}>Enter PIN</h1>
        <p className="sub" style={{ marginBottom: 16 }}>This app is protected by a 4‑digit PIN.</p>
        <form onSubmit={login}>
          <label>PIN</label>
          <input inputMode="numeric" pattern="\\d{4}" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="1234" />
          {error && <div className="sub" style={{ color: '#f87171' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="button" type="submit">Unlock</button>
            <button className="button secondary" type="button" onClick={() => navigate('/setup')}>First time setup</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <nav className="navbar">
        <div style={{ fontWeight: 800 }}>D3</div>
        <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/">Home</NavLink>
        <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/log">Log</NavLink>
        <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/bank">Bank</NavLink>
        <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/prizes">Prizes</NavLink>
        <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/motivation">Motivation</NavLink>
        <div className="spacer" />
        <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/account">My Account</NavLink>
        <button className="button secondary" onClick={logout}>Lock</button>
      </nav>
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}


