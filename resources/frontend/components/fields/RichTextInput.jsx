import { useRef, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Lightweight rich text input.
 *
 * Submits HTML restricted to the same small tag set the server allows for
 * rich_text fields (bold, italic, lists, links, paragraphs, line breaks).
 * Anything outside that set is stripped on save, so the toolbar deliberately
 * offers only what survives — a formatting control that silently loses its
 * effect is worse than no control.
 *
 * `document.execCommand` is formally deprecated but remains the only API
 * implemented across all current browsers for contentEditable formatting.
 */

const ALLOWED_TAGS = [ 'B', 'STRONG', 'I', 'EM', 'U', 'A', 'UL', 'OL', 'LI', 'P', 'BR' ];

/**
 * Strip anything outside the allowlist, unwrapping disallowed elements so their
 * text survives. Mirrors the server policy so what you see is what is stored.
 */
const sanitizeHtml = ( html ) => {
  const doc = document.implementation.createHTMLDocument( '' );
  doc.body.innerHTML = html;

  const walk = ( node ) => {
    // Copy the list: we mutate the tree while iterating it.
    Array.from( node.childNodes ).forEach( ( child ) => {
      if ( child.nodeType === Node.TEXT_NODE ) {
        return;
      }

      if ( child.nodeType !== Node.ELEMENT_NODE ) {
        child.remove();
        return;
      }

      walk( child );

      if ( ! ALLOWED_TAGS.includes( child.tagName ) ) {
        // Unwrap: keep the text, drop the element.
        child.replaceWith( ...Array.from( child.childNodes ) );
        return;
      }

      // Strip every attribute except a safe href on links.
      Array.from( child.attributes ).forEach( ( attr ) => {
        const isSafeHref =
          child.tagName === 'A' &&
          attr.name === 'href' &&
          /^(https?:|mailto:|#|\/)/i.test( attr.value.trim() );

        if ( ! isSafeHref ) {
          child.removeAttribute( attr.name );
        }
      } );

      if ( child.tagName === 'A' ) {
        child.setAttribute( 'rel', 'noopener noreferrer' );
      }
    } );
  };

  walk( doc.body );
  return doc.body.innerHTML;
};

export default function RichTextInput( {
  inputId,
  value,
  onChange,
  placeholder,
  required,
  error,
  disabled = false,
} ) {
  const editorRef = useRef( null );

  // Only write into the DOM when the incoming value diverges from what the user
  // is looking at — assigning innerHTML on every render collapses the caret.
  useEffect( () => {
    const el = editorRef.current;
    if ( el && el.innerHTML !== ( value || '' ) ) {
      el.innerHTML = value || '';
    }
  }, [ value ] );

  const handleInput = useCallback( () => {
    const el = editorRef.current;
    if ( el ) {
      onChange( sanitizeHtml( el.innerHTML ) );
    }
  }, [ onChange ] );

  // Paste as plain text so foreign markup never enters the editor.
  const handlePaste = useCallback( ( event ) => {
    event.preventDefault();
    const text = event.clipboardData?.getData( 'text/plain' ) ?? '';
    document.execCommand( 'insertText', false, text );
  }, [] );

  const exec = ( command ) => {
    editorRef.current?.focus();
    document.execCommand( command, false, null );
    handleInput();
  };

  const commands = [
    { command: 'bold', label: __( 'Bold', 'subtleforms' ), text: 'B' },
    { command: 'italic', label: __( 'Italic', 'subtleforms' ), text: 'I' },
    {
      command: 'insertUnorderedList',
      label: __( 'Bulleted list', 'subtleforms' ),
      text: '•',
    },
    {
      command: 'insertOrderedList',
      label: __( 'Numbered list', 'subtleforms' ),
      text: '1.',
    },
  ];

  return (
    <div className='subtleforms-richtext'>
      <div
        className='subtleforms-richtext__toolbar'
        role='toolbar'
        aria-label={ __( 'Text formatting', 'subtleforms' ) }>
        { commands.map( ( { command, label, text } ) => (
          <button
            key={ command }
            type='button'
            className='subtleforms-richtext__button'
            onClick={ () => exec( command ) }
            disabled={ disabled }
            aria-label={ label }
            title={ label }>
            { text }
          </button>
        ) ) }
      </div>
      <div
        ref={ editorRef }
        id={ inputId }
        className='subtleforms-richtext__editor'
        contentEditable={ ! disabled }
        role='textbox'
        aria-multiline='true'
        aria-required={ required }
        aria-invalid={ !! error }
        aria-describedby={ error ? `${ inputId }-error` : undefined }
        data-placeholder={ placeholder }
        onInput={ handleInput }
        onBlur={ handleInput }
        onPaste={ handlePaste }
        suppressContentEditableWarning
      />
    </div>
  );
}
