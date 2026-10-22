import { createRoot } from '@wordpress/element';
import { act } from 'react';
import ConfirmationText from './ConfirmationText';
import { messageParagraphs } from '../../shared/safeLinks';

global.IS_REACT_ACT_ENVIRONMENT = true;

function render(text) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<ConfirmationText paragraphs={messageParagraphs(text)} />));
  return { container, unmount: () => act(() => root.unmount()) };
}

test('draws safe links as anchors with rel noopener', () => {
  const { container, unmount } = render('See [the docs](https://example.com/docs) or https://example.org/x.\n\nOr [home](/).');
  const links = container.querySelectorAll('a');
  expect(links).toHaveLength(3);
  expect(links[0].getAttribute('href')).toBe('https://example.com/docs');
  expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
  expect(links[0].getAttribute('target')).toBe('_blank');
  expect(links[2].getAttribute('href')).toBe('/');
  expect(links[2].getAttribute('target')).toBeNull();
  expect(container.querySelectorAll('p')).toHaveLength(2);
  unmount();
});

test('a javascript: link is not drawn as a link and no markup gets in', () => {
  const { container, unmount } = render('[bad](javascript:alert(1)) <b>bold</b> <img src=x onerror=alert(1)>');
  expect(container.querySelectorAll('a')).toHaveLength(0);
  expect(container.querySelectorAll('b, img')).toHaveLength(0);
  expect(container.textContent).toContain('<b>bold</b>');
  unmount();
});
