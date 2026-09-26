export const WORKSPACE_KIND = Object.freeze({
  PRIMARY: 'primary',
  COLLABORATION: 'collaboration',
});

export const MEMBER_ROLE = Object.freeze({
  REALTOR: 'realtor',
  BUYER: 'buyer',
  FAMILY: 'family',
  CONTRACTOR: 'contractor',
});

export const Workspace = Object.freeze({
  table: 'workspaces',
  pii: false,
  ddl: `
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      property_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('primary', 'collaboration')),
      parent_workspace_id TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        (kind = 'primary' AND parent_workspace_id IS NULL)
        OR (kind = 'collaboration' AND parent_workspace_id IS NOT NULL)
      ),
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (parent_workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_workspaces_property ON workspaces(property_id);

    CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      member_role TEXT NOT NULL CHECK (member_role IN ('realtor', 'buyer', 'family', 'contractor')),
      created_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
  `,
});
