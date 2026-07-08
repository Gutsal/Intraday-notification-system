import { createContext } from 'react';
import type { Identity } from '../../domain/identity.ts';

export interface ViewingAsContextValue {
  identities: Identity[];
  currentIdentity: Identity | undefined;
  isLoading: boolean;
  setCurrentId: (id: string) => void;
}

// Holds the current "viewing as" recipientId — the entire "login" concept
// for this no-auth demo. Split into its own context (not a monolithic
// AppContext) so switching identity only re-renders consumers that
// actually read it.
export const ViewingAsContext = createContext<ViewingAsContextValue | undefined>(undefined);
