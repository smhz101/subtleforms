/**
 * Router compatibility shim — Phase 8 migration
 *
 * The app now uses react-router-dom MemoryRouter (see AdminApp.jsx).
 * This file re-exports path-based ROUTES constants and a thin useRouter()
 * wrapper around react-router-dom primitives for any code not yet migrated.
 *
 * All new code should import directly from 'react-router-dom'.
 */

import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from '@wordpress/element';

// Path-based route constants (react-router-dom paths)
export const ROUTES = {
  DASHBOARD:   '/',
  FORMS_LIST:  '/forms',
  FORM_EDITOR: '/forms/new',
  SUBMISSIONS: '/submissions',
  SETTINGS:    '/settings',
  EXTENSIONS:  '/extensions',
};

/**
 * Compatibility useRouter() hook wrapping react-router-dom primitives.
 *
 * Supports the legacy call signature:  navigate(path) and navigate(path, params)
 * where params are appended as query-string for backwards compat.
 */
export function useRouter() {
  const rrNavigate    = useNavigate();
  const params        = useParams();
  const [searchParams] = useSearchParams();

  const navigate = useCallback((path, extraParams = {}, replace = false) => {
    let url = path;
    const entries = Object.entries(extraParams).filter(
      ([, v]) => v !== undefined && v !== null
    );
    if (entries.length) {
      const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
      url = `${path}?${qs.toString()}`;
    }
    rrNavigate(url, { replace });
  }, [rrNavigate]);

  const getParam = useCallback((key) => {
    return params[key] ?? searchParams.get(key) ?? undefined;
  }, [params, searchParams]);

  const back = useCallback(() => {
    rrNavigate(-1);
  }, [rrNavigate]);

  return useMemo(
    () => ({ navigate, back, getParam, params, page: null }),
    [navigate, back, getParam, params]
  );
}

/**
 * RouterProvider is no longer needed — the MemoryRouter in AdminApp.jsx
 * provides the routing context.  Kept as a passthrough for compile compat.
 */
export function RouterProvider({ children }) {
  return children;
}

/**
 * Link component (legacy compat)
 */
export function Link({ to, params = {}, replace = false, children, className, ...props }) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => { e.preventDefault(); navigate(to, params, replace); }}
      {...props}
    >
      {children}
    </a>
  );
}

/**
 * NavButton component (legacy compat)
 */
export function NavButton({ to, params = {}, replace = false, children, ...props }) {
  const { navigate } = useRouter();
  return (
    <button onClick={(e) => { e.preventDefault(); navigate(to, params, replace); }} {...props}>
      {children}
    </button>
  );
}
