/**
 * Which look a service logo has. One full-colour artwork per brand is drawn
 * and the style sheet greys it with a filter, so the state is only a class:
 * full colour while the service is on, grey while it is off (and full colour
 * again on hover or keyboard focus of a tile, see serviceTiles.scss).
 *
 * @param {boolean} enabled Whether the service is switched on.
 * @return {string} `sf-svc-logo--colour` or `sf-svc-logo--grey`.
 */
export function logoClass(enabled) {
  return enabled ? 'sf-svc-logo--colour' : 'sf-svc-logo--grey';
}
