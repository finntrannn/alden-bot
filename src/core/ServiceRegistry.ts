import type { Logger } from '@/shared/logger';

export interface ServiceRegistrationOptions {
	readonly owner?: string;
	readonly replace?: boolean;
}

export interface ServiceUnregisterOptions {
	readonly owner?: string;
}

interface ServiceEntry {
	readonly service: unknown;
	readonly owner?: string;
}

const VALID_SERVICE_NAME = /^[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)*$/;

export class ServiceRegistry {
	private readonly services = new Map<string, ServiceEntry>();

	public constructor(private readonly logger: Logger) {}

	public register<T>(
		name: string,
		service: T,
		options: ServiceRegistrationOptions = {},
	): boolean {
		if (!VALID_SERVICE_NAME.test(name)) {
			this.logger.warn(
				`ServiceRegistry: "${name}" is invalid. Use dotted lowercase segments such as "my-plugin.service".`,
			);
			return false;
		}

		const existing = this.services.get(name);
		if (existing && !options.replace) {
			this.logger.warn(`ServiceRegistry: "${name}" is already registered. Keeping existing.`);
			return false;
		}
		if (existing && options.replace) {
			if (existing.owner !== options.owner) {
				this.logger.warn(
					`ServiceRegistry: "${name}" is owned by "${existing.owner ?? 'unknown'}"; "${options.owner ?? 'unknown'}" cannot replace it.`,
				);
				return false;
			}
			this.logger.warn(`ServiceRegistry: "${name}" is already registered. Replacing.`);
		}
		this.services.set(name, { service, owner: options.owner });
		this.logger.debug(`ServiceRegistry: Registered "${name}"`);
		return true;
	}

	public get<T>(name: string): T | undefined {
		return this.services.get(name)?.service as T | undefined;
	}

	public unregister(name: string, options: ServiceUnregisterOptions = {}): boolean {
		const existing = this.services.get(name);
		if (!existing) return false;

		if (existing.owner !== options.owner) {
			this.logger.warn(
				`ServiceRegistry: "${name}" is owned by "${existing.owner ?? 'unknown'}"; "${options.owner ?? 'unknown'}" cannot unregister it.`,
			);
			return false;
		}

		this.services.delete(name);
		this.logger.debug(`ServiceRegistry: Unregistered "${name}"`);
		return true;
	}

	public has(name: string): boolean {
		return this.services.has(name);
	}

	public getNames(): string[] {
		return Array.from(this.services.keys());
	}
}
