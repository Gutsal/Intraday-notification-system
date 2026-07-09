import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchNotifications } from '../../services/apiClient.ts';

// Polls rather than pushes — the backend's notification log is populated by
// a replay run, not a live stream, but polling here models how a real
// streaming feed would be consumed without needing websockets for this scope.
const POLL_INTERVAL_MS = 5000;

export const PAGE_SIZE = 30;

// A recipient's full history could be enormous at real scale (see
// README's Scaling notes) — fetch it page by page via a keyset cursor
// rather than one big request. maxPages bounds both the refetch cost of
// the 5s poll and the memory this holds onto: once someone has scrolled
// past MAX_PAGES pages, the oldest loaded page is dropped rather than kept
// (and re-polled) forever. Deliberately not "fetch everything, virtualize
// only the DOM" — the point is bounding what leaves the server too.
const MAX_PAGES = 10;

export function useNotificationFeed(recipientId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['notifications', recipientId],
    queryFn: ({ pageParam }) => fetchNotifications(recipientId as string, { limit: PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    maxPages: MAX_PAGES,
    enabled: Boolean(recipientId),
    refetchInterval: POLL_INTERVAL_MS,
  });
}
