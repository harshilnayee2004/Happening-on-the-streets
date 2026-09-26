export const VISIBILITY = Object.freeze({
  PRIVATE: 'private',
  FAMILY: 'family',
  REALTOR: 'realtor',
  SHARED: 'shared',
  EVERYONE: 'everyone',
});

export const DEFAULT_VISIBILITY = VISIBILITY.PRIVATE;

export const WorkspaceItem = Object.freeze({
  table: 'workspace_items',
  pii: true,
  ddl: `
    CREATE TABLE IF NOT EXISTS workspace_items (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      kind TEXT NOT NULL,
      body TEXT,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (
        visibility IN ('private', 'family', 'realtor', 'shared', 'everyone')
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_workspace_items_workspace ON workspace_items(workspace_id);

    CREATE TABLE IF NOT EXISTS workspace_item_shares (
      item_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (item_id, user_id),
      FOREIGN KEY (item_id) REFERENCES workspace_items(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `,
});
