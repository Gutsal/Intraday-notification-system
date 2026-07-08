export interface Identity {
  id: string;
  displayName: string;
  role: 'team_lead' | 'agent';
}

// No auth in this system — these are the entire "login" concept for the
// demo. Modeled as data (served via GET /identities) rather than a
// hardcoded frontend array, so swapping in real auth later isn't a rewrite.
export const SEED_IDENTITIES: readonly Identity[] = [
  { id: 'lead_1', displayName: 'Jordan', role: 'team_lead' },
  { id: 'a_19', displayName: 'a_19', role: 'agent' },
] as const;
