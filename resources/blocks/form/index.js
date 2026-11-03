/**
 * SubtleForms Block Registration
 *
 * Registers the subtleforms/form block for Gutenberg editor.
 */
import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';
import Edit from './edit.jsx';
import save from './save.js';
import icon from './icon.jsx';

/**
 * Register the block
 */
registerBlockType(metadata.name, {
  ...metadata,
  icon,
  edit: Edit,
  save,
});
