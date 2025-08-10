import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../lib/api';

type Log = {
  id: number;
  date: string;
  journal?: string | null;
  mood?: number | null;
};

export function Journal() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/journal');
        setLogs(data.logs || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ maxWidth: 760, margin:'0 auto' }}>
      <div className="card fancy" style={{ marginBottom: 16 }}>
        <div className="card-title"><span className="icon">📰</span>Daily Logs</div>
        <div className="sub">A minimal, beautiful stream of your days.</div>
      </div>

      {loading ? null : logs.length === 0 ? (
        <div className="card" style={{ textAlign:'center' }}>
          <div className="sub">No entries yet. Write your first one from the Motivation page.</div>
        </div>
      ) : (
        <div className="blog-list">
          {logs.map((l) => (
            <article key={l.id} className="blog-post">
              <header>
                <h2 className="blog-title">{dayjs(l.date).format('dddd, MMMM D, YYYY')}</h2>
                {typeof l.mood === 'number' && (
                  <div className="mood-badge" aria-label={`Mood ${l.mood} out of 5`}>Mood: {l.mood}/5</div>
                )}
              </header>
              {l.journal && <p className="blog-body">{l.journal}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}


