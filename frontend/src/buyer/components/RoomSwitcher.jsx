import { useEffect, useRef } from 'react';
import { photoForRoom, ROOM_OPTIONS } from '../rooms.js';

const WORKSPACE_ROOMS = ROOM_OPTIONS.filter(([slug]) => (
  ['exterior', 'kitchen', 'living', 'dining', 'bedroom', 'bathroom', 'backyard', 'room'].includes(slug)
));

export default function RoomSwitcher({
  photos,
  labels,
  activeSlug,
  onPick,
  overlay = false,
}) {
  const tagged = new Set((labels || []).map((item) => item.room));
  const listRef = useRef(null);

  useEffect(() => {
    if (!overlay || !activeSlug) return;
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector(`[data-room="${activeSlug}"]`);
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [overlay, activeSlug, photos.length, labels.length]);

  const list = (
    <ul
      className="room-rail-list"
      ref={overlay ? listRef : undefined}
      {...(overlay ? { tabIndex: 0 } : {})}
    >
      {WORKSPACE_ROOMS.map(([slug, label]) => {
        const hasPhoto = tagged.has(slug) && Boolean(photoForRoom(photos, labels, slug));
        const isOn = activeSlug === slug;
        const chipClass = overlay ? 'room-seg' : 'room-chip';
        const stateClass = isOn ? 'is-on' : hasPhoto ? 'has-photo' : '';
        const mention = label.toLowerCase();
        return (
          <li key={slug}>
            <button
              type="button"
              data-room={slug}
              className={[chipClass, stateClass].filter(Boolean).join(' ')}
              aria-pressed={isOn}
              aria-label={`Show ${label} photo, same as @${mention} in chat`}
              onClick={() => onPick(slug)}
            >
              <span className={overlay ? 'room-seg-at' : 'room-chip-at'}>@</span>
              {overlay ? mention : label}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      className={overlay ? 'room-rail room-rail--overlay' : 'room-rail'}
      role="toolbar"
      aria-label="Jump to a room photo"
    >
      {overlay ? null : <p className="room-rail-hint">Rooms</p>}
      {overlay ? <div className="room-rail-scroll">{list}</div> : list}
    </div>
  );
}
