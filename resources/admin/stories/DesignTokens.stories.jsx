/**
 * Design Tokens — Foundation Story
 * Documents all CSS custom properties available in SubtleForms.
 */

export default {
  title: 'Foundation/Design Tokens',
  tags: ['autodocs'],
};

const tokenGroups = [
  {
    name: 'Brand / Primary',
    tokens: [
      '--sf-primary',
      '--sf-primary-hover',
      '--sf-primary-active',
      '--sf-primary-light',
    ],
  },
  {
    name: 'Semantic',
    tokens: [
      '--sf-text',
      '--sf-text-secondary',
      '--sf-text-muted',
      '--sf-bg',
      '--sf-bg-secondary',
      '--sf-border',
      '--sf-border-light',
    ],
  },
  {
    name: 'Feedback',
    tokens: [
      '--sf-success',
      '--sf-success-bg',
      '--sf-error',
      '--sf-error-bg',
      '--sf-warning',
      '--sf-warning-bg',
      '--sf-info',
      '--sf-info-bg',
    ],
  },
];

function ColorSwatch({ token }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 8,
          background: `var(${token})`,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,.08)',
        }}
      />
      <code style={{ fontSize: 11, color: '#64748b', textAlign: 'center', maxWidth: 100, wordBreak: 'break-all' }}>
        {token}
      </code>
    </div>
  );
}

export const Colors = () => (
  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
    {tokenGroups.map((group) => (
      <div key={group.name}>
        <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#374151' }}>{group.name}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 20 }}>
          {group.tokens.map((token) => (
            <ColorSwatch key={token} token={token} />
          ))}
        </div>
      </div>
    ))}
  </div>
);

const spacingTokens = [
  ['--sf-space-1', '4px'],
  ['--sf-space-2', '8px'],
  ['--sf-space-3', '12px'],
  ['--sf-space-4', '16px'],
  ['--sf-space-6', '24px'],
  ['--sf-space-8', '32px'],
  ['--sf-space-12', '48px'],
  ['--sf-space-16', '64px'],
];

export const Spacing = () => (
  <div style={{ padding: 24 }}>
    <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#374151' }}>Spacing Scale</h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {spacingTokens.map(([token, size]) => (
        <div key={token} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              height: 12,
              width: `var(${token}, ${size})`,
              background: 'var(--sf-primary, #4f46e5)',
              borderRadius: 2,
              minWidth: 4,
            }}
          />
          <code style={{ fontSize: 12, color: '#64748b' }}>{token} ({size})</code>
        </div>
      ))}
    </div>
  </div>
);

const radiusTokens = [
  ['--sf-radius-sm', '4px'],
  ['--sf-radius', '6px'],
  ['--sf-radius-md', '8px'],
  ['--sf-radius-lg', '12px'],
  ['--sf-radius-xl', '16px'],
  ['--sf-radius-full', '9999px'],
];

export const BorderRadius = () => (
  <div style={{ padding: 24 }}>
    <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#374151' }}>Border Radius Scale</h3>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
      {radiusTokens.map(([token, size]) => (
        <div key={token} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: 'var(--sf-primary-light, #e0e7ff)',
              border: '2px solid var(--sf-primary, #4f46e5)',
              borderRadius: `var(${token}, ${size})`,
            }}
          />
          <code style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
            {token}<br />({size})
          </code>
        </div>
      ))}
    </div>
  </div>
);
