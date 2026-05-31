import { describe, expect, it, vi } from 'vitest';

import { ServiceRegistry } from '@/core/ServiceRegistry';
import type { Logger } from '@/shared/logger';

function createLoggerStub(): Logger {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		child: vi.fn(),
	} as unknown as Logger;
}

describe('ServiceRegistry', () => {
	it('rejects invalid service names', () => {
		const logger = createLoggerStub();
		const registry = new ServiceRegistry(logger);

		expect(registry.register('Bad Service', { ready: true }, { owner: 'BadPlugin' })).toBe(
			false,
		);
		expect(registry.get('Bad Service')).toBeUndefined();
		expect(logger.warn).toHaveBeenCalledWith(
			'ServiceRegistry: "Bad Service" is invalid. Use dotted lowercase segments such as "my-plugin.service".',
		);
	});

	it('keeps the existing service when a duplicate is registered without replace', () => {
		const logger = createLoggerStub();
		const registry = new ServiceRegistry(logger);
		const first = { value: 1 };
		const second = { value: 2 };

		expect(registry.register('economy', first, { owner: 'EconomyAPI' })).toBe(true);
		expect(registry.register('economy', second, { owner: 'OtherEconomy' })).toBe(false);

		expect(registry.get('economy')).toBe(first);
		expect(logger.warn).toHaveBeenCalledWith(
			'ServiceRegistry: "economy" is already registered. Keeping existing.',
		);
	});

	it('only allows the owning plugin to replace a service', () => {
		const logger = createLoggerStub();
		const registry = new ServiceRegistry(logger);
		const first = { value: 1 };
		const second = { value: 2 };
		const third = { value: 3 };

		expect(registry.register('economy', first, { owner: 'EconomyAPI' })).toBe(true);
		expect(registry.register('economy', second, { owner: 'OtherEconomy', replace: true })).toBe(
			false,
		);
		expect(registry.get('economy')).toBe(first);

		expect(registry.register('economy', third, { owner: 'EconomyAPI', replace: true })).toBe(
			true,
		);
		expect(registry.get('economy')).toBe(third);
		expect(logger.warn).toHaveBeenCalledWith(
			'ServiceRegistry: "economy" is owned by "EconomyAPI"; "OtherEconomy" cannot replace it.',
		);
	});

	it('only allows the owning plugin to unregister a service', () => {
		const logger = createLoggerStub();
		const registry = new ServiceRegistry(logger);
		const service = { ready: true };

		registry.register('economy', service, { owner: 'EconomyAPI' });

		expect(registry.unregister('economy')).toBe(false);
		expect(registry.unregister('economy', { owner: 'ChatLevels' })).toBe(false);
		expect(registry.get('economy')).toBe(service);

		expect(registry.unregister('economy', { owner: 'EconomyAPI' })).toBe(true);
		expect(registry.get('economy')).toBeUndefined();
	});
});
