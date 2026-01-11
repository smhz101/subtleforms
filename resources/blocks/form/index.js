/**
 * SubtleForms Block Registration
 *
 * Registers the subtleforms/form block for Gutenberg editor.
 */
import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';
import Edit from './edit.jsx';
import save from './save.js';

/**
 * Register the block
 */
registerBlockType(metadata.name, {
  ...metadata,
  edit: Edit,
  save,
});
