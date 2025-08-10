import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import api from '../lib/api';
import { Link } from 'react-router-dom';

type TodayLog = {
  id: number;
  date: string;
  journal?: string | null;
  mood?: number | null;
};

function msUntilNextMidnight(): number {
  const next = dayjs().add(1, 'day').startOf('day');
  return Math.max(0, next.diff(dayjs(), 'millisecond'));
}

export default function DailyJournalWidget() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState<TodayLog | null>(null);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<number | ''>('');
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [buttonLabel, setButtonLabel] = useState<'Save' | 'Saving...' | 'Saved!' | 'Edit'>('Save');
  const labelTimerRef = useRef<number | null>(null);

  const dateLabel = useMemo(() => dayjs().format('ddd, MMM D'), []);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/journal/today');
        const log: TodayLog | null = data.log ? { ...data.log, date: data.log.date } : null;
        setToday(log);
        setText(log?.journal ?? '');
        setMood((log?.mood ?? '') as any);
        setError('');
        // If user already has content for today, show Edit state
        if ((log?.journal && log.journal.length > 0) || (typeof log?.mood === 'number')) {
          setButtonLabel('Edit');
        }
      } finally {
        setLoading(false);
      }
    }
    load();

    const timer = window.setTimeout(async () => {
      try {
        if (!locked) {
          // Auto-save before locking if there is content or mood
          const hasContent = (text.trim().length > 0) || (mood !== '' && mood != null);
          if (hasContent) {
            await api.put('/journal/today', { journal: text.trim() || null, mood: mood === '' ? null : Number(mood) });
          }
        }
      } catch (_) {
        // Ignore auto-save failure at midnight
      } finally {
        setLocked(true);
        setButtonLabel('Save');
      }
    }, msUntilNextMidnight());
    return () => clearTimeout(timer);
  }, []);

  async function save() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      setButtonLabel('Saving...');
      const { data } = await api.put('/journal/today', { journal: text.trim() || null, mood: mood === '' ? null : Number(mood) });
      setToday(data.log);
      setButtonLabel('Saved!');
      if (labelTimerRef.current) window.clearTimeout(labelTimerRef.current);
      labelTimerRef.current = window.setTimeout(() => {
        setButtonLabel('Edit');
      }, 3000) as unknown as number;
    } catch (e: any) {
      const errMsg = e?.response?.data?.error || 'Failed to save. If this is a new install, migrations may be pending.';
      setError(errMsg);
      setButtonLabel('Save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="card-title"><span className="icon">📓</span>Daily Log</div>
      <div className="sub" style={{ marginBottom: 10 }}>Edit your journal throughout the day. At midnight, it locks and is saved.</div>
      <div className="row" style={{ alignItems:'center', marginBottom: 8 }}>
        <div className="pill" aria-label="Today">{dateLabel}</div>
        <div className="spacer" />
        <Link className="button secondary" to="/journal">View all</Link>
      </div>
      <label>Mood</label>
      <div className="row" role="radiogroup" aria-label="Mood 1 to 5" style={{ marginBottom: 8 }}>
        {[1,2,3,4,5].map((n) => (
          <button
            key={n}
            className={`button ${mood === n ? '' : 'secondary'}`}
            onClick={() => !locked && setMood(n)}
            aria-pressed={mood === n}
          >{n}</button>
        ))}
      </div>
      <label>Journal</label>
      <textarea
        value={text}
        onChange={(e)=> setText(e.target.value)}
        placeholder="How are you feeling? What happened today?"
        disabled={locked}
        rows={6}
        style={{ width:'100%', resize:'vertical' }}
      />
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <button className="button" onClick={save} disabled={saving || locked}>{buttonLabel}</button>
        {locked && <div className="sub">Locked for today. Come back tomorrow.</div>}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <div className="pill">First journal entry today earns +1 point</div>
      </div>
      {message && <div style={{ marginTop:8 }}>{message}</div>}
      {error && <div className="sub" style={{ marginTop:4, color:'#f87171' }}>{error}</div>}
    </div>
  );
}


