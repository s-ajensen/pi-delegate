import { describe, expect, test } from "bun:test";
import { buildChildMessage, CHILD_MESSAGE_TYPE, prefixHuman, prefixOrchestrator, REVIEW_REMINDER } from "../src/deliver.ts";

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

	test("labels a failure with its reason, so the parent can retry", () => {
		const message = buildChildMessage(finished, "failure", "No API key found for amazon-bedrock.");

		expect(message.content).toBe('Subagent "finder" (gpt-6-astra) failed:\n\nNo API key found for amazon-bedrock.');
		expect(message.details.kind).toBe("failure");
	});

	test("labels a report without a hotkey, because the child has given its key up", () => {
		const message = buildChildMessage(finished, "report", "Found it.");

		expect(message.content).toBe(`Subagent "finder" (gpt-6-astra) reports:\n\nFound it.\n\n${REVIEW_REMINDER}`);
		expect(message.details.kind).toBe("report");
		expect(message.details.text).toBe("Found it.");
	});

	test("attaches the review reminder only to reports, since a stop or a failure has no tree to audit", () => {
		expect(buildChildMessage(running, "stop", "Which file?").content).not.toContain(REVIEW_REMINDER);
		expect(buildChildMessage(finished, "failure", "No key.").content).not.toContain(REVIEW_REMINDER);
	});

	test("the reminder points at the review prompt and names the report a claim", () => {
		expect(REVIEW_REMINDER).toContain("~/.pi/agent/prompts/review.md");
		expect(REVIEW_REMINDER).toContain("claim");
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
