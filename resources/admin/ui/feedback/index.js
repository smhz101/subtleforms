/**
 * Feedback UI System
 */

export { NoticeProvider, useNotice } from './NoticeProvider';
export { ErrorBoundary } from './ErrorBoundary';
export { normalizeError, getUserFriendlyMessage } from './normalizeError';
export { default as LiveRegion, LiveRegionContainer, srOnlyClass } from './LiveRegion';
export {
  useLiveAnnounce,
  useAnnouncementQueue,
  announceNavigation,
  announceValidationErrors,
  announceLoading,
} from './useLiveAnnounce';
