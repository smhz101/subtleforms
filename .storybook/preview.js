import '../resources/admin/styles/main.scss';

/** @type { import('@storybook/react').Preview } */
const preview = {
  decorators: [
    (Story) => (
      <div id="wpbody-content">
        <div className="subtleforms-admin">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'label', enabled: true },
        ],
      },
    },
    backgrounds: {
      default: 'wp-admin',
      values: [
        { name: 'wp-admin', value: '#f0f0f1' },
        { name: 'white', value: '#ffffff' },
        { name: 'dark', value: '#1e1e1e' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
