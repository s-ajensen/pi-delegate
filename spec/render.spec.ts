import { describe, expect, test } from "bun:test";
import { buildChildMessage } from "../src/deliver.ts";
import { renderChildMessage, renderDelegateCall, renderNothing, renderReplyCall } from "../src/render.ts";
import { stripAnsi } from "./helpers/fake-terminal.ts";

const plain = {
	fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
	bg: (color: string, text: string) => `{${color}}${text}{/${color}}`,
	bold: (text: string) => `*${text}*`,
};
const running = { key: 1, name: "asker", model: "gpt-6-astra", sessionFile: undefined };
const finished = { ...running, key: undefined };
const options = { expanded: false, outputPad: 0 };
const WIDE = 200;

describe("renderChildMessage", () => {
	test("puts a report in the highlighted box with its label, and shows the text", () => {
		const text = renderChildMessage(buildChildMessage(finished, "report", "Navy blue."), options, plain).render(WIDE).join("\n");

		expect(text).toContain('report from subagent "asker" (gpt-6-astra)');
		expect(text).toContain("<customMessageLabel>");
		expect(text).toContain("{customMessageBg}");
		expect(stripAnsi([text])).toContain("Navy blue.");
	});

	test("labels a stop with the child's hotkey, in the accent colour and no box", () => {
		const text = renderChildMessage(buildChildMessage(running, "stop", "Which shade?"), options, plain).render(WIDE).join("\n");

		expect(text).toContain('subagent "asker" (alt+1, gpt-6-astra) says');
		expect(text).toContain("<accent>");
		expect(text).not.toContain("{customMessageBg}");
	});
});

describe("renderReplyCall", () => {
	test("names the child replied to by hotkey and shows the message verbatim", () => {
		const text = renderReplyCall({ key: 1, message: "Pick blue." }, (key) => (key === 1 ? "asker" : undefined), plain)
			.render(WIDE)
			.join("\n");

		expect(text).toContain('reply to subagent "asker" (alt+1)');
		expect(text).toContain("Pick blue.");
	});

	test("names a finished child by name when the reply wakes it", () => {
		const text = renderReplyCall({ name: "asker", message: "Again." }, () => undefined, plain).render(WIDE).join("\n");

		expect(text).toContain('reply to subagent "asker"');
		expect(text).not.toContain("alt+");
	});

	test("falls back to the hotkey alone when no child holds it", () => {
		const text = renderReplyCall({ key: 7, message: "Hi." }, () => undefined, plain).render(WIDE).join("\n");

		expect(text).toContain("reply to subagent alt+7");
	});
});

describe("renderNothing", () => {
	test("takes no rows", () => {
		expect(renderNothing().render(80)).toEqual([]);
	});
});

describe("renderDelegateCall", () => {
	test("shows the child's name, the model when given, and the brief", () => {
		const text = renderDelegateCall({ name: "asker", brief: "Ask a question.", model: "sonnet:high" }, plain).render(WIDE).join("\n");

		expect(text).toContain('delegate to subagent "asker" (sonnet:high)');
		expect(text).toContain("Ask a question.");
	});

	test("omits the model when the default applies", () => {
		const text = renderDelegateCall({ name: "asker", brief: "Ask." }, plain).render(WIDE).join("\n");

		expect(text).toContain('delegate to subagent "asker"');
		expect(text).not.toContain("(");
	});
});
