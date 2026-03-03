/**
 * Router-aware navigation utilities
 *
 * Wrappers around existing components to support client-side routing
 * powered by react-router-dom MemoryRouter.
 */

import { Button as WPButton } from '@wordpress/components';
import { useNavigate } from 'react-router-dom';

/**
 * Map a WordPress admin ?page=... value (plus optional params object) to
 * a react-router-dom memory path.
 */
function wpPageToPath(page, params = {}) {
  switch (page) {
    case 'subtleforms':
      return '/';
    case 'subtleforms-forms':
      return '/forms';
    case 'subtleforms-settings':
      return '/settings';
    case 'subtleforms-extensions':
      return '/extensions';
    case 'subtleforms-submissions': {
      const subId  = params.submission_id;
      const formId = params.form_id;
      if (subId) return `/submissions/${subId}${formId ? `?form_id=${formId}` : ''}`;
      return formId ? `/submissions?form_id=${formId}` : '/submissions';
    }
    case 'subtleforms-new-form': {
      const formId = params.form_id;
      return formId ? `/forms/${formId}` : '/forms/new';
    }
    default:
      return '/';
  }
}

/**
 * Router-aware Button component.
 * Intercepts admin.php?page=... hrefs and routes within the MemoryRouter.
 */
export function Button({ href, onClick, ...props }) {
  const navigate = useNavigate();

  if (href && href.includes('admin.php?page=')) {
    const handleClick = (e) => {
      e.preventDefault();

      const url    = new URL(href, window.location.origin + '/wp-admin/');
      const page   = url.searchParams.get('page');
      const params = {};
      url.searchParams.forEach((value, key) => {
        if (key !== 'page') params[key] = value;
      });

      navigate(wpPageToPath(page, params));

      if (onClick) onClick(e);
    };

    return <WPButton {...props} href={href} onClick={handleClick} />;
  }

  return <WPButton {...props} href={href} onClick={onClick} />;
}

/**
 * Router-aware link component.
 * `to` can be either a react-router-dom path (/forms) or a WP page name.
 */
export function NavLink({ to, params, children, className, ...props }) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    e.preventDefault();
    // If `to` looks like a WP page name, convert it; otherwise use as-is
    const path = to && !to.startsWith('/') ? wpPageToPath(to, params) : (to || '/');
    navigate(path);
  };

  const href = to && to.startsWith('/')
    ? to
    : `admin.php?page=${to}${Object.entries(params || {}).map(([k, v]) => `&${k}=${v}`).join('')}`;

  return (
    <a href={href} onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
}
