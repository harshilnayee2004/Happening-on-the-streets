import { useEffect, useState } from 'react';
import Page from '../../shared/components/Page.jsx';
import { api } from '../../shared/api/client.js';
import { ensureGuest } from '../../shared/api/guestSession.js';
import { referralLinks } from '../../shared/nav.js';

export default function SubmitLead() {
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    await ensureGuest();
    const { data } = await api.get('/api/referral/leads');
    setLeads(data.referrals);
  }

  useEffect(() => {
    load().catch(() => setError('Your leads could not be loaded.'));
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await ensureGuest();
      const payload = {
        leadType: String(form.get('leadType') || '').trim() || null,
        location: String(form.get('location') || '').trim() || null,
        propertyType: String(form.get('propertyType') || '').trim() || null,
        budgetRange: String(form.get('budgetRange') || '').trim() || null,
        timeline: String(form.get('timeline') || '').trim() || null,
        contactName: String(form.get('contactName') || '').trim() || null,
        contactPhone: String(form.get('contactPhone') || '').trim() || null,
        contactEmail: String(form.get('contactEmail') || '').trim() || null,
      };
      await api.post('/api/referral/leads', payload);
      event.currentTarget.reset();
      await load();
    } catch (err) {
      const code = err.response?.data?.error;
      setError(code === 'invalid_input'
        ? 'Check the fields — one of them is too long or not valid.'
        : 'The lead could not be saved. Confirm the API is running on port 4000.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      eyebrow="Referral"
      title="Submit lead"
      lede="Submit a lead you cannot serve. Contact details stay with you until someone unlocks a match (payment is not implemented)."
      links={referralLinks}
    >
      <form className="referral-form" onSubmit={onSubmit}>
        <label>Lead type<input name="leadType" placeholder="Buyer" /></label>
        <label>Location<input name="location" placeholder="Austin TX" /></label>
        <label>Property type<input name="propertyType" placeholder="Single family" /></label>
        <label>Budget<input name="budgetRange" placeholder="600-800k" /></label>
        <label>Timeline<input name="timeline" placeholder="90 days" /></label>
        <label>Contact name<input name="contactName" /></label>
        <label>Phone<input name="contactPhone" /></label>
        <label>Email<input name="contactEmail" type="email" /></label>
        <button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Save lead'}</button>
      </form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <ul className="referral-mine">
        {leads.map((lead) => (
          <li key={lead.id}>
            <strong>{lead.location || 'No location'}</strong>
            <span>{lead.propertyType || 'Any type'} · {lead.budgetRange || 'No budget'}</span>
          </li>
        ))}
      </ul>
    </Page>
  );
}
