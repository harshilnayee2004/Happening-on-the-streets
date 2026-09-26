export const OpenHouseAlbum = Object.freeze({
  table: 'open_house_albums',
  pii: true,
  ddl: `
    CREATE TABLE IF NOT EXISTS open_house_albums (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_open_house_albums_workspace ON open_house_albums(workspace_id);
  `,
});
