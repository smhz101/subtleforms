import { memo } from '@wordpress/element';
import ProNotice from '../../../../ui/ProNotice';

/**
 * Maps the PHP `pro_notice` control type: a setting that SubtleForms Pro
 * provides. It shows the label, a Pro tag, the help text and an upgrade link,
 * and changes nothing. Pro replaces it with the real controls through the
 * `subtleforms/fields/inspector_controls` filter.
 */
const ProNoticeControl = memo( function ProNoticeControl( { label, help, control } ) {
	return <ProNotice label={ label } help={ help } feature={ control?.feature || '' } />;
} );

export default ProNoticeControl;
