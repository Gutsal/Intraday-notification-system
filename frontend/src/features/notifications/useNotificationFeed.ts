import { useQuery } from '@tanstack/react-query';
import { fetchNotifications } from '../../services/apiClient.ts';

// Polls rather than pushes — the backend's notification log is populated by
// a replay run, not a live stream, but polling here models how a real
// streaming feed would be consumed without needing websockets for this scope.
const POLL_INTERVAL_MS = 5000;

export function useNotificationFeed(recipientId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', recipientId],
    queryFn: () => fetchNotifications(recipientId as string),
    enabled: Boolean(recipientId),
    refetchInterval: POLL_INTERVAL_MS,
  });
}
