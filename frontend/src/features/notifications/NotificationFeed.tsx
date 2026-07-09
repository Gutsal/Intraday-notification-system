import { useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewingAs } from '../identity/useViewingAs.ts';
import { useNotificationFeed } from './useNotificationFeed.ts';
import { NotificationItem } from './NotificationItem.tsx';
import { ReplaySampleDataButton } from './ReplaySampleDataButton.tsx';
import './NotificationFeed.scss';

// A row's real height varies with message length, so this is only a seed
// for the virtualizer's first pass — measureElement (below) corrects it
// against each row's actual rendered height once mounted.
const ESTIMATED_ROW_HEIGHT = 88;

// Container: fetches/polls via useNotificationFeed, handles all three async
// states explicitly, and renders the presentational NotificationItem list.
// Business logic (severity, the "why" in message) is entirely the
// backend's — this component only renders what the API returns.
//
// The list itself is virtualized (@tanstack/react-virtual): only rows near
// the viewport are ever mounted in the DOM, and older pages are fetched on
// demand as the virtual scroll position nears the end of what's loaded —
// see README's "FE performance" discussion for why this matters once a
// recipient's history stops being "a handful of demo notifications."
export function NotificationFeed() {
  const { currentIdentity } = useViewingAs();
  const query = useNotificationFeed(currentIdentity?.id);
  const scrollRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo(() => query.data?.pages.flatMap((page) => page.notifications) ?? [], [query.data]);

  // One extra virtual row past the loaded notifications doubles as the
  // "loading more…" sentinel while the next page is being fetched.
  const rowCount = notifications.length + (query.hasNextPage ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 6,
    // Stable per-notification keys, not positional index — polling can
    // prepend newer notifications ahead of what's already loaded, which
    // would otherwise shift every row's index out from under react-virtual's
    // measurement cache.
    getItemKey: (index) => notifications[index]?.id ?? `loading-more-${index}`,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualItem = virtualItems.at(-1);

  useEffect(() => {
    if (!lastVirtualItem) return;
    if (lastVirtualItem.index >= notifications.length - 1 && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
    // query itself is intentionally omitted — only its stable methods and
    // the two flags below should re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastVirtualItem, notifications.length, query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  return (
    <section className="notification-feed" aria-label="Notifications">
      <div className="notification-feed__header">
        <div>
          <h2 className="notification-feed__title">Notifications</h2>
          {query.status === 'success' && (
            <span className="notification-feed__count">
              {notifications.length}
              {query.hasNextPage ? '+' : ''} fired{currentIdentity ? ` for ${currentIdentity.displayName}` : ''}
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
        (notifications.length === 0 ? (
          <p className="notification-feed__state">No notifications yet.</p>
        ) : (
          <div ref={scrollRef} className="notification-feed__scroll" role="list">
            <div className="notification-feed__spacer" style={{ height: virtualizer.getTotalSize() }}>
              {virtualItems.map((virtualRow) => {
                const notification = notifications[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    role="listitem"
                    className="notification-feed__row"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {notification ? (
                      <NotificationItem notification={notification} />
                    ) : (
                      <p className="notification-feed__state" aria-live="polite">
                        Loading more…
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </section>
  );
}
