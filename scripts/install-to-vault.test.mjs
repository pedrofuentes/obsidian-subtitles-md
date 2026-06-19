import { describe, it, expect } from 'vitest';
import { resolveVaultPath, withPluginEnabled } from './install-to-vault.mjs';

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
