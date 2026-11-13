#!/usr/bin/env node
/**
 * Moves the picker stylesheet out of its temporary build folder.
 *
 * The date, time and dropdown pickers have their own stylesheet,
 * build/frontend/picker.css (and picker-rtl.css), so a page prints it for any
 * form with a picker, also a form that inherits the theme and therefore skips
 * the main stylesheet (2.9.0). `npm run build:picker` builds it into
 * build/picker-tmp because webpack cleans the folder it writes to; this step
 * copies the two stylesheets next to the front-end bundle and removes the
 * temporary folder, with the empty script webpack also writes.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const from = path.join(root, 'build', 'picker-tmp');
const to = path.join(root, 'build', 'frontend');

fs.mkdirSync(to, { recursive: true });
for (const file of ['picker.css', 'picker-rtl.css', 'picker.css.map']) {
  const source = path.join(from, file);
  if (!fs.existsSync(source)) {
    console.error(`Missing ${path.relative(root, source)}. Run: npm run build:picker`);
    process.exit(1);
  }
  fs.copyFileSync(source, path.join(to, file));
}
fs.rmSync(from, { recursive: true, force: true });
console.log('Picker stylesheet: build/frontend/picker.css');
