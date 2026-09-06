import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { fauxAssistantMessage, fauxText } from "@earendil-works/pi-ai";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { adoptChild } from "../src/adopt.ts";
import { createRegistry } from "../src/registry.ts";
import { createChild, resumeChild, type Child, type ChildEnvironment } from "../src/spawn.ts";
import { makeChildWorld, type ChildWorld } from "./helpers/child-world.ts";
import { ignoreHandlers } from "./helpers/handlers.ts";

describe("adoptChild", () => {
	let world: ChildWorld;
	let onDisk: ChildEnvironment;
	beforeEach(async () => {
		world = await makeChildWorld();
		onDisk = {
			...world.environment,
			openSession: () => SessionManager.create(world.environment.cwd, join(world.environment.cwd, "sessions")),
		};
	});
	afterEach(() => world.dispose());

	test("a resumed child adopted as reported stays out of the running list until someone speaks to it", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText("Done.")), fauxAssistantMessage(fauxText("Okay."))]);
		const original = await createChild(onDisk, { name: "finder", brief: "Find the thing." });
		await original.start(ignoreHandlers);
		const file = original.session.sessionFile!;
		original.session.dispose();
		const registry = createRegistry<Child>();
		const resumed = await resumeChild(onDisk, file);

		const entry = adoptChild({ registry, deliver: () => {} }, "finder", resumed, "reported");
		expect(registry.running()).toEqual([]);

		await resumed.send("Human: again");
		expect(entry.state).toBe("running");
	});
});
