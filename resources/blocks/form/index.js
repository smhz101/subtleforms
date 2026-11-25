/**
 * SubtleForms Block Registration
 *
 * Registers the subtleforms/form block for Gutenberg editor.
 */
import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';
import Edit from './edit.jsx';
import save from './save.js';
import saveBefore281 from './deprecated.js';
import icon from './icon.jsx';

/**
 * Register the block
 */
registerBlockType(metadata.name, {
  ...metadata,
  icon,
  edit: Edit,
  save,
  deprecated: [
    {
      attributes: metadata.attributes,
      // A deprecation starts with no supports and the oldest apiVersion: without
      // these the editor adds its own class to the old markup and it never
      // validates.
      supports: metadata.supports,
      apiVersion: metadata.apiVersion,
      save: saveBefore281,
      // Reached only when the markup no longer matches the new default, that
      // is a block saved without an ajax attribute: it follows the new default.
      migrate: (attributes) => ({ ...attributes, ajax: true }),
    },
    {
      attributes: metadata.attributes,
      supports: metadata.supports,
      apiVersion: metadata.apiVersion,
      // A block written as a self-closing comment (by hand, WP-CLI, the REST
      // API or a pattern) has no saved markup. The server renders it from its
      // attributes, so empty content is valid and the editor writes the
      // current markup the next time the page is saved.
      save: () => null,
    },
  ],
});
