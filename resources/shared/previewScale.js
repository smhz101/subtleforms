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

/**
 * Box the scaled preview occupies. The form is laid out at the device width
 * and scaled from its top left, so the stage must be the scaled size.
 * Scaling from the centre of the full device width slides the form out of the pane.
 *
 * @param {number} formWidth Device width, in pixels.
 * @param {number} scale     Result of previewScale().
 * @return {{stageWidth: number, origin: string}}
 */
export function previewFrame( formWidth, scale ) {
	const safe = Number( scale ) > 0 ? Number( scale ) : 1;
	const width = Number( formWidth ) || 0;
	return {
		stageWidth: width * safe,
		origin: 'top left',
	};
}

