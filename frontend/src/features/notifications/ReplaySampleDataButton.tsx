import { useEffect, useState } from 'react';
import { Button } from '../../components/Button.tsx';
import { useReplay } from './useReplay.ts';
import './ReplaySampleDataButton.scss';

const TOAST_DURATION_MS = 3000;

// Demo-only. This system has no live event stream — just the fixed
// data/events.jsonl sample — so there's no way to see a new or edited
// rule's effect without re-processing that fixed history. That's a
// backfill-style operation, not something a real product would expose:
// in production a rule change just starts watching future events and
// open agent states immediately, with no replay step at all. Labeled
// explicitly so it doesn't read as "the normal way to save a rule."
export function ReplaySampleDataButton() {
  const replay = useReplay();
  const [showToast, setShowToast] = useState(false);

  // The result is shown as a floating toast (absolutely positioned, see
  // .scss), not appended inline — appending it as a normal flex item
  // wrapped onto a new line and pushed the whole page below it down every
  // time you clicked replay.
  useEffect(() => {
    if (replay.status !== 'success' && replay.status !== 'error') return;
    setShowToast(true);
    const timer = setTimeout(() => setShowToast(false), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [replay.status, replay.submittedAt]);

  return (
    <div className="replay-sample-data">
      <div className="replay-sample-data__trigger">
        <Button type="button" onClick={() => replay.mutate()} disabled={replay.isPending}>
          {replay.isPending ? 'Replaying…' : 'Replay sample data'}
        </Button>
        {showToast && replay.isSuccess && (
          <p className="replay-sample-data__toast">{replay.data.notificationCount} notification(s) fired</p>
        )}
        {showToast && replay.isError && (
          <p className="replay-sample-data__toast replay-sample-data__toast--error">Replay failed.</p>
        )}
      </div>
      <p className="replay-sample-data__caption">
        Demo only — re-runs <code>data/events.jsonl</code> against the current rules. A live system wouldn't need
        this; new rules just watch future events on their own.
      </p>
    </div>
  );
}
