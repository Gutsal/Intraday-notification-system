import { createContext } from 'react';
import type { Identity } from '../../domain/identity.ts';

export interface ViewingAsContextValue {
  identities: Identity[];
  currentIdentity: Identity | undefined;
  isLoading: boolean;
  setCurrentId: (id: string) => void;
}

// DEMO: holds the current "viewing as" recipientId — the entire "login"
// concept for this no-auth demo, standing in for a real session/auth
// context. Split into its own context (not a monolithic AppContext) so
// switching identity only re-renders consumers that actually read it.
export const ViewingAsContext = createContext<ViewingAsContextValue | undefined>(undefined);
