import { useViewingAs } from './useViewingAs.ts';
import './ViewingAsSwitcher.scss';

const ROLE_LABEL: Record<string, string> = {
  team_lead: 'Team lead',
  agent: 'Agent',
};

// The entire "login" concept for this no-auth demo — pinned at the top of
// the page, drives both RuleList and NotificationFeed via ViewingAsContext.
export function ViewingAsSwitcher() {
  const { identities, currentIdentity, isLoading, setCurrentId } = useViewingAs();

  return (
    <div className="viewing-as-switcher">
      <label htmlFor="viewing-as-select" className="viewing-as-switcher__label">
        Viewing as
      </label>
      <select
        id="viewing-as-select"
        className="viewing-as-switcher__select"
        value={currentIdentity?.id ?? ''}
        disabled={isLoading || identities.length === 0}
        onChange={(event) => setCurrentId(event.target.value)}
      >
        {identities.map((identity) => (
          <option key={identity.id} value={identity.id}>
            {identity.displayName} ({ROLE_LABEL[identity.role] ?? identity.role})
          </option>
        ))}
      </select>
    </div>
  );
}
