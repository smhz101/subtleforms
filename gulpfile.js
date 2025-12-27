const { src, dest, series } = require('gulp');
const zip = require('gulp-zip');
const fs = require('fs');

// Plugin configuration
const PLUGIN_NAME = 'subtleforms';
const DIST_DIR = 'dist';

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

// Create production zip
function createZip() {
  const version = getPluginVersion();
  const zipName = `${PLUGIN_NAME}-v${version}.zip`;

  console.log(`Creating production zip: ${zipName}`);
  console.log(`Files to include:`);

  return src(
    [
      // Core plugin files
      'subtleforms.php',
      'license.txt',
      'readme.html',

      // Built assets
      'build/**/*',

      // Source code
      'src/**/*',

      // Templates and assets
      'templates/**/*',
      'assets/**/*',

      // Exclude built tailwind source
      '!assets/css/tailwind.css',
    ],
    {
      base: '.',
      allowEmpty: true,
    }
  )
    .on('data', (file) => {
      console.log('Including:', file.relative);
    })
    .pipe(zip(zipName))
    .pipe(dest(DIST_DIR));
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
const dist = series(ensureDistDir, cleanDist, build, createZip);
const quickZip = series(ensureDistDir, cleanDist, createZip);

// Export tasks
exports.clean = cleanDist;
exports.build = build;
exports.zip = createZip;
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
