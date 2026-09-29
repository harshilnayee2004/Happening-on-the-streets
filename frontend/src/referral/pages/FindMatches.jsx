import { useEffect, useState } from 'react';
import Page from '../../shared/components/Page.jsx';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { referralLinks } from '../../shared/nav.js';

export default function FindMatches() {
  const [scope, setScope] = useState('network');
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState([]);
  const [leadId, setLeadId] = useState('');
  const [results, setResults] = useState([]);
  const [match, setMatch] = useState(null);
  const [unlockNote, setUnlockNote] = useState('');
  const [error, setError] = useState('');

  async function search(nextScope = scope) {
    await ensureGuest();
    const { data } = await api.get('/api/referral/search', { params: { scope: nextScope, q: query } });
    setResults(data.results);
  }

  useEffect(() => {
    ensureGuest()
      .then(() => api.get('/api/referral/leads'))
      .then(({ data }) => {
        setMine(data.referrals);
        if (data.referrals[0]) setLeadId(data.referrals[0].id);
      })
      .then(() => search('network'))
      .catch(() => setError('Referral search could not be loaded.'));
  }, []);

  async function explain(candidateId) {
    setUnlockNote('');
    try {
      const { data } = await api.post('/api/referral/match', { leadId, candidateId });
      setMatch(data.match);
    } catch {
      setError('That match could not be explained.');
    }
  }

  async function unlock() {
    try {
      await api.post('/api/referral/unlock', { candidateId: match?.candidate?.id });
    } catch (err) {
      const code = err.response?.data?.error;
      if (code === 'payment_not_implemented') {
        setUnlockNote('Unlock payment is not implemented. Contact stays locked.');
        return;
      }
      setError('Unlock is not available.');
    }
  }

  return (
    <Page
      eyebrow="Referral"
      title="Find matches"
      lede="Search your network first, then beyond it. Contact unlock is mocked as not implemented — no charge is taken."
      links={referralLinks}
    >
      <div className="compare-pickers">
        <label>
          Your lead
          <select value={leadId} onChange={(event) => setLeadId(event.target.value)}>
            {mine.map((lead) => (
              <option key={lead.id} value={lead.id}>{lead.location || lead.id}</option>
            ))}
          </select>
        </label>
        <label>
          Query
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Austin" />
        </label>
      </div>
      <p className="home-actions home-actions--row">
        <button type="button" className={scope === 'network' ? 'button' : 'button button--quiet'} onClick={() => { setScope('network'); search('network'); }}>
          Network
        </button>
        <button type="button" className={scope === 'beyond' ? 'button' : 'button button--quiet'} onClick={() => { setScope('beyond'); search('beyond'); }}>
          Beyond network
        </button>
      </p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <ul className="referral-results">
        {results.length === 0 ? <li className="muted">No public matches in this scope.</li> : null}
        {results.map((item) => (
          <li key={item.id}>
            <p><strong>{item.location || 'Location hidden'}</strong> · {item.propertyType || 'Any'} · {item.budgetRange || 'Budget locked'}</p>
            <p className="muted">Contact locked until payment exists.</p>
            <button type="button" className="button button--quiet" onClick={() => explain(item.id)}>Explain match</button>
          </li>
        ))}
      </ul>
      {match ? (
        <section className="insight-panel">
          <h3>Match {match.score}/100 · {match.scope}</h3>
          <ul>
            {match.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          <button type="button" className="button" onClick={unlock}>Unlock contact</button>
          {unlockNote ? <p className="muted">{unlockNote}</p> : null}
        </section>
      ) : null}
    </Page>
  );
}
