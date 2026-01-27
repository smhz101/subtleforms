/**
 * Custom webpack configuration for SubtleForms
 * Extends @wordpress/scripts default config to enable source maps
 */

const defaultConfig = require('@wordpress/scripts/config/webpack.config');

module.exports = {
	...defaultConfig,
	// Enable source maps for easier debugging
	devtool: 'source-map',
	// Enable CSS source maps
	module: {
		...defaultConfig.module,
		rules: defaultConfig.module.rules.map((rule) => {
			// Enable source maps for CSS/SCSS
			if (rule.use && Array.isArray(rule.use)) {
				return {
					...rule,
					use: rule.use.map((loader) => {
						if (typeof loader === 'object' && loader.loader) {
							// Enable source maps for css-loader and sass-loader
							if (
								loader.loader.includes('css-loader') ||
								loader.loader.includes('sass-loader') ||
								loader.loader.includes('postcss-loader')
							) {
								return {
									...loader,
									options: {
										...loader.options,
										sourceMap: true,
									},
								};
							}
						}
						return loader;
					}),
				};
			}
			return rule;
		}),
	},
};
