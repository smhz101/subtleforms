import { render } from '@wordpress/element';
import AdminApp from './app/AdminApp';
import { watchMenuFit } from './utils/menuFit';
// Add-on registry (window.SubtleFormsExtend) must exist before add-on scripts run.
import '../shared/extend';

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
  watchMenuFit();

  render(<AdminApp />, mount);
});
