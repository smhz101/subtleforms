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
      attributes: {
        ...metadata.attributes,
        ajax: { type: 'boolean', default: false },
      },
      save: saveBefore281,
      // Reached only when the markup no longer matches the new default, that
      // is a block saved without an ajax attribute: it follows the new default.
      migrate: (attributes) => ({ ...attributes, ajax: true }),
    },
  ],
});
