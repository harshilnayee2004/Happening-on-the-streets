export const REALTOR_TIER = Object.freeze({
  FREE: 'free',
  PRO: 'pro',
  PREMIUM: 'premium',
});

export const RealtorAccount = Object.freeze({
  table: 'realtor_accounts',
  pii: false,
  ddl: `
    CREATE TABLE IF NOT EXISTS realtor_accounts (
      user_id TEXT PRIMARY KEY,
      tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'premium')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `,
});
