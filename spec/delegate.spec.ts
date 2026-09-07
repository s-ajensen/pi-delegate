import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai";
import { watch } from "../src/attention.ts";
import { defineDelegateTool } from "../src/delegate.ts";
import type { ChildMessageKind } from "../src/deliver.ts";
import { createRegistry, type Entry } from "../src/registry.ts";
import { createChild, type Brief, type Child } from "../src/spawn.ts";
import { makeChildWorld, type ChildWorld } from "./helpers/child-world.ts";

const report = fauxAssistantMessage(fauxToolCall("report", { synopsis: "Found it." }));
const question = fauxAssistantMessage(fauxText("Which file?"));

describe("delegate tool", () => {
	let world: ChildWorld;
	beforeEach(async () => {
		world = await makeChildWorld();
	});
	afterEach(() => world.dispose());

	function makeTool() {
		const registry = createRegistry<Child>();
		const requested: Brief[] = [];
		const delivered: { entry: Entry<Child>; kind: ChildMessageKind; text: string }[] = [];
		const waiters: (() => void)[] = [];
		const tool = defineDelegateTool({
			registry,
			create: (brief) => {
				requested.push(brief);
				return createChild(world.environment, brief);
			},
			deliver: (entry, kind, text) => {
				delivered.push({ entry, kind, text });
				waiters.splice(0).forEach((wake) => wake());
			},
		});
		const nextDelivery = () => new Promise<void>((resolve) => waiters.push(resolve));
		const settled = () =>
			new Promise<void>((resolve) => {
				const stop = registry.subscribe(() => {
					if (registry.running().length === 0) {
						stop();
						resolve();
					}
				});
			});
		const run = (name: string, brief: string, model?: string) =>
			tool.execute("call-1", { name, brief, model }, undefined, undefined, {} as never);
		return { registry, delivered, requested, nextDelivery, settled, run };
	}

	test("returns as soon as the child is running, without waiting for its report", async () => {
		world.faux.setResponses([report]);
		const { registry, delivered, run } = makeTool();

		const result = await run("finder", "Find the thing.");

		expect(registry.running().map((entry) => entry.name)).toEqual(["finder"]);
		expect(delivered).toEqual([]);
		expect(result.content[0]?.type === "text" ? result.content[0].text : "").toContain("finder");
	});

	test("passes the requested model pattern through to the child's creation", async () => {
		world.faux.setResponses([report]);
		const { requested, run } = makeTool();

		await run("finder", "Find the thing.", "faux/faux-1:high");

		expect(requested).toEqual([{ name: "finder", brief: "Find the thing.", model: "faux/faux-1:high" }]);
	});

	test("delivers the child's report and marks it reported", async () => {
		world.faux.setResponses([report]);
		const { registry, delivered, nextDelivery, run } = makeTool();
		const delivery = nextDelivery();

		await run("finder", "Find the thing.");
		await delivery;

		expect(delivered.map((d) => [d.kind, d.text])).toEqual([["report", "Found it."]]);
		expect(delivered[0]?.entry.state).toBe("reported");
		expect(registry.running()).toEqual([]);
	});

	test("delivers what a child says when it stops unwatched, and keeps it running", async () => {
		world.faux.setResponses([question]);
		const { registry, delivered, nextDelivery, run } = makeTool();
		const delivery = nextDelivery();

		await run("finder", "Find the thing.");
		await delivery;

		expect(delivered.map((d) => [d.kind, d.text])).toEqual([["stop", "Which file?"]]);
		expect(registry.running().map((entry) => entry.name)).toEqual(["finder"]);
	});

	test("holds what a watched child says, for the human", async () => {
		world.faux.setResponses([question]);
		const { registry, delivered, run } = makeTool();

		await run("finder", "Find the thing.");
		const entry = registry.all()[0]!;
		watch(entry);
		await new Promise<void>((resolve) => {
			entry.child.session.subscribe((event) => event.type === "agent_end" && resolve());
		});

		expect(delivered).toEqual([]);
		expect(registry.all()[0]?.pending).toBe("Which file?");
	});

	test("marks a child failed when its run errors, and tells the parent why", async () => {
		const { registry, delivered, settled, run } = makeTool();
		const done = settled();

		await run("finder", "Find the thing.");
		await done;

		expect(registry.all()[0]?.state).toBe("failed");
		expect(delivered.map((d) => d.kind)).toEqual(["failure"]);
		expect(delivered[0]?.text).toContain("faux");
	});
});
