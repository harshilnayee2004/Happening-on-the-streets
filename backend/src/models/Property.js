export const Property = Object.freeze({
  table: 'properties',
  pii: false,
  ddl: `
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      title TEXT,
      listing_url TEXT,
      price_cents INTEGER,
      photo_urls TEXT,
      beds REAL,
      baths REAL,
      sqft INTEGER,
      latitude REAL,
      longitude REAL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
  `,
});
