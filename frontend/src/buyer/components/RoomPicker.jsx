import { ROOM_OPTIONS, roomLabel } from '../rooms.js';

export default function RoomPicker({ value, onChange, id }) {
  return (
    <label className="room-tag">
      <span className="visually-hidden">Tag this photo</span>
      <select
        id={id}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Tag a room</option>
        {ROOM_OPTIONS.map(([slug, label]) => (
          <option key={slug} value={slug}>{label}</option>
        ))}
      </select>
      {value ? <span className="room-tag-name">{roomLabel(value)}</span> : null}
    </label>
  );
}
