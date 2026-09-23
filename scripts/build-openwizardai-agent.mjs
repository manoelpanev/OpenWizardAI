#!/usr/bin/env node
/**
 * Build script for the `openwizardai-agent` DeepSeek agent using esbuild.
 *
 * Bundles src/openwizardai-agent/index.ts into a single Node.js script at
 * dist/cli/openwizardai-agent.js, preserves the shebang from the entry file, and
 * marks the output executable. Mirrors scripts/build-cli.mjs.
 */

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const outfile = path.join(rootDir, 'dist/cli/openwizardai-agent.js');

const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const cliVersion = pkgJson.version;
if (typeof cliVersion !== 'string' || cliVersion.length === 0) {
	throw new Error(
		'Cannot build openwizardai-agent: package.json is missing a valid "version" field'
	);
}

async function build() {
	console.log('Building openwizardai-agent with esbuild...');

	try {
		await esbuild.build({
			entryPoints: [path.join(rootDir, 'src/openwizardai-agent/index.ts')],
			bundle: true,
			platform: 'node',
			target: 'node20',
			outfile,
			format: 'cjs',
			sourcemap: true,
			minify: false, // Keep readable for debugging
			// Shebang lives in src/openwizardai-agent/index.ts; esbuild preserves it.
			define: {
				__OPENWIZARDAI_AGENT_VERSION__: JSON.stringify(cliVersion),
			},
		});

		// Make the output executable
		fs.chmodSync(outfile, 0o755);

		const stats = fs.statSync(outfile);
		const sizeKB = (stats.size / 1024).toFixed(1);
		console.log(`✓ Built ${outfile} (${sizeKB} KB)`);
	} catch (error) {
		console.error('Build failed:', error);
		process.exit(1);
	}
}

build();
