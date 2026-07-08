import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchIdentities } from '../../services/apiClient.ts';
import { ViewingAsContext, type ViewingAsContextValue } from './ViewingAsContext.ts';

interface ViewingAsProviderProps {
  children: ReactNode;
}

export function ViewingAsProvider({ children }: ViewingAsProviderProps) {
  const { data: identities = [], isLoading } = useQuery({
    queryKey: ['identities'],
    queryFn: fetchIdentities,
  });
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  // Defaults to the first identity once loaded, without forcing a
  // useEffect just to sync derived state.
  const currentId = selectedId ?? identities[0]?.id;
  const currentIdentity = identities.find((identity) => identity.id === currentId);

  const value = useMemo<ViewingAsContextValue>(
    () => ({ identities, currentIdentity, isLoading, setCurrentId: setSelectedId }),
    [identities, currentIdentity, isLoading],
  );

  return <ViewingAsContext.Provider value={value}>{children}</ViewingAsContext.Provider>;
}
