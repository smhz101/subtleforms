/**
 * Builder Notices Hook
 *
 * Handles WordPress notice creation and management.
 */

import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

export default function useBuilderNotices() {
  const { createSuccessNotice, createErrorNotice, removeNotice } = useDispatch(noticesStore);

  const SUCCESS_NOTICE_ID = 'subtleforms-form-save-success';
  const ERROR_NOTICE_ID = 'subtleforms-form-save-error';

  return {
    createSuccessNotice,
    createErrorNotice,
    removeNotice,
    SUCCESS_NOTICE_ID,
    ERROR_NOTICE_ID,
  };
}
