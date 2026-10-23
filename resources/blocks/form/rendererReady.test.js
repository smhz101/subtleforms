/**
 * The block preview waits for the lazily loaded front-end renderer.
 */
import { whenRendererReady, READY_EVENT } from './rendererReady';

describe('whenRendererReady', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		delete window.SubtleForms;
	});
	afterEach(() => {
		jest.useRealTimers();
		delete window.SubtleForms;
	});

	test('calls back at once when the renderer is already there', () => {
		window.SubtleForms = { mount: jest.fn() };
		const ready = jest.fn();
		whenRendererReady(ready, jest.fn());
		expect(ready).toHaveBeenCalledTimes(1);
	});

	test('mounts when the script finishes loading and fires its event', () => {
		const ready = jest.fn();
		whenRendererReady(ready, jest.fn());
		expect(ready).not.toHaveBeenCalled();
		window.SubtleForms = { mount: jest.fn() };
		window.dispatchEvent(new Event(READY_EVENT));
		expect(ready).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(5000);
		expect(ready).toHaveBeenCalledTimes(1);
	});

	test('mounts from the poll when the event is missed', () => {
		const ready = jest.fn();
		whenRendererReady(ready, jest.fn());
		jest.advanceTimersByTime(600);
		expect(ready).not.toHaveBeenCalled();
		window.SubtleForms = { mount: jest.fn() };
		jest.advanceTimersByTime(250);
		expect(ready).toHaveBeenCalledTimes(1);
	});

	test('gives up after the timeout', () => {
		const ready = jest.fn();
		const timedOut = jest.fn();
		whenRendererReady(ready, timedOut, { timeout: 1000 });
		jest.advanceTimersByTime(1500);
		expect(timedOut).toHaveBeenCalledTimes(1);
		expect(ready).not.toHaveBeenCalled();
	});

	test('cancel stops everything', () => {
		const ready = jest.fn();
		const timedOut = jest.fn();
		const cancel = whenRendererReady(ready, timedOut, { timeout: 1000 });
		cancel();
		window.SubtleForms = { mount: jest.fn() };
		window.dispatchEvent(new Event(READY_EVENT));
		jest.advanceTimersByTime(5000);
		expect(ready).not.toHaveBeenCalled();
		expect(timedOut).not.toHaveBeenCalled();
	});
});
