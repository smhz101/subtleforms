/**
 * Block icon: the SubtleForms mark as a single-colour silhouette, so the
 * editor tints it like any other block icon.
 */
import { SVG, Path } from '@wordpress/components';

export default (
  <SVG xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>
    <Path
      fill='currentColor'
      d='M0 122.88 C0 55.015 55.015 0 122.88 0 L389.12 0 C406.467 0 422.974 3.594 437.937 10.079 L170.586 117.679 C131.238 133.516 112.178 178.252 128.015 217.6 L128 217.6 C128 260.015 162.385 294.4 204.8 294.4 L383.975 294.4 L12.8 443.787 C4.607 427.322 0 408.759 0 389.12 Z'
    />
    <Path
      fill='currentColor'
      d='M128.015 217.6 L499.199 68.21 C507.392 84.676 512 103.24 512 122.88 L512 389.12 C512 456.985 456.985 512 389.12 512 L122.88 512 C105.531 512 89.023 508.405 74.058 501.919 L341.403 394.321 C380.751 378.484 399.811 333.748 383.975 294.4 L384 294.4 C384 251.985 349.615 217.6 307.2 217.6 Z'
    />
  </SVG>
);
