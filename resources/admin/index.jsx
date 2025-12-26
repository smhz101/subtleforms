import { render } from '@wordpress/element';
import AdminApp from './app/AdminApp';

document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('subtleforms-admin-app');
  if (!mount) return;
  render(<AdminApp />, mount);
});
