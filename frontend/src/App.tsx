import { ViewingAsSwitcher } from './features/identity/ViewingAsSwitcher.tsx';
import { NotificationFeed } from './features/notifications/NotificationFeed.tsx';
import { RuleList } from './features/rules/RuleList.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './App.scss';

// Single page, no router — two sections stacked (NotificationFeed above
// RuleList), ViewingAsSwitcher pinned at the top. Deliberate per
// CLAUDE.md's UI architecture decision: a two-view app doesn't need
// routing overhead.
function App() {
  return (
    <div className="app">
      <header className="app__header">
        <ViewingAsSwitcher />
      </header>
      <main className="app__main">
        <ErrorBoundary fallbackLabel="Notifications">
          <NotificationFeed />
        </ErrorBoundary>
        <ErrorBoundary fallbackLabel="Rules">
          <RuleList />
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
