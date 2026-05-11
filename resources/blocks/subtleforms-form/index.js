import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';
import Edit from './edit.jsx';
import save from './save.js';

registerBlockType(metadata.name, {
	...metadata,
	edit: Edit,
	save,
});
