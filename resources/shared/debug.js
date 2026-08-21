/**
 * Development-only logging.
 *
 * `process.env.NODE_ENV` is replaced with a string literal at build time by
 * webpack's DefinePlugin, so in a production build the condition folds to
 * `false` and the minifier drops the body. Nothing is logged on a public page.
 *
 * The comparison is written inline rather than behind a helper so the bundler
 * can fold it statically — wrapping it in another function defeats that.
 *
 * Genuine problems should keep using `console.warn` / `console.error`, which
 * are meant to surface in production.
 */

export const debug = ( ...args ) => {
  if ( process.env.NODE_ENV !== 'production' ) {
    // eslint-disable-next-line no-console
    console.log( ...args );
  }
};

export default debug;
