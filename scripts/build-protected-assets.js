const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const CleanCSS = require('clean-css');

const publicDir = path.join(__dirname, '..', 'public');
const cssPath = path.join(publicDir, 'css', 'style.css');
const minCssPath = path.join(publicDir, 'css', 'style.min.css');
const jsPath = path.join(publicDir, 'js', 'app.js');
const minJsPath = path.join(publicDir, 'js', 'app.min.js');

// 1. Minify CSS with CleanCSS + Add anti-selection protection
console.log('Building protected CSS...');
let rawCss = fs.readFileSync(cssPath, 'utf8');

const antiSelectCss = `
/* Global Protection */
body {
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  user-select: none !important;
  -webkit-touch-callout: none !important;
}
input, textarea, select {
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  user-select: text !important;
}
`;

rawCss = antiSelectCss + '\n' + rawCss;
const cleanCssResult = new CleanCSS({ level: 2 }).minify(rawCss);
fs.writeFileSync(minCssPath, cleanCssResult.styles, 'utf8');
console.log('CSS minified:', cleanCssResult.styles.length, 'bytes');

// 2. Build Protected & Obfuscated JS
console.log('Building protected JS with high-grade obfuscation...');
let rawJs = fs.readFileSync(jsPath, 'utf8');

// Ensure strict anti-devtools and anti-right-click traps are prepended
const securityShield = `
(function() {
  'use strict';
  // 1. Disable all context menu unconditionally across entire window
  window.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, true);

  // 2. Disable all inspection shortcuts
  window.addEventListener('keydown', function(e) {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) ||
      (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c','K','k'].includes(e.key)) ||
      (e.metaKey && e.altKey && ['I','i','J','j','U','u','C','c'].includes(e.key))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  // 3. Active Anti-DevTools Debugger Trap
  var devtoolsDetector = function() {
    function trap() {
      try {
        (function() {
          (function a() {
            try {
              (function b(i) {
                if (('' + (i / i)).length !== 1 || i === 0) {
                  (function() {}).constructor('debugger')();
                } else {
                  (function() {}).constructor('debugger')();
                }
                b(++i);
              })(0);
            } catch (err) {
              setTimeout(a, 50);
            }
          })();
        })();
      } catch (err) {}
    }
    trap();
  };

  setInterval(devtoolsDetector, 800);
})();
`;

// Merge clean JS without redundant old headers
let cleanAppJs = rawJs.replace(/\/\/ United Finance Security[\s\S]*?\}\)\(\);\s*/, '');
const fullCodeToObfuscate = securityShield + '\n\n' + cleanAppJs;

const obfuscationResult = JavaScriptObfuscator.obfuscate(fullCodeToObfuscate, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.8,
  numbersToExpressions: true,
  simplify: true,
  stringArray: true,
  stringArrayEncoding: ['base64', 'rc4'],
  stringArrayThreshold: 0.85,
  splitStrings: true,
  splitStringsChunkLength: 8,
  selfDefending: true,
  debugProtection: true,
  debugProtectionInterval: 2000,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal'
});

const obfuscatedCode = obfuscationResult.getObfuscatedCode();

// Also remove readable source app.js or replace it with protected version
fs.writeFileSync(minJsPath, obfuscatedCode, 'utf8');
fs.writeFileSync(jsPath, obfuscatedCode, 'utf8');

console.log('JS successfully obfuscated & protected!');
console.log('Obfuscated JS size:', obfuscatedCode.length, 'bytes');
