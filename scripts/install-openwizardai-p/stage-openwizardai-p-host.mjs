#!/usr/bin/env node
/**
 * Stage the openwizardai-p hosted-installer artifacts.
 *
 * Produces, under dist/install/, the exact set of files to upload to
 * https://github.com/manoelpanev/OpenWizardAI :
 *
 *   openwizardai-p.js            the bundled wrapper (built fresh by build-openwizardai-p.mjs)
 *   openwizardai-p.package.json  pinned node-pty manifest, version stamped from package.json
 *   openwizardai-p.sh            Linux/macOS installer  (curl ... | sh)
 *   openwizardai-p.ps1           Windows installer       (irm ... | iex)
 *
 * Run: node scripts/install/stage-openwizardai-p-host.mjs
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..', '..');
const outDir = path.join(rootDir, 'dist', 'install');

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version;
if (!version) throw new Error('package.json has no "version"');

// 1. Build the bundle.
console.log('Building openwizardai-p bundle...');
execFileSync(process.execPath, [path.join(rootDir, 'scripts', 'build-openwizardai-p.mjs')], {
	stdio: 'inherit',
});

fs.mkdirSync(outDir, { recursive: true });

// 2. Copy the bundle.
const bundleSrc = path.join(rootDir, 'dist', 'cli', 'openwizardai-p.js');
fs.copyFileSync(bundleSrc, path.join(outDir, 'openwizardai-p.js'));

// 3. Stamp the version into the hosted package.json.
const manifest = JSON.parse(
	fs.readFileSync(path.join(here, 'openwizardai-p.package.json'), 'utf8')
);
manifest.version = version;
fs.writeFileSync(
	path.join(outDir, 'openwizardai-p.package.json'),
	JSON.stringify(manifest, null, '\t') + '\n'
);

// 4. Copy the installer scripts under their hosted names.
fs.copyFileSync(
	path.join(here, 'openwizardai-p-install.sh'),
	path.join(outDir, 'openwizardai-p.sh')
);
fs.copyFileSync(
	path.join(here, 'openwizardai-p-install.ps1'),
	path.join(outDir, 'openwizardai-p.ps1')
);

console.log(
	`\nStaged openwizardai-p ${version} installer artifacts in ${path.relative(rootDir, outDir)}/:`
);
for (const f of fs.readdirSync(outDir).sort()) {
	const size = (fs.statSync(path.join(outDir, f)).size / 1024).toFixed(1);
	console.log(`  ${f}  (${size} KB)`);
}
console.log(
	'\nUpload these to https://github.com/manoelpanev/OpenWizardAI to make the one-liners live:'
);
console.log('  curl -fsSL https://github.com/manoelpanev/OpenWizardAI | sh');
console.log('  irm https://github.com/manoelpanev/OpenWizardAI | iex');
