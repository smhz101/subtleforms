/** Event the editor loader fires on window when the renderer script has loaded. */
export const READY_EVENT = 'subtleforms:frontend-ready';

const isReady = () => typeof window.SubtleForms?.mount === 'function';

/**
 * Wait for the front-end renderer in the block editor.
 *
 * The renderer (window.SubtleForms) is loaded lazily on posts that had no form
 * block when the editor opened: the loader adds the script when the block is
 * inserted. A preview that mounts before the script has run must draw as soon
 * as it has. This calls back at once when the renderer is there, otherwise on
 * the loader's `subtleforms:frontend-ready` event, or when a short poll sees it.
 *
 * @param {Function} onReady   Called once with no arguments.
 * @param {Function} onTimeout Called once if the renderer never shows up.
 * @param {Object}   [options]
 * @param {number}   [options.interval=200] Poll interval in ms.
 * @param {number}   [options.timeout=10000] Give up after this many ms.
 * @return {Function} Cancel function (safe to call at any time).
 */
export function whenRendererReady(onReady, onTimeout, options = {}) {
	const { interval = 200, timeout = 10000 } = options;

	if (isReady()) {
		onReady();
		return () => {};
	}

	let done = false;
	let timer = null;
	const started = Date.now();

	const finish = () => {
		done = true;
		window.removeEventListener(READY_EVENT, check);
		if (timer) {
			clearInterval(timer);
		}
	};

	function check() {
		if (done) {
			return;
		}
		if (isReady()) {
			finish();
			onReady();
			return;
		}
		if (Date.now() - started >= timeout) {
			finish();
			onTimeout();
		}
	}

	window.addEventListener(READY_EVENT, check);
	timer = setInterval(check, interval);

	return finish;
}
