/**
 * Custom headers of a webhook as name and value rows (2.5.0), with a JSON
 * view for people who prefer to paste them.
 *
 * The rows are kept here while the user types and only valid rows are saved,
 * so a half-typed row is never lost and never reaches the server. Before
 * 2.5.0 the field showed the saved headers as JSON and ignored text that was
 * not valid JSON yet, so every keystroke put the old text back.
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import { Button, TextControl, TextareaControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from '../../../ui/Icon';
import {
  headersToRows,
  headerProblemText,
  parseHeadersJson,
  rowProblems,
  rowsToHeaders,
  rowsToJson,
} from './webhookModel';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function HeadersEditor({ value, onChange, disabled }) {
  const [rows, setRows] = useState(() => headersToRows(value));
  const [view, setView] = useState('rows');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  // The headers this editor last saved: a different value from outside (undo,
  // another action) replaces the rows; the editor's own saves do not.
  const saved = useRef(rowsToHeaders(rows));

  useEffect(() => {
    const incoming = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    if (!same(incoming, saved.current)) {
      saved.current = incoming;
      setRows(headersToRows(incoming));
    }
  }, [value]);

  const commit = (nextRows) => {
    setRows(nextRows);
    const headers = rowsToHeaders(nextRows);
    if (!same(headers, saved.current)) {
      saved.current = headers;
      onChange(headers);
    }
  };

  const problems = rowProblems(rows);
  const update = (id, patch) => commit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id) => commit(rows.filter((r) => r.id !== id));
  const add = () => commit([...rows, ...headersToRows({ '': '' })]);

  const openJson = () => {
    setJsonText(rowsToJson(rows));
    setJsonError('');
    setView('json');
  };

  const editJson = (text) => {
    setJsonText(text);
    const parsed = parseHeadersJson(text);
    if (!parsed.ok) {
      setJsonError(parsed.error);
      return;
    }
    setJsonError('');
    commit(parsed.rows);
  };

  const jsonRowProblems = view === 'json' && !jsonError ? rowProblems(rows) : [];

  return (
    <div className='sf-webhook-headers'>
      <div className='sf-webhook-section__head'>
        <div>
          <h4 className='sf-webhook-section__title'>{__('Custom headers', 'subtleforms')}</h4>
          <p className='sf-webhook-section__help'>
            {__('Extra HTTP headers sent with every request, for example an API key your endpoint expects.', 'subtleforms')}
          </p>
        </div>
        <Button
          variant='link'
          onClick={view === 'rows' ? openJson : () => setView('rows')}
          disabled={disabled || (view === 'json' && !!jsonError)}
          aria-describedby={view === 'json' && jsonError ? 'sf-webhook-headers-json-error' : undefined}>
          {view === 'rows' ? __('View as JSON', 'subtleforms') : __('Back to rows', 'subtleforms')}
        </Button>
      </div>

      {view === 'rows' && (
        <>
          {rows.length === 0 && (
            <p className='sf-webhook-headers__empty'>{__('No custom headers.', 'subtleforms')}</p>
          )}
          {rows.map((row, i) => {
            const problem = problems[i];
            const errorId = `sf-webhook-header-${row.id}-error`;
            return (
              <div className='sf-webhook-headers__row' key={row.id}>
                <div className='sf-webhook-headers__fields'>
                  <TextControl
                    label={__('Header name', 'subtleforms')}
                    hideLabelFromVision
                    placeholder={__('Header name', 'subtleforms')}
                    value={row.name}
                    onChange={(v) => update(row.id, { name: v })}
                    disabled={disabled}
                    aria-invalid={problem ? 'true' : undefined}
                    aria-describedby={problem ? errorId : undefined}
                    autoComplete='off'
                    spellCheck={false}
                  />
                  <TextControl
                    label={__('Header value', 'subtleforms')}
                    hideLabelFromVision
                    placeholder={__('Value', 'subtleforms')}
                    value={row.value}
                    onChange={(v) => update(row.id, { value: v })}
                    disabled={disabled}
                    aria-invalid={problem === 'invalid_value' ? 'true' : undefined}
                    autoComplete='off'
                    spellCheck={false}
                  />
                  <Button
                    className='sf-webhook-headers__remove'
                    variant='tertiary'
                    isDestructive
                    size='compact'
                    disabled={disabled}
                    onClick={() => remove(row.id)}
                    label={row.name ? `${__('Remove header', 'subtleforms')} ${row.name}` : __('Remove header', 'subtleforms')}>
                    <Icon.Trash size={16} aria-hidden='true' />
                  </Button>
                </div>
                {problem && (
                  <p className='sf-webhook-headers__error' id={errorId} role='alert'>
                    {headerProblemText(problem, row.name)}
                  </p>
                )}
              </div>
            );
          })}
          <div>
            <Button variant='secondary' size='compact' onClick={add} disabled={disabled}>
              <Icon.Plus size={14} aria-hidden='true' />
              {__('Add header', 'subtleforms')}
            </Button>
          </div>
        </>
      )}

      {view === 'json' && (
        <>
          <TextareaControl
            label={__('Headers as JSON', 'subtleforms')}
            hideLabelFromVision
            className='sf-webhook-code'
            value={jsonText}
            rows={6}
            onChange={editJson}
            disabled={disabled}
            spellCheck={false}
            placeholder={'{\n  "X-Source": "subtleforms"\n}'}
            help={__('A JSON object of header names and values. Rows that SubtleForms refuses are listed below.', 'subtleforms')}
          />
          {jsonError && (
            <p className='sf-webhook-headers__error' id='sf-webhook-headers-json-error' role='alert'>
              {jsonError} {__('What you typed is kept. Nothing is saved until it is valid.', 'subtleforms')}
            </p>
          )}
          {jsonRowProblems.map((problem, i) =>
            problem ? (
              <p className='sf-webhook-headers__error' key={rows[i].id} role='alert'>
                {`${rows[i].name || __('(no name)', 'subtleforms')}: ${headerProblemText(problem, rows[i].name)}`}
              </p>
            ) : null
          )}
        </>
      )}
    </div>
  );
}
