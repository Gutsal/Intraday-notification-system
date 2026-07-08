import { useContext } from 'react';
import { ViewingAsContext } from './ViewingAsContext.ts';

export function useViewingAs() {
  const ctx = useContext(ViewingAsContext);
  if (!ctx) throw new Error('useViewingAs must be used within a ViewingAsProvider');
  return ctx;
}
