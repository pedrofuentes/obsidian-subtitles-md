import { describe, it, expect } from 'vitest';
import { mkdtempSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveVaultPath, withPluginEnabled, copyPluginFiles } from './install-to-vault.mjs';

describe('resolveVaultPath', () => {
	it('should prioritize --vault argument over env and default', () => {
		const result = resolveVaultPath({
			argv: ['node', 'script.mjs', '--vault', 'custom-vault'],
			env: { OBSIDIAN_VAULT: 'env-vault' },
			cwd: '/some/path'
		});
		expect(result).toBe('custom-vault');
	});

	it('should support --vault=path syntax', () => {
		const result = resolveVaultPath({
			argv: ['node', 'script.mjs', '--vault=custom-vault'],
			env: { OBSIDIAN_VAULT: 'env-vault' },
			cwd: '/some/path'
		});
		expect(result).toBe('custom-vault');
	});

	it('should use OBSIDIAN_VAULT env when no --vault arg', () => {
		const result = resolveVaultPath({
			argv: ['node', 'script.mjs'],
			env: { OBSIDIAN_VAULT: 'env-vault' },
			cwd: '/some/path'
		});
		expect(result).toBe('env-vault');
	});

	it('should default to cwd/test-vault when no arg or env', () => {
		const result = resolveVaultPath({
			argv: ['node', 'script.mjs'],
			env: {},
			cwd: '/some/path'
		});
		expect(result.replace(/\\/g, '/')).toBe('/some/path/test-vault');
	});
});

describe('withPluginEnabled', () => {
	const pluginId = 'obsidian-subtitles-md';

	it('should add plugin id to null input', () => {
		const result = withPluginEnabled(null, pluginId);
		const parsed = JSON.parse(result);
		expect(parsed).toEqual([pluginId]);
		expect(result.endsWith('\n')).toBe(true);
	});

	it('should add plugin id to empty string input', () => {
		const result = withPluginEnabled('', pluginId);
		const parsed = JSON.parse(result);
		expect(parsed).toEqual([pluginId]);
	});

	it('should add plugin id to empty array', () => {
		const input = '[]';
		const result = withPluginEnabled(input, pluginId);
		const parsed = JSON.parse(result);
		expect(parsed).toEqual([pluginId]);
	});

	it('should be idempotent when plugin already exists', () => {
		const input = JSON.stringify([pluginId]);
		const result = withPluginEnabled(input, pluginId);
		const parsed = JSON.parse(result);
		expect(parsed).toEqual([pluginId]);
	});

	it('should preserve existing plugins and their order', () => {
		const input = JSON.stringify(['other-plugin', 'another-plugin']);
		const result = withPluginEnabled(input, pluginId);
		const parsed = JSON.parse(result);
		expect(parsed).toEqual(['other-plugin', 'another-plugin', pluginId]);
	});

	it('should not duplicate when plugin is in the middle', () => {
		const input = JSON.stringify(['first', pluginId, 'last']);
		const result = withPluginEnabled(input, pluginId);
		const parsed = JSON.parse(result);
		expect(parsed).toEqual(['first', pluginId, 'last']);
	});

	it('should handle malformed JSON by starting from empty array', () => {
		const result = withPluginEnabled('{malformed', pluginId);
		const parsed = JSON.parse(result);
		expect(parsed).toEqual([pluginId]);
	});
});

describe('copyPluginFiles pre-flight check', () => {
	it('should throw when a source file is missing and not copy anything', () => {
		const testDir = mkdtempSync(join(tmpdir(), 'install-test-'));
		
		try {
			// Create a fake repo root with only manifest.json and styles.css (missing main.js)
			const fakeRepo = join(testDir, 'repo');
			const fakeVault = join(testDir, 'vault');
			const pluginDir = join(fakeVault, '.obsidian', 'plugins', 'obsidian-subtitles-md');
			
			mkdirSync(fakeRepo, { recursive: true });
			mkdirSync(pluginDir, { recursive: true });
			
			writeFileSync(join(fakeRepo, 'manifest.json'), '{}');
			writeFileSync(join(fakeRepo, 'styles.css'), '');
			// main.js intentionally missing

			// Should throw without copying anything
			expect(() => copyPluginFiles(fakeRepo, pluginDir)).toThrow();
			
			// Verify no files were copied to destination
			expect(existsSync(join(pluginDir, 'manifest.json'))).toBe(false);
			expect(existsSync(join(pluginDir, 'main.js'))).toBe(false);
			expect(existsSync(join(pluginDir, 'styles.css'))).toBe(false);
		} finally {
			rmSync(testDir, { recursive: true, force: true });
		}
	});
});
