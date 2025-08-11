import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const pageTitle = useMemo(() => {
    const p = location.pathname;
    if (p === '/') return 'Home';
    if (p.startsWith('/motivation')) return 'Motivation';
    if (p.startsWith('/bank')) return 'Bank';
    if (p.startsWith('/prizes')) return 'Prizes';
    if (p.startsWith('/log')) return 'Log';
    if (p.startsWith('/account')) return 'My Account';
    if (p.startsWith('/journal')) return 'Journal';
    return '';
  }, [location.pathname]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', { username, pin });
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
        <h1 style={{ marginBottom: 8 }}>Sign in</h1>
        <p className="sub" style={{ marginBottom: 16 }}>Enter your username and 4‑digit PIN.</p>
        <form onSubmit={login}>
          <label>Username</label>
          <input
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            placeholder="eddie"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <label>PIN</label>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            title="Enter 4 digits"
            autoComplete="one-time-code"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
              setPin(digits);
            }}
            placeholder="1234"
          />
          {error && <div className="sub" style={{ color: '#f87171' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="button" type="submit">Unlock</button>
            <button className="button secondary" type="button" onClick={()=>navigate('/setup')}>Sign up</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <nav className={`navbar ${menuOpen ? 'open' : ''}`}>
        <NavLink to="/" style={{ display:'inline-flex', alignItems:'center' }}>
          <img src="/icons/logo.png" alt="D3" style={{ height: 28, width: 'auto' }} />
        </NavLink>
        <button className="hamburger" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </button>
        {pageTitle && <div className="nav-center" aria-current="page">{pageTitle}</div>}
        <div className="nav-links" onClick={() => setMenuOpen(false)}>
          <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/">Home</NavLink>
          <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/motivation">Motivation</NavLink>
          <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/bank">Bank</NavLink>
          <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/prizes">Prizes</NavLink>
          <div className="spacer" />
          <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/account">My Account</NavLink>
          <button className="button success" onClick={() => navigate('/log')}>Log</button>
          <button className="button secondary" onClick={logout}>Lock</button>
        </div>
      </nav>
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}


