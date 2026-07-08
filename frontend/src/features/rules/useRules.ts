import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRule, fetchRules, updateRule } from '../../services/apiClient.ts';
import type { RuleInput } from '../../domain/rule.ts';

export function useRules(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['rules', ownerId],
    queryFn: () => fetchRules(ownerId as string),
    enabled: Boolean(ownerId),
  });
}

export function useRuleMutations(ownerId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rules', ownerId] });

  const create = useMutation({
    mutationFn: (input: RuleInput) => createRule(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RuleInput }) => updateRule(id, input),
    onSuccess: invalidate,
  });

  return { create, update };
}
