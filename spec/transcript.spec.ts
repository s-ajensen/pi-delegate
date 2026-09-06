import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai";
import { createChild, type Child } from "../src/spawn.ts";
import { ignoreHandlers } from "./helpers/handlers.ts";
import { ChildTranscript } from "../src/transcript.ts";
import { makeChildWorld, type ChildWorld } from "./helpers/child-world.ts";
import { makeTui, stripAnsi } from "./helpers/fake-terminal.ts";

describe("ChildTranscript", () => {
	let world: ChildWorld;
	let child: Child;
	beforeEach(async () => {
		world = await makeChildWorld();
		child = await createChild(world.environment, { name: "finder", brief: "Find the thing." });
	});
	afterEach(() => world.dispose());

	const script = () =>
		world.faux.setResponses([
			fauxAssistantMessage([fauxText("Looking now."), fauxToolCall("report", { synopsis: "Found it." })]),
		]);

	test("renders nothing for a child that has not started", () => {
		const transcript = new ChildTranscript(child.session, makeTui());
		expect(transcript.render(80)).toEqual([]);
	});

	test("shows the history of a child that already ran", async () => {
		script();
		await child.start(ignoreHandlers);

		const text = stripAnsi(new ChildTranscript(child.session, makeTui()).render(80));

		expect(text).toContain("Find the thing.");
		expect(text).toContain("Looking now.");
		expect(text).toContain("report");
		expect(text).toContain("Reported.");
	});

	test("follows a child live while it runs", async () => {
		script();
		const transcript = new ChildTranscript(child.session, makeTui());
		const stop = transcript.follow();
		await child.start(ignoreHandlers);
		stop();

		const text = stripAnsi(transcript.render(80));
		expect(text).toContain("Find the thing.");
		expect(text).toContain("Looking now.");
		expect(text).toContain("Reported.");
	});

	test("stops following after the unsubscribe", async () => {
		script();
		const transcript = new ChildTranscript(child.session, makeTui());
		transcript.follow()();
		await child.start(ignoreHandlers);

		expect(transcript.render(80)).toEqual([]);
	});
});
