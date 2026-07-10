import { useState } from 'react';
import type { Rule } from '../../domain/rule.ts';
import { useViewingAs } from '../identity/useViewingAs.ts';
import { useRules } from './useRules.ts';
import { RuleRow } from './RuleRow.tsx';
import { RuleEditor } from './RuleEditor.tsx';
import { Button } from '../../components/Button.tsx';
import './RuleList.scss';

type EditorState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; rule: Rule };

export function RuleList() {
  const { currentIdentity } = useViewingAs();
  const query = useRules(currentIdentity?.id);
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });

  return (
    <section className="rule-list" aria-label="Rules">
      <div className="rule-list__header">
        <h2 className="rule-list__title">Rules</h2>
        <Button type="button" variant="primary" onClick={() => setEditor({ mode: 'create' })} disabled={!currentIdentity}>
          New rule
        </Button>
      </div>

      {query.status === 'pending' && <p className="rule-list__state">Loading rules…</p>}

      {query.status === 'error' && (
        <div className="rule-list__state rule-list__state--error">
          <p>Couldn't load rules.</p>
          <button type="button" onClick={() => query.refetch()}>
            Retry
          </button>
        </div>
      )}

      {query.status === 'success' &&
        (query.data.length === 0 ? (
          <p className="rule-list__state">No rules yet.</p>
        ) : (
          <ul className="rule-list__rows">
            {query.data.map((rule) => (
              <RuleRow key={rule.id} rule={rule} onEdit={(r) => setEditor({ mode: 'edit', rule: r })} />
            ))}
          </ul>
        ))}

      {editor.mode !== 'closed' && currentIdentity && (
        // key forces a remount when switching which rule is being edited
        // (or between create/edit) — RuleEditor's form state comes from
        // useReducer's *initializer*, which only runs on mount, so without
        // this key, clicking "Edit" on a different rule while the panel is
        // already open would reuse the same instance and keep showing the
        // first rule's stale form state instead of the newly-clicked one.
        <RuleEditor
          key={editor.mode === 'edit' ? editor.rule.id : 'create'}
          ownerId={currentIdentity.id}
          role={currentIdentity.role}
          rule={editor.mode === 'edit' ? editor.rule : undefined}
          onClose={() => setEditor({ mode: 'closed' })}
        />
      )}
    </section>
  );
}
