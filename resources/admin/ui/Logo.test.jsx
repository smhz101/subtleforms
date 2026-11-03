import { createRoot } from '@wordpress/element';
import { act } from 'react';
import Logo from './Logo';

global.IS_REACT_ACT_ENVIRONMENT = true;

const roots = [];
function render(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  roots.push({ root, container });
  return { container };
}


const setBranding = (branding) => {
  window.subtleformsAdmin = branding ? { branding } : {};
};

afterEach(() => {
  roots.splice(0).forEach(({ root, container }) => {
    act(() => root.unmount());
    container.remove();
  });
  delete window.subtleformsAdmin;
});

describe('Logo', () => {
  it('draws the new mark: two paths on a 512 grid', () => {
    const { container } = render(<Logo size={28} wordmark />);
    const svg = container.querySelector('svg.sf-logo__mark');
    expect(svg.getAttribute('viewBox')).toBe('0 0 512 512');
    expect(svg.getAttribute('width')).toBe('28');
    const paths = svg.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute('d')).toMatch(/^M0 122\.88 C0 55\.015/);
    expect(paths[1].getAttribute('d')).toMatch(/^M128\.015 217\.6 L499\.199/);
    expect(svg.querySelector('rect')).toBeNull();
  });

  it('takes its tone from --sf-logo-fg, ink by default', () => {
    const { container } = render(<Logo />);
    container.querySelectorAll('path').forEach((p) => {
      expect(p.getAttribute('fill')).toBe('var(--sf-logo-fg, #1e1e1e)');
    });
  });

  it('keeps the wordmark beside the mark', () => {
    const { container } = render(<Logo wordmark />);
    expect(container.querySelector('.sf-logo--wordmark')).not.toBeNull();
    expect(container.querySelector('.sf-logo__word').textContent).toBe('SubtleForms');
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });

  it('labels the mark when there is no wordmark', () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('SubtleForms');
  });

  it('renders a markSvg from the branding filter in place of the built-in paths', () => {
    setBranding({ markSvg: '<svg viewBox="0 0 512 512"><path fill="#3858e9" d="M0 0h8v8z"></path></svg>' });
    const { container } = render(<Logo size={32} wordmark />);
    const custom = container.querySelector('.sf-logo__mark--custom');
    expect(custom.style.width).toBe('32px');
    expect(custom.querySelector('path').getAttribute('fill')).toBe('#3858e9');
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(container.querySelector('.sf-logo__word').textContent).toBe('SubtleForms');
  });

  it('lets a custom logoUrl replace the mark, even with a markSvg', () => {
    setBranding({ logoUrl: 'https://example.com/logo.png', markSvg: '<svg><path d="M0 0"></path></svg>' });
    const { container } = render(<Logo size={28} wordmark />);
    expect(container.querySelector('img.sf-logo__image').getAttribute('src')).toBe('https://example.com/logo.png');
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.sf-logo__mark--custom')).toBeNull();
  });

  it('shows a custom name instead of the mark when there is no logo', () => {
    setBranding({ name: 'Acme Forms', markSvg: '<svg><path d="M0 0"></path></svg>' });
    const { container } = render(<Logo />);
    expect(container.querySelector('.sf-logo__word').textContent).toBe('Acme Forms');
    expect(container.querySelector('svg')).toBeNull();
  });
});
