import { useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerReplay } from '../../services/apiClient.ts';

// DEMO: reprocesses the fixed sample events.jsonl from
// scratch against whatever rules currently exist. This system has no live
// event stream to poll against — in production, a new/edited rule would
// just start evaluating future events and open agent states on its own,
// with no "replay" step (see README §2/§8 for the fuller explanation).
export function useReplay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerReplay,
    // Prefix match invalidates every recipientId's cached notifications,
    // not just the currently-viewed one — a replay affects the whole
    // shared dataset, not one identity's slice of it.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
