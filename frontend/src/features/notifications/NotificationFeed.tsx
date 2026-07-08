import { useViewingAs } from '../identity/useViewingAs.ts';
import { useNotificationFeed } from './useNotificationFeed.ts';
import { NotificationItem } from './NotificationItem.tsx';
import { ReplaySampleDataButton } from './ReplaySampleDataButton.tsx';
import './NotificationFeed.scss';

// Container: fetches/polls via useNotificationFeed, handles all three async
// states explicitly, and renders the presentational NotificationItem list.
// Business logic (severity, the "why" in message) is entirely the
// backend's — this component only renders what the API returns.
export function NotificationFeed() {
  const { currentIdentity } = useViewingAs();
  const query = useNotificationFeed(currentIdentity?.id);

  return (
    <section className="notification-feed" aria-label="Notifications">
      <div className="notification-feed__header">
        <div>
          <h2 className="notification-feed__title">Notifications</h2>
          {query.status === 'success' && (
            <span className="notification-feed__count">
              {query.data.length} fired{currentIdentity ? ` for ${currentIdentity.displayName}` : ''}
            </span>
          )}
        </div>
        <ReplaySampleDataButton />
      </div>

      {query.status === 'pending' && <p className="notification-feed__state">Loading notifications…</p>}

      {query.status === 'error' && (
        <div className="notification-feed__state notification-feed__state--error">
          <p>Couldn't load notifications.</p>
          <button type="button" onClick={() => query.refetch()}>
            Retry
          </button>
        </div>
      )}

      {query.status === 'success' &&
        (query.data.length === 0 ? (
          <p className="notification-feed__state">No notifications yet.</p>
        ) : (
          <ul className="notification-feed__list">
            {query.data.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </ul>
        ))}
    </section>
  );
}
