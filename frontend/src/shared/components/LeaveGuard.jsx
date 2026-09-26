import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { isOpenHousePath } from '../nav.js';
import { useGuestWorkspace } from '../guestWorkspace.jsx';

export default function LeaveGuard() {
  const { properties } = useGuestWorkspace();
  const stayRef = useRef(null);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    properties.length > 0
    && isOpenHousePath(currentLocation.pathname)
    && !isOpenHousePath(nextLocation.pathname)
  ));

  useEffect(() => {
    if (blocker.state === 'blocked') stayRef.current?.focus();
  }, [blocker.state]);

  if (blocker.state !== 'blocked') return null;

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="save-workspace-title">
        <h2 id="save-workspace-title">Save this workspace</h2>
        <p>
          These homes stay on this browser while you are a guest. An account is how you keep the workspace when you leave.
        </p>
        <div className="dialog-actions">
          <button ref={stayRef} type="button" onClick={() => blocker.reset()}>
            Stay
          </button>
          <button className="secondary" type="button" onClick={() => blocker.proceed()}>
            Leave anyway
          </button>
        </div>
      </div>
    </div>
  );
}
