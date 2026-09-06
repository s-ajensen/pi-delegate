import { describe, expect, test } from "bun:test";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { describeActivity, renderWidgetLines, type Snapshot } from "../src/widget.ts";

const snapshot = (overrides: Partial<Snapshot>): Snapshot => ({
	key: 1,
	name: "finder",
	streaming: true,
	activity: "",
	...overrides,
});

describe("renderWidgetLines", () => {
	test("renders nothing when no child is running", () => {
		expect(renderWidgetLines([])).toBeUndefined();
	});

	test("labels each running child with its own key and state", () => {
		const lines = renderWidgetLines([
			snapshot({ key: 1, name: "finder", streaming: true, activity: "bash" }),
			snapshot({ key: 3, name: "reader", streaming: false, activity: "Which file?" }),
		]);

		expect(lines).toEqual(["alt+1  finder  working  bash", "alt+3  reader  waiting  Which file?"]);
	});

	test("points a child beyond the ninth key at /sub", () => {
		const lines = renderWidgetLines([snapshot({ key: 10, name: "c10" })]);

		expect(lines?.[0]).toStartWith("/sub   c10");
	});
});

describe("describeActivity", () => {
	const assistant = (content: unknown[]): AgentMessage =>
		({ role: "assistant", content, stopReason: "stop" }) as unknown as AgentMessage;

	test("is empty before the child has said anything", () => {
		expect(describeActivity([])).toBe("");
	});

	test("names the last tool the child called", () => {
		const messages = [assistant([{ type: "toolCall", id: "1", name: "bash", arguments: { command: "ls" } }])];
		expect(describeActivity(messages)).toBe("bash");
	});

	test("shows the first line of the child's last text when it ended in prose", () => {
		const messages = [assistant([{ type: "text", text: "Which file?\nThere are two." }])];
		expect(describeActivity(messages)).toBe("Which file?");
	});
});
