'use client';

import { useEffect, useState } from 'react';

interface Strategy {
  id: string;
  name: string;
  profile_id: string;
  expiry_sec: number;
  is_default: boolean;
}

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [name, setName] = useState('');
  const [profileId, setProfileId] = useState('AD50');

  const headers = {
    'Content-Type': 'application/json',
    'x-mtb-api-key': process.env.NEXT_PUBLIC_MTB_API_KEY ?? '',
  };

  const load = () => {
    fetch('/api/strategies', { headers })
      .then((r) => r.json())
      .then((d) => setStrategies(d.strategies ?? []))
      .catch(() => setStrategies([]));
  };

  useEffect(load, []);

  const create = async () => {
    await fetch('/api/strategies', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, profileId, expirySec: 5 }),
    });
    setName('');
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/strategies?id=${id}`, { method: 'DELETE', headers });
    load();
  };

  const clone = async (s: Strategy) => {
    await fetch('/api/strategies', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `${s.name} Copy`,
        profileId: s.profile_id,
        expirySec: s.expiry_sec,
      }),
    });
    load();
  };

  return (
    <>
      <h2>Strategy Templates</h2>
      <div className="form-grid" style={{ marginBottom: '2rem' }}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Profile
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {['AD50', 'AD100', 'AD200', 'AD300', 'AD500', 'AD1000'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={create}>
          Create Template
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Profile</th>
            <th>Expiry</th>
            <th>Default</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.profile_id}</td>
              <td>{s.expiry_sec}s</td>
              <td>{s.is_default ? 'Yes' : 'No'}</td>
              <td>
                <button type="button" onClick={() => clone(s)} style={{ marginRight: '0.5rem' }}>
                  Clone
                </button>
                {!s.is_default && (
                  <button type="button" onClick={() => remove(s.id)}>
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
