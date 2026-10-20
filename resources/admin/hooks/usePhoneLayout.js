/**
 * Whether the admin screens use their phone layout: the width at which
 * DataTable rows become cards (DataTable.scss) and the builder asks for a
 * wider screen. useViewportMatch('small', '<') is (max-width: 600px), one
 * pixel more than the styles, so at exactly 600px the scripts used the phone
 * layout while the styles drew the desktop one (review of #47).
 */
import { useMediaQuery } from '@wordpress/compose';

/** Same width as the `@media (max-width: 599px)` rules in the admin styles. */
export const PHONE_LAYOUT_QUERY = '(max-width: 599px)';

/**
 * @return {boolean} True below 600px.
 */
export default function usePhoneLayout() {
	return useMediaQuery( PHONE_LAYOUT_QUERY );
}
