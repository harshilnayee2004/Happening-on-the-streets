export const Showcase = Object.freeze({
  table: 'showcases',
  pii: false,
  ddl: `
    CREATE TABLE IF NOT EXISTS showcases (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL UNIQUE,
      model_url TEXT,
      latitude REAL,
      longitude REAL,
      rotation REAL,
      scale REAL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS access_grants (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `,
});
