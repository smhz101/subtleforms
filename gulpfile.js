const { src, dest, series } = require('gulp');
const zip = require('gulp-zip');
const fs = require('fs');
const path = require('path');

// Plugin configuration
const PLUGIN_NAME = 'subtleforms';
const DIST_DIR = 'dist';
const TEMP_DIR = `${DIST_DIR}/temp`;

// Get version from PHP file
function getPluginVersion() {
  try {
    const content = fs.readFileSync('./subtleforms.php', 'utf8');
    const versionMatch = content.match(/Version:\s*(.+)/);
    if (versionMatch) {
      return versionMatch[1].trim();
    }
    return '1.1.36';
  } catch (err) {
    console.log('Could not read version from subtleforms.php, using default: 1.1.36');
    return '1.1.36';
  }
}

// Clean dist directory
function cleanDist(cb) {
  const rimrafSync = require('rimraf').sync;
  try {
    rimrafSync(`${DIST_DIR}/*.zip`);
    rimrafSync(TEMP_DIR);
    cb();
  } catch (err) {
    cb(err);
  }
}

// Ensure dist directory exists
function ensureDistDir(cb) {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }
  cb();
}

// Copy files to temp directory with proper structure
function copyFilesToTemp() {
  const version = getPluginVersion();
  console.log(`\nPreparing files for ${PLUGIN_NAME}-${version}.zip`);
  console.log(`Files will extract to: ${PLUGIN_NAME}/\n`);

  return src(
    [
      // Core plugin files
      'subtleforms.php',
      'license.txt',
      'readme.html',

      // Built assets
      'build/**/*',

      // Source code (CRITICAL: includes CaptchaManager and all PHP classes)
      'src/**/*',

      // Composer autoloader (CRITICAL: required for class autoloading)
      'vendor/autoload.php',
      'vendor/composer/**/*',

      // Templates and assets
      'templates/**/*',
      'assets/**/*',

      // Exclude built tailwind source
      '!assets/css/tailwind.css',

      // Exclude development files
      '!node_modules/**',
      '!resources/**',
      '!tests/**',
      '!.git/**',
      '!dist/**',
      '!gulpfile.js',
      '!package*.json',
      '!.*',

      // Exclude dev dependencies from vendor
      '!vendor/bin/**',
      '!vendor/phpunit/**',
      '!vendor/sebastian/**',
      '!vendor/phar-io/**',
      '!vendor/myclabs/**',
      '!vendor/doctrine/**',
      '!vendor/nikic/**',
      '!vendor/theseer/**',
      '!vendor/yoast/**',
    ],
    {
      base: '.',
      allowEmpty: true,
      dot: false,
    }
  )
    .on('data', (file) => {
      console.log('Including:', file.relative);
    })
    .pipe(dest(`${TEMP_DIR}/${PLUGIN_NAME}`));
}

// Create production zip from temp directory
function createZip() {
  const version = getPluginVersion();
  const zipName = `${PLUGIN_NAME}-${version}.zip`;

  console.log(`\nCreating zip archive: ${zipName}`);

  return src(`${TEMP_DIR}/${PLUGIN_NAME}/**/*`, {
    base: TEMP_DIR,
    dot: true,
  })
    .pipe(zip(zipName))
    .pipe(dest(DIST_DIR))
    .on('end', () => {
      console.log(`\n✓ Zip created: ${DIST_DIR}/${zipName}`);
      console.log(`✓ When extracted, files will be in: ${PLUGIN_NAME}/\n`);
    });
}

// Clean up temp directory
function cleanTemp(cb) {
  const rimrafSync = require('rimraf').sync;
  try {
    rimrafSync(TEMP_DIR);
    cb();
  } catch (err) {
    cb(err);
  }
}

// Build production assets
function buildProduction() {
  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    console.log('Building production assets...');

    const build = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      shell: true,
    });

    build.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Build failed with code ${code}`));
        return;
      }
      console.log('Production assets built successfully');
      resolve();
    });

    build.on('error', (err) => {
      reject(err);
    });
  });
}

// Main tasks
const build = series(buildProduction);
const packageZip = series(ensureDistDir, cleanDist, copyFilesToTemp, createZip, cleanTemp);
const dist = series(buildProduction, packageZip);
const quickZip = series(ensureDistDir, cleanDist, copyFilesToTemp, createZip, cleanTemp);

// Export tasks
exports.clean = cleanDist;
exports.build = build;
exports.zip = packageZip;
exports.quickZip = quickZip; // Create zip without building
exports.dist = dist;
exports.default = dist;

// Show help
exports.help = function (cb) {
  console.log(`
Available tasks:
  gulp build     - Build production assets
  gulp clean     - Clean dist directory
  gulp zip       - Create production zip (without building)
  gulp quickZip  - Create production zip (without building)
  gulp dist      - Full production build and zip (default)
  gulp help      - Show this help message

The production zip will be created as: ${PLUGIN_NAME}-v${getPluginVersion()}.zip
  `);
  cb();
};
