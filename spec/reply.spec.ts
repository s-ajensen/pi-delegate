import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage, fauxText } from "@earendil-works/pi-ai";
import { adoptChild } from "../src/adopt.ts";
import { watch } from "../src/attention.ts";
import { createRegistry, type Entry } from "../src/registry.ts";
import { defineReplyTool } from "../src/reply.ts";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { createChild, resumeChild, type Child } from "../src/spawn.ts";
import { makeChildWorld, type ChildWorld } from "./helpers/child-world.ts";

const ctx = { model: { id: "claude-fable-5-1" } } as never;
const noRevival = async () => undefined;

function untilAgentEnd(child: Child): Promise<void> {
	return new Promise((resolve) => {
		child.session.subscribe((event) => event.type === "agent_end" && resolve());
	});
}

function lastUserText(child: Child): string {
	const last = child.session.messages.filter((m) => m.role === "user").at(-1);
	return last ? JSON.stringify(last.content) : "";
}

describe("reply tool", () => {
	let world: ChildWorld;
	beforeEach(async () => {
		world = await makeChildWorld();
	});
	afterEach(() => world.dispose());

	test("refuses a key nobody holds", async () => {
		const tool = defineReplyTool({ registry: createRegistry<Child>(), revive: noRevival });

		expect(tool.execute("c", { key: 9, message: "hi" }, undefined, undefined, ctx)).rejects.toThrow("alt+9");
	});

	test("refuses a name nobody has, in memory or on disk", async () => {
		const tool = defineReplyTool({ registry: createRegistry<Child>(), revive: noRevival });

		expect(tool.execute("c", { name: "ghost", message: "hi" }, undefined, undefined, ctx)).rejects.toThrow('"ghost"');
	});

	test("refuses when neither key nor name is given", async () => {
		const tool = defineReplyTool({ registry: createRegistry<Child>(), revive: noRevival });

		expect(tool.execute("c", { message: "hi" }, undefined, undefined, ctx)).rejects.toThrow("key");
	});

	test("refuses while the human is watching that child", async () => {
		const registry = createRegistry<Child>();
		const child = await createChild(world.environment, { name: "finder", brief: "Find the thing." });
		const entry = registry.add("finder", child);
		watch(entry);
		const tool = defineReplyTool({ registry, revive: noRevival });

		expect(tool.execute("c", { key: entry.key, message: "hi" }, undefined, undefined, ctx)).rejects.toThrow("watching");
	});

	test("sends the message into a running child by key, prefixed as the orchestrator's", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText("Okay."))]);
		const registry = createRegistry<Child>();
		const child = await createChild(world.environment, { name: "finder", brief: "Find the thing." });
		const entry = registry.add("finder", child);
		const ended = untilAgentEnd(child);
		const tool = defineReplyTool({ registry, revive: noRevival });

		await tool.execute("c", { key: entry.key, message: "Proceed." }, undefined, undefined, ctx);
		await ended;

		expect(lastUserText(child)).toContain("Orchestrator (claude-fable-5-1): Proceed.");
	});

	test("wakes a finished child by name, and it takes a key again", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText("Done.")), fauxAssistantMessage(fauxText("More."))]);
		const registry = createRegistry<Child>();
		const child = await createChild(world.environment, { name: "finder", brief: "Find the thing." });
		const entry = adoptChild({ registry, deliver: () => {} }, "finder", child);
		await untilAgentEnd(child);
		registry.mark(entry, "reported");
		const ended = untilAgentEnd(child);
		const tool = defineReplyTool({ registry, revive: noRevival });

		await tool.execute("c", { name: "finder", message: "One more thing." }, undefined, undefined, ctx);
		await ended;

		expect(lastUserText(child)).toContain("One more thing.");
		expect(entry.key).toBe(1);
	});

	test("asks for a revival when the name is not in memory", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText("Done.")), fauxAssistantMessage(fauxText("Back."))]);
		const onDisk = {
			...world.environment,
			openSession: () => SessionManager.create(world.environment.cwd, join(world.environment.cwd, "sessions")),
		};
		const original = await createChild(onDisk, { name: "finder", brief: "Find the thing." });
		await original.start({ begin() {}, stop() {}, report() {}, fail() {} });
		const file = original.session.sessionFile!;
		original.session.dispose();
		const registry = createRegistry<Child>();
		const revived: string[] = [];
		let child: Child | undefined;
		const revive = async (name: string): Promise<Entry<Child>> => {
			revived.push(name);
			child = await resumeChild(onDisk, file);
			return adoptChild({ registry, deliver: () => {} }, name, child, "reported");
		};
		const tool = defineReplyTool({ registry, revive });

		await tool.execute("c", { name: "finder", message: "Again." }, undefined, undefined, ctx);
		await untilAgentEnd(child!);

		expect(revived).toEqual(["finder"]);
		expect(lastUserText(child!)).toContain("Again.");
		expect(registry.byName("finder")?.key).toBe(1);
	});
});
