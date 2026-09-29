import { parseMentions, roomLabel } from '../rooms.js';

export default function ChatBody({ text, onMention }) {
  return (
    <p>
      {parseMentions(text).map((part, index) => {
        if (part.type !== 'mention') return <span key={index}>{part.value}</span>;
        return (
          <button
            key={index}
            type="button"
            className="mention"
            aria-label={`Show the ${roomLabel(part.value).toLowerCase()} photo`}
            onClick={() => onMention(part.value)}
          >
            @{roomLabel(part.value).toLowerCase()}
          </button>
        );
      })}
    </p>
  );
}
