export const ROOM_SLUGS = new Set([
  'room', 'kitchen', 'living', 'dining', 'bedroom', 'bathroom', 'office',
  'garage', 'backyard', 'patio', 'basement', 'attic', 'laundry', 'foyer',
  'hallway', 'exterior',
]);

const MENTION = /@([a-z][a-z0-9-]{0,31})/gi;
const CONCERN = /\b(need|must|can't|cannot|won't|wont|have to|deal-?breaker|won't compromise)\b/i;

export function extractMentions(text) {
  const found = [];
  for (const match of String(text || '').matchAll(MENTION)) {
    const slug = match[1].toLowerCase();
    if (ROOM_SLUGS.has(slug)) found.push(slug);
  }
  return found;
}

export function mostCommon(items) {
  const counts = new Map();
  for (const item of items) {
    if (!item) continue;
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  let value = null;
  let count = 0;
  for (const [key, total] of counts) {
    if (total > count) {
      value = key;
      count = total;
    }
  }
  return { value, count };
}

export function durationSeconds(startedAt, endedAt) {
  const start = Date.parse(startedAt);
  const end = Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 1000);
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds} sec`;
}

export function assignVisitorSlots(people) {
  const ordered = [...people]
    .filter((person) => person.role !== 'realtor')
    .sort((a, b) => String(a.firstSeen).localeCompare(String(b.firstSeen)));
  const labels = new Map();
  let visitorNumber = 0;
  let lastVisitor = '';
  for (const person of ordered) {
    if (person.role === 'family' && lastVisitor) {
      labels.set(person.userId, `${lastVisitor}'s guest`);
    } else {
      visitorNumber += 1;
      lastVisitor = `Visitor ${visitorNumber}`;
      labels.set(person.userId, lastVisitor);
    }
  }
  return labels;
}

export function inferConcerns(texts) {
  return texts
    .map((text) => String(text || '').trim())
    .filter((text) => text.length > 0 && CONCERN.test(text));
}

export function buildFiveQuestions({
  activity,
  messages,
  notes,
  slots,
  roles,
}) {
  const nonHost = activity.filter((row) => roles.get(row.userId) !== 'realtor');
  const ranked = [...nonHost].sort((a, b) => b.score - a.score);
  const leader = ranked[0];
  const decisionMaker = leader
    ? {
      answer: slots.get(leader.userId) || 'A buyer in the workspace',
      basis: `Based on ${leader.messages} chat messages, ${leader.photos} photos, and ${leader.notes} notes`,
    }
    : {
      answer: 'Not enough buyer activity yet',
      basis: 'Based on 0 buyer messages, photos, or notes',
    };

  const mentionPool = messages.flatMap((message) => extractMentions(message.body).map((room) => ({
    room,
    userId: message.authorId,
  })));
  const network = [];
  const seenRoles = new Set();
  for (const [userId, role] of roles) {
    if (role === 'realtor' || seenRoles.has(role)) continue;
    const theirs = mentionPool.filter((item) => item.userId === userId).map((item) => item.room);
    const top = mostCommon(theirs);
    const count = activity.find((row) => row.userId === userId)?.messages || 0;
    network.push({
      role,
      topic: top.value,
      basis: top.value
        ? `Based on ${top.count} messages tagged @${top.value}`
        : `Based on ${count} messages with no @room tag`,
    });
    seenRoles.add(role);
  }

  const concernTexts = inferConcerns([
    ...messages.map((message) => message.body),
    ...notes.map((note) => note.body),
  ]);
  const nonNegotiables = concernTexts.length > 0
    ? {
      answer: concernTexts[0],
      basis: `Inferred from ${concernTexts.length} message${concernTexts.length === 1 ? '' : 's'} or notes containing need/must/can't — not a confirmed pin`,
    }
    : {
      answer: 'No inferred non-negotiables yet',
      basis: 'No messages or notes matched the need/must/can\'t heuristic',
    };

  const lastNote = [...notes].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).at(-1);
  const lastMessage = messages.at(-1);
  const obstacle = lastNote
    ? {
      answer: lastNote.roomLabel
        ? `Open note on ${lastNote.roomLabel}`
        : 'Open note with no reply thread',
      basis: `Based on the latest note at ${lastNote.createdAt}, with no note-reply mechanism`,
    }
    : lastMessage
      ? {
        answer: extractMentions(lastMessage.body)[0]
          ? `Conversation last pointed at @${extractMentions(lastMessage.body)[0]}`
          : 'Latest chat has no follow-up from the other party',
        basis: `Based on the last of ${messages.length} chat messages`,
      }
      : {
        answer: 'No obstacle signal yet',
        basis: 'No notes or chat to measure a reply gap',
      };

  let ball = {
    answer: 'No one has the ball yet',
    basis: 'Based on 0 chat messages',
  };
  if (lastMessage) {
    const lastRole = roles.get(lastMessage.authorId) || 'buyer';
    const waiting = lastRole === 'realtor' ? 'A buyer' : 'The realtor';
    const sent = slots.get(lastMessage.authorId) || (lastRole === 'realtor' ? 'The realtor' : 'A buyer');
    ball = {
      answer: `${waiting} has the ball`,
      basis: `Based on the last message from ${sent}; no reply after that`,
    };
  }

  return {
    decisionMaker,
    networkDiscussion: {
      answer: network.length > 0
        ? network.map((item) => `${item.role}${item.topic ? ` · @${item.topic}` : ''}`).join('; ')
        : 'No buyer network activity yet',
      basis: network[0]?.basis || 'Based on 0 @room-tagged messages',
      parties: network,
    },
    nonNegotiables,
    mainObstacle: obstacle,
    whoHasTheBall: ball,
  };
}

export function assertNoContactFields(value, path = 'root') {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoContactFields(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (
      lower === 'name'
      || lower === 'displayname'
      || lower === 'phone'
      || lower === 'email'
      || lower === 'contact'
      || lower === 'profilebackground'
    ) {
      throw new Error(`contact field ${key} at ${path}`);
    }
    assertNoContactFields(child, `${path}.${key}`);
  }
}
