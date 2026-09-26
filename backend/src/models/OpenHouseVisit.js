export const OpenHouseVisit = Object.freeze({
  table: 'open_house_visits',
  pii: true,
  ddl: `
    CREATE TABLE IF NOT EXISTS open_house_visits (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      UNIQUE (property_id, created_by)
    );
    CREATE INDEX IF NOT EXISTS idx_open_house_visits_actor ON open_house_visits(created_by, created_at);
    CREATE TABLE IF NOT EXISTS open_house_notes (
      id TEXT PRIMARY KEY,
      visit_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (visit_id) REFERENCES open_house_visits(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_open_house_notes_visit ON open_house_notes(visit_id, created_at);
    CREATE TABLE IF NOT EXISTS open_house_photos (
      id TEXT PRIMARY KEY,
      visit_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      content_type TEXT NOT NULL,
      image BLOB NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (visit_id) REFERENCES open_house_visits(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_open_house_photos_visit ON open_house_photos(visit_id, created_at);
  `,
});
