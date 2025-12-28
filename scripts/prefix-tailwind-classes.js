/**
 * Script to add 'sf-' prefix to all Tailwind utility classes
 *
 * Usage: node scripts/prefix-tailwind-classes.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Common Tailwind utility patterns
// These are the most common Tailwind prefixes that need the sf- prefix
const tailwindPrefixes = [
  // Layout
  'container',
  'flex',
  'grid',
  'block',
  'inline',
  'hidden',
  'table',
  'flow',
  'contents',

  // Flexbox & Grid
  'basis',
  'shrink',
  'grow',
  'order',
  'col',
  'row',
  'auto-cols',
  'auto-rows',
  'gap',

  // Spacing
  'p-',
  'px-',
  'py-',
  'pt-',
  'pr-',
  'pb-',
  'pl-',
  'm-',
  'mx-',
  'my-',
  'mt-',
  'mr-',
  'mb-',
  'ml-',
  'space-',

  // Sizing
  'w-',
  'h-',
  'min-w-',
  'min-h-',
  'max-w-',
  'max-h-',

  // Typography
  'text-',
  'font-',
  'leading-',
  'tracking-',
  'line-clamp-',
  'truncate',
  'overflow-ellipsis',
  'overflow-clip',

  // Backgrounds
  'bg-',

  // Borders
  'border',
  'divide-',
  'outline-',
  'ring-',

  // Effects
  'shadow-',
  'opacity-',
  'mix-blend-',
  'bg-blend-',

  // Filters
  'blur-',
  'brightness-',
  'contrast-',
  'grayscale',
  'hue-rotate-',
  'invert',
  'saturate-',
  'sepia',
  'backdrop-',

  // Transitions
  'transition',
  'duration-',
  'ease-',
  'delay-',
  'animate-',

  // Transforms
  'scale-',
  'rotate-',
  'translate-',
  'skew-',
  'origin-',

  // Interactivity
  'cursor-',
  'pointer-events-',
  'resize',
  'scroll-',
  'snap-',
  'touch-',
  'select-',
  'will-change-',

  // SVG
  'fill-',
  'stroke-',

  // Accessibility
  'sr-only',
  'not-sr-only',

  // Positioning
  'static',
  'fixed',
  'absolute',
  'relative',
  'sticky',
  'inset-',
  'top-',
  'right-',
  'bottom-',
  'left-',
  'z-',

  // Display & Visibility
  'visible',
  'invisible',

  // Overflow
  'overflow-',

  // Position & Transform
  'object-',
  'overscroll-',

  // Flex utilities
  'items-',
  'content-',
  'justify-',
  'place-',
  'self-',

  // List
  'list-',

  // Appearance
  'appearance-',
];

// Classes that should NOT be prefixed
const excludePatterns = [
  /^subtleforms-/,
  /^components-/,
  /^wp-/,
  /^is-/,
  /^has-/,
  /^empty:/,
  /^hover:/,
  /^focus:/,
  /^active:/,
  /^group-/,
  /^peer-/,
  /^\[/, // Arbitrary values like [100px]
];

/**
 * Check if a class should be prefixed
 */
function shouldPrefix(className) {
  // Skip if already prefixed
  if (className.startsWith('sf-')) {
    return false;
  }

  // Skip excluded patterns
  for (const pattern of excludePatterns) {
    if (pattern.test(className)) {
      return false;
    }
  }

  // Check if it matches Tailwind patterns
  for (const prefix of tailwindPrefixes) {
    if (className === prefix || className.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  let changeCount = 0;

  // Match className attributes with single or double quotes
  const classNameRegex = /className\s*=\s*(['"`])((?:(?!\1).)*)\1/g;

  modified = content.replace(classNameRegex, (match, quote, classString) => {
    // Split classes and process each one
    const classes = classString.split(/\s+/);
    const processedClasses = classes.map((cls) => {
      if (shouldPrefix(cls)) {
        changeCount++;
        return 'sf-' + cls;
      }
      return cls;
    });

    return `className=${quote}${processedClasses.join(' ')}${quote}`;
  });

  if (changeCount > 0) {
    fs.writeFileSync(filePath, modified, 'utf8');
    console.log(`✓ ${path.relative(process.cwd(), filePath)}: ${changeCount} classes prefixed`);
  }

  return changeCount;
}

// Main execution
const pattern = 'resources/admin/**/*.jsx';
const files = glob.sync(pattern);

console.log(`Found ${files.length} JSX files to process...\\n`);

let totalChanges = 0;
let filesModified = 0;

files.forEach((file) => {
  const changes = processFile(file);
  if (changes > 0) {
    totalChanges += changes;
    filesModified++;
  }
});

console.log(`\\n✅ Complete!`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total classes prefixed: ${totalChanges}`);
