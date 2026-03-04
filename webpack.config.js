/**
 * Custom webpack configuration for SubtleForms
 * Extends @wordpress/scripts default config to enable:
 * - Source maps for debugging
 * - Named chunk splitting (vendor, dndkit, joi)
 * - Bundle analysis via ANALYZE=true env var
 */

const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

// Check if we should run the analyzer
const shouldAnalyze = process.env.ANALYZE === 'true';

module.exports = {
	...defaultConfig,
	// Enable source maps for easier debugging
	devtool: 'source-map',
	output: {
		...defaultConfig.output,
		// Named content-hash filenames for async/lazy chunks
		chunkFilename: '[name].[contenthash:8].js',
		// Let webpack determine the public path at runtime
		// (resolved via __webpack_public_path__ set in PHP)
		publicPath: 'auto',
	},
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
	optimization: {
		...defaultConfig.optimization,
		splitChunks: {
			chunks: 'async',
			cacheGroups: {
				// Vendor chunk: react, react-dom, react-router, react-query, utilities
				// Only split from async (lazy-loaded) chunks to avoid conflicts with named entries
				vendor: {
					test: /[\\/]node_modules[\\/](react|react-dom|react-router|@tanstack[\\/]react-query|clsx|nanoid)[\\/]/,
					name: 'vendors',
					chunks: 'async',
					priority: 20,
					reuseExistingChunk: true,
				},
				// DnD Kit: heavy library only needed in form builder
				dndkit: {
					test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
					name: 'vendor-dndkit',
					chunks: 'async',
					priority: 15,
					reuseExistingChunk: true,
				},
				// Joi: validation library needed in builder + settings
				joi: {
					test: /[\\/]node_modules[\\/]joi[\\/]/,
					name: 'vendor-joi',
					chunks: 'async',
					priority: 15,
					reuseExistingChunk: true,
				},
			},
		},
	},
	// Add bundle analyzer plugin if enabled
	plugins: [
		...defaultConfig.plugins,
		...(shouldAnalyze
			? [
					new BundleAnalyzerPlugin({
						analyzerMode: 'static',
						reportFilename: '../bundle-report.html',
						openAnalyzer: true,
						generateStatsFile: true,
						statsFilename: '../bundle-stats.json',
					}),
			  ]
			: []),
	],
};

