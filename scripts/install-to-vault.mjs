import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

export function resolveVaultPath({ argv = [], env = {}, cwd = process.cwd() }) {
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--vault' && i + 1 < argv.length) {
			return argv[i + 1];
		}
		if (arg.startsWith('--vault=')) {
			return arg.slice('--vault='.length);
		}
	}

	if (env.OBSIDIAN_VAULT) {
		return env.OBSIDIAN_VAULT;
	}

	return join(cwd, 'test-vault');
}

export function withPluginEnabled(existingJson, id = 'obsidian-subtitles-md') {
	let plugins = [];
	
	if (existingJson && existingJson.trim()) {
		try {
			plugins = JSON.parse(existingJson);
			if (!Array.isArray(plugins)) {
				plugins = [];
			}
		} catch {
			plugins = [];
		}
	}

	if (!plugins.includes(id)) {
		plugins.push(id);
	}

	return JSON.stringify(plugins, null, 2) + '\n';
}

export function copyPluginFiles(repoRoot, pluginDir) {
	const filesToCopy = ['manifest.json', 'main.js', 'styles.css'];
	
	// Pre-flight: check all sources exist BEFORE copying anything
	const missing = [];
	for (const file of filesToCopy) {
		const source = join(repoRoot, file);
		if (!existsSync(source)) {
			missing.push(file);
		}
	}
	
	if (missing.length > 0) {
		throw new Error(`Missing source file(s): ${missing.join(', ')}`);
	}
	
	// All sources exist - safe to copy
	for (const file of filesToCopy) {
		const source = join(repoRoot, file);
		const dest = join(pluginDir, file);
		copyFileSync(source, dest);
	}
}

function main() {
	const vaultPath = resolveVaultPath({ argv: process.argv, env: process.env });
	const absoluteVaultPath = resolve(vaultPath);

	if (!existsSync(absoluteVaultPath)) {
		console.error(`Error: Vault directory does not exist: ${absoluteVaultPath}`);
		console.error('Create the vault directory first, or specify a different path with --vault');
		process.exit(1);
	}

	const pluginId = 'obsidian-subtitles-md';
	const pluginDir = join(absoluteVaultPath, '.obsidian', 'plugins', pluginId);
	mkdirSync(pluginDir, { recursive: true });

	const repoRoot = process.cwd();
	
	try {
		copyPluginFiles(repoRoot, pluginDir);
		console.log(`Copied manifest.json, main.js, styles.css → ${pluginDir}`);
	} catch (error) {
		console.error(`Error: ${error.message}`);
		console.error('Run "pnpm run build" first to generate main.js');
		process.exit(1);
	}

	const communityPluginsPath = join(absoluteVaultPath, '.obsidian', 'community-plugins.json');
	let existingContent = null;
	if (existsSync(communityPluginsPath)) {
		existingContent = readFileSync(communityPluginsPath, 'utf-8');
	}
	
	const newContent = withPluginEnabled(existingContent, pluginId);
	writeFileSync(communityPluginsPath, newContent, 'utf-8');
	console.log(`Enabled ${pluginId} in community-plugins.json`);

	console.log(`\n✓ Plugin installed to: ${absoluteVaultPath}`);
	console.log('  Reload Obsidian (Ctrl+R) or enable in Settings → Community plugins');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}
