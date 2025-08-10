import React, { useEffect, useState } from 'react';
import api from '../lib/api';

export function Motivation() {
  const [quotes, setQuotes] = useState<{ text:string; author?:string|null }[]>([]);

  useEffect(() => {
    api.get('/motivation/quotes').then(({ data }) => setQuotes(data.quotes));
  }, []);

  return (
    <div className="grid">
      <div className="card">
        <div className="heading">Science‑based tools</div>
        <ul>
          <li><b>Urge Surfing</b>: Cravings rise and fall like waves in ~10–20 minutes. Set a timer, breathe slowly (4s in, 6s out), and observe sensations without judgment until the wave passes.</li>
          <li><b>Implementation Intentions</b>: If‑Then plans reduce friction. Example: “If it’s 8pm and a craving hits, then I will make tea and take a 10‑minute walk.”</li>
          <li><b>Make It Obvious/Easy</b>: Remove triggers; stage your environment for success (water, protein snack, bedtime routine).</li>
          <li><b>Dopamine Menu</b>: Keep a list of healthy quick hits (cold shower, 20 pushups, 10 min walk, text a friend) to replace the habit loop.</li>
          <li><b>Accountability</b>: Tell one trusted person your streak goal for this week and text them after you log each day.</li>
          <li><b>Sleep + Exercise</b>: 7–9h sleep and 20–30 min zone‑2 daily stabilize mood and cravings.</li>
        </ul>
      </div>
      <div className="card">
        <div className="heading">Quotes</div>
        <div className="grid">
          {quotes.map((q, i) => (
            <div key={i} className="card">
              <div className="sub">{q.text}</div>
              {q.author && <div style={{ marginTop: 6 }}>— {q.author}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


