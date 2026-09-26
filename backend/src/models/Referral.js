export const Referral = Object.freeze({
  table: 'referrals',
  pii: true,
  ddl: `
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      created_by TEXT NOT NULL,
      lead_type TEXT,
      location TEXT,
      property_type TEXT,
      budget_range TEXT,
      timeline TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_referrals_created_by ON referrals(created_by);
  `,
});
