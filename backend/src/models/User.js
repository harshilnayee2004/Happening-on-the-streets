export const USER_KIND = Object.freeze({
  USER: 'user',
  GUEST: 'guest',
});

export const User = Object.freeze({
  table: 'users',
  pii: true,
  ddl: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      display_name TEXT,
      phone TEXT,
      kind TEXT NOT NULL CHECK (kind IN ('user', 'guest')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
});
