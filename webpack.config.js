/**
 * Custom webpack configuration for SubtleForms
 * Extends @wordpress/scripts default config to enable:
 * - Source maps for debugging
 * - Named chunk splitting (vendor, dndkit, joi)
 * - Bundle analysis via ANALYZE=true env var
 */

const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const MiniCSSExtractPlugin = require('mini-css-extract-plugin');
const inheritThemeScope = require('./bin/postcss/inherit-theme-scope');

// Check if we should run the analyzer
const shouldAnalyze = process.env.ANALYZE === 'true';

/**
 * Writes chunks.json next to the bundle: the file of every named lazy chunk
 * (for example "field-date" => "field-date.1a2b3c4d.js"). The front end reads
 * it to let the browser fetch a form's field code from the page head, in
 * parallel with the main script (2.6.0, FrontendAssets::preloadFieldCode).
 */
class ChunkManifestPlugin {
	apply(compiler) {
		compiler.hooks.thisCompilation.tap('ChunkManifestPlugin', (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'ChunkManifestPlugin',
					stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
				},
				() => {
					const manifest = {};
					for (const chunk of compilation.chunks) {
						if (!chunk.name || chunk.canBeInitial()) {
							continue;
						}
						const js = [...chunk.files].find((file) => file.endsWith('.js'));
						if (js) {
							manifest[chunk.name] = js;
						}
					}
					const sorted = Object.fromEntries(Object.entries(manifest).sort());
					compilation.emitAsset(
						'chunks.json',
						new compiler.webpack.sources.RawSource(JSON.stringify(sorted, null, '\t') + '\n')
					);
				}
			);
		});
	}
}

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
						if (
							typeof loader === 'object' &&
							loader.loader &&
							loader.loader.includes('postcss-loader') &&
							loader.options?.postcssOptions
						) {
							// "Inherit from theme" forms get no visual CSS from the
							// plugin; see bin/postcss/inherit-theme-scope.js.
							return {
								...loader,
								options: {
									...loader.options,
									sourceMap: true,
									postcssOptions: {
										...loader.options.postcssOptions,
										plugins: [
											inheritThemeScope(),
											...(loader.options.postcssOptions.plugins || []),
										],
									},
								},
							};
						}
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
	// Webpack's default 244 KiB hint counts the RTL stylesheet as a second
	// entry asset, and the form builder is one admin-only chunk.
	performance: {
		...defaultConfig.performance,
		maxAssetSize: 512 * 1024,
		maxEntrypointSize: 800 * 1024,
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
	// Add bundle analyzer plugin if enabled, and override MiniCSSExtractPlugin
	// to use content-hashed chunk filenames so CSS splits get proper cache busting.
	plugins: [
		...defaultConfig.plugins.filter((p) => !(p instanceof MiniCSSExtractPlugin)),
		new ChunkManifestPlugin(),
		new MiniCSSExtractPlugin({
			filename: '[name].css',
			chunkFilename: '[name].[contenthash:8].css',
		}),
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

