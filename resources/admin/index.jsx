// Preloaded REST answers must be registered before any module that talks to the API.
import './data/preload';
import { render } from '@wordpress/element';
import AdminApp from './app/AdminApp';
// Add-on registry (window.SubtleFormsExtend) must exist before add-on scripts run.
import '../shared/extend';
// The shared service tile grid and header, for add-ons (since 2.7.5, add-ons feature-detect it).
import './components/integrations/serviceTiles/expose';
import './components/sectionPanel/expose';
// The shared query client and hooks, for add-ons (since 2.8.0, add-ons feature-detect it).
import './data/expose';

// Import aggregated admin styles
import './styles/admin.scss';

document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('subtleforms-admin-app');
  if (!mount) return;

  // Scope the SubtleForms admin theme to SubtleForms admin pages only. The
  // mount element only exists on SubtleForms admin screens, so adding this
  // class to <body> here cannot leak onto other wp-admin pages. The class
  // carries the --wp-admin-theme-color override that lets core
  // @wordpress/components (Modal/Popover/Notice, which portal into
  // document.body) pick up the SubtleForms primary without forking them
  // (Part C step 2).
  document.body.classList.add('subtleforms-admin-scope');

  render(<AdminApp />, mount);
});
