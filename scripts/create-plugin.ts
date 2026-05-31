import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PATH } from '@/config/constants';

const write = (message: string): void => {
	process.stdout.write(message);
};

const writeError = (message: string): void => {
	process.stderr.write(message);
};

export interface CreatePluginResult {
	readonly pluginDir: string;
	readonly commandName: string;
	readonly permissionNode: string;
}

const VALID_PLUGIN_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function getPluginNameError(pluginName: string): string | null {
	if (VALID_PLUGIN_NAME.test(pluginName)) return null;

	return 'Plugin name must start with a letter and only use letters, numbers, underscores, or hyphens.';
}

export function resolvePluginNameArg(argv: string[]): string | undefined {
	return argv[0] === '--' ? argv[1] : argv[0];
}

export async function createPlugin(
	pluginName: string,
	pluginsDir = PATH.PLUGINS_DIR,
): Promise<CreatePluginResult> {
	const nameError = getPluginNameError(pluginName);
	if (nameError) {
		throw new Error(`${nameError} Got: "${pluginName}"`);
	}

	const pluginDir = path.join(pluginsDir, pluginName);

	let pluginDirExists = true;
	try {
		await fsp.access(pluginDir);
	} catch {
		pluginDirExists = false;
	}

	if (pluginDirExists) {
		throw new Error(`Directory already exists: plugins/${pluginName}/`);
	}

	const commandName = pluginName.toLowerCase();
	const permissionNode = `${commandName}.command.use`;

	const pluginJson = JSON.stringify(
		{
			name: pluginName,
			version: '1.0.0',
			description: `${pluginName} plugin for alden-bot`,
			author: 'your-name',
			main: 'src/main.ts',
			apiVersion: '1.0.0',
			permissions: {
				[permissionNode]: 0,
			},
		},
		null,
		'\t',
	);

	const packageJson = JSON.stringify(
		{
			name: commandName,
			version: '1.0.0',
			private: true,
			type: 'module',
			scripts: {
				typecheck: 'node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit',
				verify: 'pnpm run typecheck',
			},
			dependencies: {},
		},
		null,
		'\t',
	);

	const tsconfigJson = JSON.stringify(
		{
			extends: '../../tsconfig.json',
			compilerOptions: {
				rootDir: '../..',
				paths: {
					'@/*': ['../../src/*'],
				},
			},
			include: ['src/**/*.ts', '../../src/**/*.ts'],
			exclude: ['node_modules', 'dist'],
		},
		null,
		'\t',
	);

	const mainTs = `import path from 'node:path';

import { CommandBase, CommandContext, I18nManager, PluginBase } from '@/api';

const PERMISSION_USE = ${JSON.stringify(permissionNode)};

class ExampleCommand extends CommandBase {
\tpublic constructor() {
\t\tsuper({
\t\t\tname: ${JSON.stringify(commandName)},
\t\t\tdescription: 'command.example.description',
\t\t\tpermission: PERMISSION_USE,
\t\t\tcooldown: 3,
\t\t});
\t}

\tpublic async execute(ctx: CommandContext): Promise<void> {
\t\tawait ctx.reply(ctx.t('command.example.reply'));
\t}
}

export default class Main extends PluginBase {
\tpublic async onLoad(): Promise<void> {
\t\tthis.i18n = new I18nManager(path.join(this.pluginPath, 'resources', 'locales'), 'vi', {
\t\t\tlabel: this.description.name,
\t\t\twarnOnMissingKey: false,
\t\t});
\t\tawait this.i18n.loadLocales();
\t}

\tpublic onEnable(): void {
\t\tthis.registerCommand(new ExampleCommand());
\t\tthis.logger.info('Enabled.');
\t}

\tpublic onDisable(): void {
\t\tthis.logger.info('Disabled.');
\t}
}
`;

	const viLocale = JSON.stringify(
		{
			command: {
				example: {
					description: 'Kiểm tra plugin mẫu',
					reply: 'Plugin đang hoạt động.',
				},
			},
		},
		null,
		'\t',
	);

	const enLocale = JSON.stringify(
		{
			command: {
				example: {
					description: 'Check the example plugin',
					reply: 'Plugin is running.',
				},
			},
		},
		null,
		'\t',
	);

	await fsp.mkdir(path.join(pluginDir, 'src'), { recursive: true });
	await fsp.mkdir(path.join(pluginDir, 'resources', 'locales'), { recursive: true });

	await Promise.all([
		fsp.writeFile(path.join(pluginDir, 'plugin.json'), pluginJson, 'utf-8'),
		fsp.writeFile(path.join(pluginDir, 'package.json'), packageJson, 'utf-8'),
		fsp.writeFile(path.join(pluginDir, 'tsconfig.json'), tsconfigJson, 'utf-8'),
		fsp.writeFile(path.join(pluginDir, 'src', 'main.ts'), mainTs, 'utf-8'),
		fsp.writeFile(path.join(pluginDir, 'resources', 'locales', 'vi.json'), viLocale, 'utf-8'),
		fsp.writeFile(path.join(pluginDir, 'resources', 'locales', 'en.json'), enLocale, 'utf-8'),
	]);

	return { pluginDir, commandName, permissionNode };
}

async function main(argv = process.argv.slice(2)): Promise<number> {
	const pluginName = resolvePluginNameArg(argv);
	if (!pluginName) {
		writeError('Usage: pnpm run create-plugin <PluginName>\n');
		writeError('Example: pnpm run create-plugin MyAwesomePlugin\n');
		return 1;
	}

	const nameError = getPluginNameError(pluginName);
	if (nameError) {
		writeError(`${nameError}\n`);
		writeError(`Got: "${pluginName}"\n`);
		return 1;
	}

	let result: CreatePluginResult;
	try {
		result = await createPlugin(pluginName);
	} catch (error) {
		writeError(`${error instanceof Error ? error.message : String(error)}\n`);
		return 1;
	}

	write(`\nPlugin "${pluginName}" created successfully.\n\n`);
	write(`  plugins/${pluginName}/\n`);
	write('  - plugin.json\n');
	write('  - package.json\n');
	write('  - tsconfig.json\n');
	write('  - src/main.ts\n');
	write('  - resources/locales/vi.json\n');
	write('  - resources/locales/en.json\n\n');
	write('Next steps:\n');
	write('  1. Edit plugin.json with your details.\n');
	write(`  2. Run: pnpm --dir plugins/${pluginName} run verify\n`);
	write('  3. Start the bot and test the command:\n');
	write(`     /${result.commandName}\n\n`);
	return 0;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
	const exitCode = await main();
	if (exitCode !== 0) {
		process.exit(exitCode);
	}
}
