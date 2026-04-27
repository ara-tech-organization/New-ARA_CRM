/* eslint-disable no-console */
// Post-build obfuscation pass for the production bundle.
// Runs after `react-scripts build`. Rewrites every JS file under
// build/static/js/ in place. Tuned so:
//   - heavy settings apply only to smaller (app-code) chunks
//   - light settings apply to large vendor chunks to keep build time sane
//   - known-safe defaults that don't break React 19 / MUI / Recharts

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const JS_DIR = path.resolve(__dirname, '..', 'build', 'static', 'js');
const SIZE_THRESHOLD = 500 * 1024; // 500 KB — above this, use light options

const lightOptions = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: false,
  shuffleStringArray: true,
  splitStrings: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

const heavyOptions = {
  ...lightOptions,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  selfDefending: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  numbersToExpressions: true,
};

if (!fs.existsSync(JS_DIR)) {
  console.error(`[obfuscate] Missing directory: ${JS_DIR}`);
  console.error('[obfuscate] Run "npm run build:raw" (or "react-scripts build") first.');
  process.exit(1);
}

const jsFiles = fs
  .readdirSync(JS_DIR)
  .filter((f) => f.endsWith('.js'))
  // Skip LICENSE.txt companions and any stray source maps
  .filter((f) => !f.endsWith('.LICENSE.txt') && !f.endsWith('.map'));

if (jsFiles.length === 0) {
  console.warn('[obfuscate] No .js files found under build/static/js/ — nothing to do.');
  process.exit(0);
}

console.log(`[obfuscate] Processing ${jsFiles.length} JS file(s) in build/static/js/`);

let totalIn = 0;
let totalOut = 0;
const overallStart = Date.now();

for (const file of jsFiles) {
  const fullPath = path.join(JS_DIR, file);
  const src = fs.readFileSync(fullPath, 'utf8');
  const inSize = Buffer.byteLength(src, 'utf8');
  const opts = inSize > SIZE_THRESHOLD ? lightOptions : heavyOptions;
  const preset = opts === heavyOptions ? 'heavy' : 'light';
  const started = Date.now();

  try {
    const obfuscated = JavaScriptObfuscator.obfuscate(src, opts).getObfuscatedCode();
    fs.writeFileSync(fullPath, obfuscated);
    const outSize = Buffer.byteLength(obfuscated, 'utf8');
    totalIn += inSize;
    totalOut += outSize;
    const kIn = (inSize / 1024).toFixed(1);
    const kOut = (outSize / 1024).toFixed(1);
    const took = Date.now() - started;
    console.log(`  ${file.padEnd(42)} ${preset.padEnd(5)} ${kIn.padStart(8)} KB -> ${kOut.padStart(8)} KB  (${took} ms)`);
  } catch (err) {
    console.error(`  ${file} — FAILED: ${err.message}`);
    process.exit(1);
  }
}

const totalIns = (totalIn / 1024 / 1024).toFixed(2);
const totalOuts = (totalOut / 1024 / 1024).toFixed(2);
const ratio = totalIn > 0 ? ((totalOut / totalIn) * 100).toFixed(0) : '—';
const seconds = ((Date.now() - overallStart) / 1000).toFixed(1);

console.log('');
console.log(`[obfuscate] Done in ${seconds}s. Total: ${totalIns} MB -> ${totalOuts} MB (${ratio}% of original)`);
