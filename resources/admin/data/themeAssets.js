/**
 * What a page of the active theme loads (2.9.0): its stylesheets, inline
 * styles, fonts and global styles, and the body and content classes around a
 * form. The builder preview draws a form inside a document built from this so
 * "Inherit from theme" looks like the theme.
 *
 * The server collects it once per theme and version
 * (GET /subtleforms/v1/appearance/theme-assets), so it is fetched rarely.
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './apiClient';
import { queryKeys } from './queryKeys';

export const THEME_ASSETS_STALE_TIME = 60 * 60 * 1000;

/**
 * The theme assets, or undefined while they load or when the request fails.
 *
 * @return {Object|undefined} Data from the server.
 */
export function useThemeAssets() {
  const { data } = useQuery( {
    queryKey: queryKeys.appearance.themeAssets(),
    queryFn: () => apiClient.get( '/appearance/theme-assets' ),
    staleTime: THEME_ASSETS_STALE_TIME,
    retry: false,
  } );
  return data && typeof data === 'object' ? data : undefined;
}

/**
 * The assets the preview uses while the request is out, or when it fails:
 * the two stylesheet files and global styles the page already carries.
 *
 * @return {Object} Same shape as the server answer.
 */
export function fallbackThemeAssets() {
  const admin = window.subtleformsAdmin || {};
  return {
    stylesheets: admin.themeStylesheets || [],
    inlineCss: '',
    globalCss: admin.themeGlobalCss || '',
    fontFaces: admin.themeFontFaces || '',
    isBlockTheme: false,
    bodyClasses: [],
    contentClass: '',
    degraded: true,
    isFallback: true,
  };
}
