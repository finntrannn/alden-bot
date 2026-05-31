import path from 'node:path';
import semver from 'semver';
import type { Role } from '@/core/permission/PermissionManager';

export interface PluginManifest {
	name: string;
	version: string;
	description: string;
	author: string;
	main: string;
	permissions?: Record<string, Role>;
	depend?: string[];
	softDepend?: string[];
	website?: string;
	apiVersion?: string;
	license?: string;
}

export interface PluginManifestValidationResult {
	readonly manifest: PluginManifest | null;
	readonly errors: string[];
}

const VALID_PLUGIN_NAME = /^[a-zA-Z0-9_-]+$/;
const VALID_PERMISSION_NODE = /^[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)*$/;
const VALID_ROLE_LEVELS = new Set([0, 1, 2, 3]);
const VALID_MAIN_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts']);
const REQUIRED_STRING_FIELDS = ['name', 'version', 'description', 'author', 'main'] as const;
const OPTIONAL_STRING_FIELDS = ['website', 'license'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim());
}

function hasParentPathSegment(value: string): boolean {
	return value
		.replace(/\\/g, '/')
		.split('/')
		.some((segment) => segment === '..');
}

function isAbsolutePluginPath(value: string): boolean {
	return path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
}

function hasUriScheme(value: string): boolean {
	return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function hasSupportedMainExtension(value: string): boolean {
	return VALID_MAIN_EXTENSIONS.has(path.extname(value.replace(/\\/g, '/')).toLowerCase());
}

function validateDependencyList(
	value: unknown,
	field: 'depend' | 'softDepend',
	pluginName: unknown,
	errors: string[],
): void {
	if (value === undefined) return;
	if (!isStringArray(value)) {
		errors.push(`"${field}" must be an array of non-empty strings when provided.`);
		return;
	}

	const seen = new Set<string>();
	for (const dependency of value) {
		if (!VALID_PLUGIN_NAME.test(dependency)) {
			errors.push(
				`"${field}" contains invalid plugin name "${dependency}". Plugin names may only contain letters, numbers, underscores, and hyphens.`,
			);
		}
		if (dependency === pluginName) {
			errors.push(`"${field}" must not include the plugin itself.`);
		}
		if (seen.has(dependency)) {
			errors.push(`"${field}" contains duplicate plugin name "${dependency}".`);
		}
		seen.add(dependency);
	}
}

export function validatePluginManifest(value: unknown): PluginManifestValidationResult {
	const errors: string[] = [];

	if (!isRecord(value)) {
		return { manifest: null, errors: ['plugin.json must contain a JSON object.'] };
	}

	for (const field of REQUIRED_STRING_FIELDS) {
		if (typeof value[field] !== 'string' || value[field].trim() === '') {
			errors.push(`"${field}" must be a non-empty string.`);
		}
	}

	if (typeof value.name === 'string' && !VALID_PLUGIN_NAME.test(value.name)) {
		errors.push('"name" may only contain letters, numbers, underscores, and hyphens.');
	}

	if (typeof value.version === 'string' && !semver.valid(value.version)) {
		errors.push('"version" must be a valid semver version.');
	}

	if (typeof value.apiVersion === 'string' && !semver.valid(value.apiVersion)) {
		errors.push('"apiVersion" must be a valid semver version when provided.');
	}

	for (const field of OPTIONAL_STRING_FIELDS) {
		if (
			value[field] !== undefined &&
			(typeof value[field] !== 'string' || !value[field].trim())
		) {
			errors.push(`"${field}" must be a non-empty string when provided.`);
		}
	}

	if (typeof value.main === 'string' && value.main.trim()) {
		if (
			isAbsolutePluginPath(value.main) ||
			hasParentPathSegment(value.main) ||
			hasUriScheme(value.main)
		) {
			errors.push('"main" must be a relative file path inside the plugin directory.');
		}
		if (!hasSupportedMainExtension(value.main)) {
			errors.push('"main" must point to a .js, .mjs, .cjs, .ts, .mts, or .cts file.');
		}
	}

	validateDependencyList(value.depend, 'depend', value.name, errors);
	validateDependencyList(value.softDepend, 'softDepend', value.name, errors);
	if (isStringArray(value.depend) && isStringArray(value.softDepend)) {
		const hardDependencies = new Set(value.depend);
		for (const dependency of value.softDepend) {
			if (hardDependencies.has(dependency)) {
				errors.push(`"softDepend" must not include hard dependency "${dependency}".`);
			}
		}
	}

	if (value.permissions !== undefined) {
		if (!isRecord(value.permissions)) {
			errors.push('"permissions" must be an object when provided.');
		} else {
			for (const [node, level] of Object.entries(value.permissions)) {
				if (!node.trim()) {
					errors.push('"permissions" contains an empty permission node.');
				} else if (!VALID_PERMISSION_NODE.test(node)) {
					errors.push(
						`Permission "${node}" must use dotted lowercase segments such as "my-plugin.command.use".`,
					);
				}
				if (typeof level !== 'number' || !VALID_ROLE_LEVELS.has(level)) {
					errors.push(`Permission "${node}" must use role level 0, 1, 2, or 3.`);
				}
			}
		}
	}

	if (errors.length > 0) {
		return { manifest: null, errors };
	}

	return { manifest: value as unknown as PluginManifest, errors };
}

export type PluginDescription = PluginManifest;
