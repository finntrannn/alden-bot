import { describe, expect, it } from 'vitest';

import {
	TextStyle,
	ThreadType,
	type API,
	type AttachmentSource,
	type Mention,
	type Message,
	type MessageContent,
	type ParsedCommandArgs,
	type Style,
	type ZaloGroupEvent,
} from '@/api';

function acceptPublicZaloTypes(value: {
	api?: API;
	attachment?: AttachmentSource;
	content: MessageContent;
	groupEvent?: ZaloGroupEvent;
	mention: Mention;
	message?: Message;
	style: Style;
}): MessageContent {
	return value.content;
}

function acceptParsedCommandArgs(value: ParsedCommandArgs): string[] {
	return value.cleanArgs;
}

describe('public API surface', () => {
	it('re-exports common Zalo message types used by plugin contracts', () => {
		const mention: Mention = { pos: 0, len: 5, uid: 'user-1' };
		const style: Style = { start: 0, len: 5, st: TextStyle.Bold };
		const content = acceptPublicZaloTypes({
			attachment: 'image.png',
			content: { msg: 'hello', mentions: [mention], styles: [style] },
			mention,
			style,
		});

		expect(ThreadType.Group).toBe(1);
		expect(content.msg).toBe('hello');
	});

	it('re-exports command helper result types', () => {
		expect(
			acceptParsedCommandArgs({
				targetUids: ['user-1'],
				cleanArgs: ['100'],
			}),
		).toEqual(['100']);
	});
});
