/** @type { import('@storybook/react-webpack5').StorybookConfig } */
const config = {
  stories: ['../resources/**/*.stories.@(js|jsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  webpackFinal: async (sbConfig) => {
    // --- SCSS support ---
    sbConfig.module.rules.push({
      test: /\.scss$/,
      use: ['style-loader', 'css-loader', 'sass-loader'],
    });

    // --- Alias @wordpress/* to lightweight mocks ---
    sbConfig.resolve.alias = {
      ...sbConfig.resolve.alias,
      '@wordpress/api-fetch': require.resolve('./mocks/api-fetch.js'),
      '@wordpress/i18n': require.resolve('./mocks/i18n.js'),
      '@wordpress/url': require.resolve('./mocks/url.js'),
      // element → React (already handled by Storybook, but make explicit)
      '@wordpress/element': require.resolve('./mocks/element.js'),
      // components → stubs (avoid loading full Gutenberg)
      '@wordpress/components': require.resolve('./mocks/components.js'),
      '@wordpress/data': require.resolve('./mocks/data.js'),
    };

    return sbConfig;
  },
};

module.exports = config;
