import { useState } from 'react';

export default function HomePhoto({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="home-photo home-photo--empty" role="img" aria-label="No photo for this home">
        <span>No photo</span>
      </div>
    );
  }
  return (
    <img
      className="home-photo"
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
