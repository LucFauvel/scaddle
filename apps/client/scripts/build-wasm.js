const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const wasmDir = path.join(__dirname, '..', 'src', 'openscad-wasm');

function checkDeps(isWindows) {
  const checkCmd = isWindows ? 'wsl which make' : 'which make';
  try {
    execSync(checkCmd, { stdio: 'ignore' });
  } catch {
    const installCmd = isWindows
      ? 'wsl sudo apt-get update && wsl sudo apt-get install -y build-essential'
      : 'sudo apt-get update && sudo apt-get install -y build-essential';
    console.error('\x1b[31mError: build-essential is not installed.\x1b[0m');
    console.error('\nPlease run the following command and try again:\n');
    console.error(`  \x1b[36m${installCmd}\x1b[0m\n`);
    process.exit(1);
  }
}

function fixFontconfigPatch(isWindows) {
  // Fix for fontconfig patch that fails due to upstream changes (fc-const added)
  const fontconfigMakefile = path.join(wasmDir, 'libs', 'fontconfig', 'Makefile.am');
  if (fs.existsSync(fontconfigMakefile)) {
    let content = fs.readFileSync(fontconfigMakefile, 'utf8');
    // Check if already patched
    if (content.includes('SUBDIRS=fontconfig src\n')) {
      return;
    }
    // Apply the patch manually - reduce SUBDIRS to just fontconfig and src
    content = content.replace(
      /SUBDIRS=fontconfig[^\n]+\n\t[^\n]+\n\t[^\n]+\n\t[^\n]+/,
      'SUBDIRS=fontconfig src'
    );
    // Disable fc-cache test
    content = content.replace(
      'RUN_FC_CACHE_TEST=test -z "$(DESTDIR)"',
      'RUN_FC_CACHE_TEST=false'
    );
    fs.writeFileSync(fontconfigMakefile, content);
    console.log('Applied fontconfig patch fix');
  }
}

function runMake(isWindows, wslPath) {
  const makeCmd = isWindows
    ? `wsl bash -c "cd '${wslPath}' && make"`
    : 'make';
  const opts = isWindows ? { stdio: 'inherit' } : { cwd: wasmDir, stdio: 'inherit' };
  execSync(makeCmd, opts);
}

const isWindows = process.platform === 'win32';
const wslPath = wasmDir.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);

checkDeps(isWindows);

try {
  runMake(isWindows, wslPath);
} catch (err) {
  // If make failed, check if it's the fontconfig patch issue
  const fontconfigDir = path.join(wasmDir, 'libs', 'fontconfig');
  if (fs.existsSync(fontconfigDir)) {
    console.log('\nAttempting to fix fontconfig patch issue...');
    fixFontconfigPatch(isWindows);
    // Retry make
    runMake(isWindows, wslPath);
  } else {
    throw err;
  }
}
