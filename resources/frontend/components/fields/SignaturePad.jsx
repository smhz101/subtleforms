import { useRef, useEffect, useState, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Canvas signature capture.
 *
 * Stores the signature as a PNG data URL so it travels as an ordinary string
 * field. Pointer events cover mouse, touch and stylus with one code path.
 *
 * A text alternative is offered alongside the canvas: drawing is impossible for
 * keyboard-only and many motor-impaired users, so typing a name must be a
 * first-class way to sign rather than a fallback nobody can reach.
 */
export default function SignaturePad( {
  inputId,
  value,
  onChange,
  required,
  error,
  disabled = false,
} ) {
  const canvasRef = useRef( null );
  const drawingRef = useRef( false );
  const lastPointRef = useRef( null );
  const [ typedMode, setTypedMode ] = useState( false );
  const [ typedName, setTypedName ] = useState( '' );

  // Size the backing store to the device pixel ratio so strokes aren't blurry.
  useEffect( () => {
    const canvas = canvasRef.current;
    if ( ! canvas ) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if ( rect.width === 0 ) {
      return;
    }

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const ctx = canvas.getContext( '2d' );
    ctx.scale( ratio, ratio );
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, [] );

  const pointFromEvent = ( event ) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const commit = useCallback( () => {
    const canvas = canvasRef.current;
    if ( canvas ) {
      onChange( canvas.toDataURL( 'image/png' ) );
    }
  }, [ onChange ] );

  const handlePointerDown = ( event ) => {
    if ( disabled ) {
      return;
    }
    event.currentTarget.setPointerCapture?.( event.pointerId );
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent( event );
  };

  const handlePointerMove = ( event ) => {
    if ( ! drawingRef.current || disabled ) {
      return;
    }
    // Prevent the page scrolling while a finger is drawing.
    event.preventDefault();

    const ctx = canvasRef.current.getContext( '2d' );
    const point = pointFromEvent( event );
    const last = lastPointRef.current;

    ctx.beginPath();
    ctx.moveTo( last.x, last.y );
    ctx.lineTo( point.x, point.y );
    ctx.stroke();

    lastPointRef.current = point;
  };

  const handlePointerUp = () => {
    if ( ! drawingRef.current ) {
      return;
    }
    drawingRef.current = false;
    lastPointRef.current = null;
    commit();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if ( canvas ) {
      const ctx = canvas.getContext( '2d' );
      ctx.clearRect( 0, 0, canvas.width, canvas.height );
    }
    setTypedName( '' );
    onChange( '' );
  };

  if ( typedMode ) {
    return (
      <div className='subtleforms-signature'>
        <input
          id={ inputId }
          type='text'
          className='subtleforms-input subtleforms-signature__typed'
          value={ typedName }
          onChange={ ( e ) => {
            setTypedName( e.target.value );
            onChange( e.target.value );
          } }
          placeholder={ __( 'Type your full name', 'subtleforms' ) }
          disabled={ disabled }
          aria-required={ required }
          aria-invalid={ !! error }
          aria-describedby={ error ? `${ inputId }-error` : undefined }
        />
        <div className='subtleforms-signature__actions'>
          <button
            type='button'
            className='subtleforms-signature__button'
            onClick={ () => {
              setTypedMode( false );
              clear();
            } }>
            { __( 'Draw instead', 'subtleforms' ) }
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='subtleforms-signature'>
      <canvas
        ref={ canvasRef }
        id={ inputId }
        className='subtleforms-signature__canvas'
        role='img'
        aria-label={ __( 'Signature drawing area', 'subtleforms' ) }
        aria-invalid={ !! error }
        aria-describedby={ error ? `${ inputId }-error` : undefined }
        onPointerDown={ handlePointerDown }
        onPointerMove={ handlePointerMove }
        onPointerUp={ handlePointerUp }
        onPointerLeave={ handlePointerUp }
        onPointerCancel={ handlePointerUp }
      />
      <div className='subtleforms-signature__actions'>
        <button
          type='button'
          className='subtleforms-signature__button'
          onClick={ clear }
          disabled={ disabled || ! value }>
          { __( 'Clear', 'subtleforms' ) }
        </button>
        <button
          type='button'
          className='subtleforms-signature__button'
          onClick={ () => setTypedMode( true ) }>
          { __( 'Type your name instead', 'subtleforms' ) }
        </button>
      </div>
    </div>
  );
}
