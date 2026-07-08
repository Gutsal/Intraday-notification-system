import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackLabel: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// A crash in one feature section (e.g. the rule editor) shouldn't blank the
// other (the notification feed) — each major section in App.tsx gets its
// own boundary rather than one wrapping the whole page.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(error);
  }

  override render() {
    if (this.state.hasError) {
      return <div className="error-boundary-fallback">{this.props.fallbackLabel} failed to render.</div>;
    }
    return this.props.children;
  }
}
