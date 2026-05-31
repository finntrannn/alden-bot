import { describe, expect, it } from 'vitest';

import { validatePluginManifest } from '@/core/plugin/PluginManifest';

const validManifest = {
	name: 'example-plugin',
	version: '1.0.0',
	description: 'Example plugin',
	author: 'alden',
	main: 'index.js',
};

describe('validatePluginManifest', () => {
	it('accepts a valid plugin manifest', () => {
		const { manifest, errors } = validatePluginManifest(validManifest);

		expect(errors).toEqual([]);
		expect(manifest?.name).toBe('example-plugin');
	});

	it('rejects missing required fields', () => {
		const { manifest, errors } = validatePluginManifest({ name: 'broken' });

		expect(manifest).toBeNull();
		expect(errors).toContain('"version" must be a non-empty string.');
		expect(errors).toContain('"main" must be a non-empty string.');
	});

	it('rejects invalid permission role levels', () => {
		const { manifest, errors } = validatePluginManifest({
			...validManifest,
			permissions: {
				'alden.example': 99,
			},
		});

		expect(manifest).toBeNull();
		expect(errors).toContain('Permission "alden.example" must use role level 0, 1, 2, or 3.');
	});

	it('rejects permission nodes outside the public lowercase format', () => {
		const { manifest, errors } = validatePluginManifest({
			...validManifest,
			permissions: {
				'Alden.Command.Use': 3,
			},
		});

		expect(manifest).toBeNull();
		expect(errors).toContain(
			'Permission "Alden.Command.Use" must use dotted lowercase segments such as "my-plugin.command.use".',
		);
	});

	it('rejects main paths outside the plugin directory', () => {
		const { manifest, errors } = validatePluginManifest({
			...validManifest,
			main: '../outside.ts',
		});

		expect(manifest).toBeNull();
		expect(errors).toContain(
			'"main" must be a relative file path inside the plugin directory.',
		);
	});

	it('rejects main values that are not file entrypoints', () => {
		const { manifest, errors } = validatePluginManifest({
			...validManifest,
			main: '.',
		});

		expect(manifest).toBeNull();
		expect(errors).toContain(
			'"main" must point to a .js, .mjs, .cjs, .ts, .mts, or .cts file.',
		);
	});

	it('rejects URI-like main paths', () => {
		const { manifest, errors } = validatePluginManifest({
			...validManifest,
			main: 'file:///tmp/plugin.js',
		});

		expect(manifest).toBeNull();
		expect(errors).toContain(
			'"main" must be a relative file path inside the plugin directory.',
		);
	});

	it('rejects invalid dependency declarations', () => {
		const { manifest, errors } = validatePluginManifest({
			...validManifest,
			depend: ['core', 'core', 'bad name'],
			softDepend: ['example-plugin'],
		});

		expect(manifest).toBeNull();
		expect(errors).toContain('"depend" contains duplicate plugin name "core".');
		expect(errors).toContain(
			'"depend" contains invalid plugin name "bad name". Plugin names may only contain letters, numbers, underscores, and hyphens.',
		);
		expect(errors).toContain('"softDepend" must not include the plugin itself.');
	});

	it('rejects soft dependencies that duplicate hard dependencies', () => {
		const { manifest, errors } = validatePluginManifest({
			...validManifest,
			depend: ['core'],
			softDepend: ['core'],
		});

		expect(manifest).toBeNull();
		expect(errors).toContain('"softDepend" must not include hard dependency "core".');
	});

	it('rejects empty optional metadata strings', () => {
		const { manifest, errors } = validatePluginManifest({
			...validManifest,
			website: '',
		});

		expect(manifest).toBeNull();
		expect(errors).toContain('"website" must be a non-empty string when provided.');
	});
});
