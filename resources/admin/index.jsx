import { render } from '@wordpress/element';
import App from './App';

document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('subtleforms-admin-app');
  if (!mount) return;
  render(<App />, mount);
});
