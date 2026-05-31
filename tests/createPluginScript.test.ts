import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createPlugin, getPluginNameError, resolvePluginNameArg } from '../scripts/create-plugin';

let tempRoot: string | undefined;

async function createTempPluginsDir(): Promise<string> {
	tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'alden-create-plugin-'));
	return tempRoot;
}

async function readJson<T>(filePath: string): Promise<T> {
	return JSON.parse(await fsp.readFile(filePath, 'utf-8')) as T;
}

describe('create-plugin script helpers', () => {
	afterEach(async () => {
		if (tempRoot) {
			await fsp.rm(tempRoot, { recursive: true, force: true });
			tempRoot = undefined;
		}
	});

	it('creates a command-ready plugin scaffold', async () => {
		const pluginsDir = await createTempPluginsDir();
		const result = await createPlugin('MyPlugin', pluginsDir);

		expect(result.commandName).toBe('myplugin');
		expect(result.permissionNode).toBe('myplugin.command.use');

		const pluginJson = await readJson<{
			name: string;
			main: string;
			permissions: Record<string, number>;
		}>(path.join(result.pluginDir, 'plugin.json'));
		expect(pluginJson.name).toBe('MyPlugin');
		expect(pluginJson.main).toBe('src/main.ts');
		expect(pluginJson.permissions['myplugin.command.use']).toBe(0);

		const mainTs = await fsp.readFile(path.join(result.pluginDir, 'src', 'main.ts'), 'utf-8');
		expect(mainTs).toContain('class ExampleCommand extends CommandBase');
		expect(mainTs).toContain('this.registerCommand(new ExampleCommand());');
		expect(mainTs).toContain('new I18nManager(');

		const viLocale = await readJson<{ command: { example: { description: string } } }>(
			path.join(result.pluginDir, 'resources', 'locales', 'vi.json'),
		);
		const enLocale = await readJson<{ command: { example: { reply: string } } }>(
			path.join(result.pluginDir, 'resources', 'locales', 'en.json'),
		);

		expect(viLocale.command.example.description).toBe('Kiểm tra plugin mẫu');
		expect(enLocale.command.example.reply).toBe('Plugin is running.');
	});

	it('rejects invalid plugin names before writing files', () => {
		expect(getPluginNameError('bad name')).toBe(
			'Plugin name must start with a letter and only use letters, numbers, underscores, or hyphens.',
		);
		expect(getPluginNameError('MyPlugin')).toBeNull();
	});

	it('accepts pnpm run argument separators', () => {
		expect(resolvePluginNameArg(['--', 'MyPlugin'])).toBe('MyPlugin');
		expect(resolvePluginNameArg(['MyPlugin'])).toBe('MyPlugin');
		expect(resolvePluginNameArg(['--'])).toBeUndefined();
	});

	it('does not overwrite an existing plugin directory', async () => {
		const pluginsDir = await createTempPluginsDir();

		await createPlugin('MyPlugin', pluginsDir);

		await expect(createPlugin('MyPlugin', pluginsDir)).rejects.toThrow(
			'Directory already exists: plugins/MyPlugin/',
		);
	});
});
