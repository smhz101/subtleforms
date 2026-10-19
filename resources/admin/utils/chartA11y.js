/**
 * Props for one chart bar. A div with an accessible name needs a role,
 * and the chart also prints the same words as text.
 *
 * @param {string} label What the bar shows, for example "Oct 12: 4 submissions".
 * @return {{role: string, 'aria-label': string}}
 */
export function chartColumnProps( label ) {
	return {
		role: 'img',
		'aria-label': label,
	};
}
