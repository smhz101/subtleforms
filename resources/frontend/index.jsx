import { createRoot } from '@wordpress/element';
import FormRenderer from './components/FormRenderer';
import './frontend.css';

document.addEventListener('DOMContentLoaded', () => {
  const containers = document.querySelectorAll('.subtleforms-form-container');

  containers.forEach((container) => {
    const formId = parseInt(container.dataset.formId, 10);

    if (!formId) {
      return;
    }

    const root = createRoot(container);
    root.render(<FormRenderer formId={formId} />);
  });
});
