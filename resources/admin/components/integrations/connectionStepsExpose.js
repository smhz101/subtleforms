import '../../../shared/extend';
import ConnectionSteps from './ConnectionSteps';

/**
 * Put the connection steps component on the public extension object
 * (`window.SubtleFormsExtend`), so an add-on draws its instructions the same
 * way. Available since 2.8.1; add-ons check for it
 * (`typeof SubtleFormsExtend.ConnectionSteps === 'function'`).
 *
 * @param {Object} target The object to add it to; defaults to `window.SubtleFormsExtend`.
 * @return {Object} The object.
 */
export function exposeConnectionSteps(target = typeof window !== 'undefined' ? window.SubtleFormsExtend : null) {
  if (target) {
    target.ConnectionSteps = ConnectionSteps;
  }
  return target;
}

exposeConnectionSteps();
