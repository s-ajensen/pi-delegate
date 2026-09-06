import { describe, expect, test } from "bun:test";
import { buildChildMessage, CHILD_MESSAGE_TYPE, prefixHuman, prefixOrchestrator } from "../src/deliver.ts";

const running = { key: 3, name: "finder", model: "gpt-6-astra", sessionFile: "/s/child.jsonl" };
const finished = { ...running, key: undefined };

describe("buildChildMessage", () => {
	test("labels a stop with the child's name, hotkey and model, so the parent knows how to reply", () => {
		const message = buildChildMessage(running, "stop", "Which file?");

		expect(message.customType).toBe(CHILD_MESSAGE_TYPE);
		expect(message.display).toBe(true);
		expect(message.content).toBe('Subagent "finder" (alt+3, gpt-6-astra) says:\n\nWhich file?');
		expect(message.details).toEqual({ ...running, kind: "stop", text: "Which file?" });
	});

	test("labels a report without a hotkey, because the child has given its key up", () => {
		const message = buildChildMessage(finished, "report", "Found it.");

		expect(message.content).toBe('Subagent "finder" (gpt-6-astra) reports:\n\nFound it.');
		expect(message.details.kind).toBe("report");
	});
});

describe("prefixes into the child", () => {
	test("marks the orchestrator's replies with its model", () => {
		expect(prefixOrchestrator("claude-fable-5-1", "Proceed.")).toBe("Orchestrator (claude-fable-5-1): Proceed.");
	});

	test("marks the human's messages", () => {
		expect(prefixHuman("Stop.")).toBe("Human: Stop.");
	});
});
