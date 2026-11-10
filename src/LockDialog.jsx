import { useEffect, useState } from "react";

// Asks what to do with unsaved notes (new-note draft, offline edits not yet
// uploaded to S3) when locking. Calls `onDecision({ decision, remember })`
// with decision "discard" or "keep", or `onCancel()`.
export function LockDialog({ hasDraft, unsyncedKeys, onDecision, onCancel }) {
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    const onKeyDown = (ev) => {
      if (ev.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="lock-dialog">
      <div role="dialog" aria-modal="true" aria-labelledby="lock-dialog-title">
        <h2 id="lock-dialog-title">Discard unsaved notes?</h2>
        <p>These notes haven't been saved to your S3 bucket yet:</p>
        <ul>
          {hasDraft && <li>an unsaved new note</li>}
          {unsyncedKeys.map((key) => (
            <li key={key}>{key.replace(/^\/+/, "")} (offline edit)</li>
          ))}
        </ul>
        <p>
          If you keep them, they stay unencrypted in this browser while the
          editor is locked. If you discard them, they are deleted permanently.
        </p>
        <label>
          <input
            type="checkbox"
            checked={remember}
            onChange={(ev) => setRemember(ev.target.checked)}
          />
          Remember my decision
        </label>
        <div className="buttons">
          <button type="button" autoFocus={true} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDecision({ decision: "keep", remember })}
          >
            Keep them
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => onDecision({ decision: "discard", remember })}
          >
            Yes, discard them
          </button>
        </div>
      </div>
    </div>
  );
}
