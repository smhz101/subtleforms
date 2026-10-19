/**
 * How far to shrink a preview so a device width fits the canvas.
 *
 * @param {number} available Width the canvas can give the form, in pixels.
 * @param {number} formWidth The device width the form is laid out at.
 * @return {number} A scale of 1 or less.
 */
export function previewScale( available, formWidth ) {
	const width = Number( formWidth );
	const space = Number( available );
	if ( ! width || width <= 0 || ! space || space <= 0 ) {
		return 1;
	}
	return Math.min( 1, space / width );
}
