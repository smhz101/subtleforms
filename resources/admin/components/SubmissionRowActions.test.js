/**
 * Row action icons: each tooltip shows its own button's label, and only one
 * tooltip is ever on screen (a "Move to Trash" label once showed over Star).
 */
jest.mock('./IconAction.scss', () => ({}));
import { act } from 'react';
import { createElement, render, unmountComponentAtNode } from '@wordpress/element';
import { screen, fireEvent } from '@testing-library/dom';
import SubmissionRowActions from './SubmissionRowActions';
import { tooltipPosition } from './IconAction';

jest.mock('../ui', () => {
  const stub = () => null;
  return { Icon: new Proxy({}, { get: () => stub }) };
});

describe('SubmissionRowActions tooltips', () => {
  let host;
  const props = (submission = {}) => ({
    submission: { id: 7, status: 'completed', starred: 0, is_read: 1, ...submission },
    hardDelete: false,
    onView: jest.fn(),
    onMark: jest.fn(),
    onRestore: jest.fn(),
    onTrash: jest.fn(),
    onDelete: jest.fn(),
  });

  beforeEach(() => {
    jest.useFakeTimers();
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(() => {
    unmountComponentAtNode(host);
    host.remove();
    jest.useRealTimers();
  });

  const mount = async (p) => {
    await act(async () => {
      render(createElement(SubmissionRowActions, p), host);
    });
  };
  const hover = async (button) => {
    await act(async () => {
      fireEvent.pointerOver(button);
      jest.advanceTimersByTime(500);
    });
  };
  const leave = async (button) => {
    await act(async () => {
      fireEvent.pointerOut(button, { relatedTarget: document.body });
    });
  };

  test('every button shows its own label as its tooltip', async () => {
    await mount(props());
    const labels = ['View', 'Star', 'Flag', 'Move to Trash'];
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(labels);

    for (const [index, button] of buttons.entries()) {
      await hover(button);
      const tips = screen.getAllByRole('tooltip');
      expect(tips).toHaveLength(1);
      expect(tips[0].textContent).toBe(labels[index]);
      await leave(button);
      expect(screen.queryByRole('tooltip')).toBeNull();
    }
  });

  test('moving from one button to the next never leaves the first label up', async () => {
    await mount(props());
    const [, star, , trash] = screen.getAllByRole('button');
    await hover(trash);
    expect(screen.getByRole('tooltip').textContent).toBe('Move to Trash');
    await leave(trash);
    await hover(star);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.getByRole('tooltip').textContent).toBe('Star');
  });

  test('keyboard focus shows that button\'s label and blur hides it', async () => {
    await mount(props());
    const flag = screen.getAllByRole('button')[2];
    // jsdom does not model :focus-visible, so say the focus came from the keyboard.
    jest.spyOn(flag, 'matches').mockReturnValue(true);
    await act(async () => {
      fireEvent.focusIn(flag);
      jest.advanceTimersByTime(10);
    });
    expect(screen.getByRole('tooltip').textContent).toBe('Flag');
    await act(async () => {
      fireEvent.focusOut(flag);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  test('labels follow the state of the entry', async () => {
    await mount(props({ starred: 1, status: 'flagged' }));
    const buttons = screen.getAllByRole('button');
    expect(buttons[1].getAttribute('aria-label')).toBe('Remove star');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[2].getAttribute('aria-label')).toBe('Remove flag');
  });

  test('an entry in the Trash offers Restore and Delete permanently', async () => {
    await mount(props({ status: 'trash' }));
    const labels = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['View', 'Star', 'Flag', 'Restore', 'Delete permanently']);
  });

  test('clicking an icon acts on its entry and does not open the row', async () => {
    const p = props();
    const rowClick = jest.fn();
    await act(async () => {
      render(
        createElement('div', { onClick: rowClick }, createElement(SubmissionRowActions, p)),
        host
      );
    });
    const buttons = screen.getAllByRole('button');
    await act(async () => {
      fireEvent.click(buttons[1]);
      fireEvent.click(buttons[3]);
    });
    expect(p.onMark).toHaveBeenCalledWith(7, 'star');
    expect(p.onTrash).toHaveBeenCalledWith(7);
    expect(rowClick).not.toHaveBeenCalled();
  });
});

describe('tooltipPosition', () => {
  const rect = { top: 100, bottom: 128, left: 200, width: 28 };
  test('centres above the button', () => {
    expect(tooltipPosition(rect, { width: 60, height: 24 }, { width: 1000 })).toEqual({ top: 70, left: 184 });
  });
  test('goes below when there is no room above, and stays inside the window', () => {
    const pos = tooltipPosition({ top: 2, bottom: 30, left: 4, width: 28 }, { width: 100, height: 24 }, { width: 300 });
    expect(pos.top).toBe(36);
    expect(pos.left).toBe(4);
    expect(tooltipPosition({ ...rect, left: 290 }, { width: 100, height: 24 }, { width: 300 }).left).toBe(196);
  });
});
