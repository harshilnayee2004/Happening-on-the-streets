export const WORKSPACE_EVENT_TYPE = Object.freeze({
  VISIT: 'visit',
  DURATION_TICK: 'duration_tick',
  INVITE: 'invite',
  PHOTO_CAPTURED: 'photo_captured',
  VIDEO_CAPTURED: 'video_captured',
  ROOM_ENTERED: 'room_entered',
  MODEL_3D_INTERACTION: 'model_3d_interaction',
  CHAT_MESSAGE: 'chat_message',
  READINESS_OVERRIDE: 'readiness_override',
});

export const WorkspaceEvent = Object.freeze({
  table: 'workspace_events',
  pii: false,
  ddl: `
    CREATE TABLE IF NOT EXISTS workspace_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL CHECK (event_type IN (
        'visit',
        'duration_tick',
        'invite',
        'photo_captured',
        'video_captured',
        'room_entered',
        'model_3d_interaction',
        'chat_message',
        'readiness_override'
      )),
      workspace_id TEXT NOT NULL,
      property_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      room_label TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (actor_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_workspace_events_workspace ON workspace_events(workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_workspace_events_type ON workspace_events(event_type, created_at);
  `,
});
