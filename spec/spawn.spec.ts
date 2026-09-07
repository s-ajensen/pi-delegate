import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai";
import { join } from "node:path";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { createChild, resumeChild, type ChildHandlers } from "../src/spawn.ts";
import { makeChildWorld, type ChildWorld } from "./helpers/child-world.ts";

const report = fauxAssistantMessage(fauxToolCall("report", { synopsis: "Found it." }));
const question = fauxAssistantMessage(fauxText("Which file?"));

interface Log {
	begins: number;
	stops: string[];
	reports: string[];
	failures: string[];
}

function makeLog(): { log: Log; handlers: ChildHandlers } {
	const log: Log = { begins: 0, stops: [], reports: [], failures: [] };
	return {
		log,
		handlers: {
			begin: () => log.begins++,
			stop: (text) => log.stops.push(text),
			report: (synopsis) => log.reports.push(synopsis),
			fail: (message) => log.failures.push(message),
		},
	};
}

describe("createChild", () => {
	let world: ChildWorld;
	beforeEach(async () => {
		world = await makeChildWorld();
	});
	afterEach(() => world.dispose());

	const finder = { name: "finder", brief: "Find the thing." };

	test("names the child session after the brief before it starts", async () => {
		const child = await createChild(world.environment, finder);

		expect(child.session.sessionManager.getSessionName()).toBe("sub: finder");
		expect(child.session.messages).toEqual([]);
	});

	test("runs at the environment's thinking level when one is set", async () => {
		const child = await createChild({ ...world.environment, thinkingLevel: "high" }, finder);

		expect(child.session.thinkingLevel).toBe("high");
	});

	test("the child's first message carries the brief and the reporting preamble", async () => {
		world.faux.setResponses([report]);
		const child = await createChild(world.environment, finder);
		await child.start(makeLog().handlers);

		const first = child.session.messages[0];
		const text = first && first.role === "user" ? JSON.stringify(first.content) : "";
		expect(text).toContain("Find the thing.");
		expect(text).toContain("report");
	});

	test("a child that calls report ends its turn on that call and reports once", async () => {
		world.faux.setResponses([report]);
		const { log, handlers } = makeLog();

		const child = await createChild(world.environment, finder);
		await child.start(handlers);

		expect(log).toEqual({ begins: 1, stops: [], reports: ["Found it."], failures: [] });
		expect(world.faux.state.callCount).toBe(1);
	});

	test("a child that stops without reporting hands its last text to the stop handler", async () => {
		world.faux.setResponses([question]);
		const { log, handlers } = makeLog();

		const child = await createChild(world.environment, finder);
		await child.start(handlers);

		expect(log).toEqual({ begins: 1, stops: ["Which file?"], reports: [], failures: [] });
	});

	test("a child whose model errors is reported as failed, not stopped", async () => {
		const { log, handlers } = makeLog();

		const child = await createChild(world.environment, finder);
		await child.start(handlers);

		expect(log.stops).toEqual([]);
		expect(log.reports).toEqual([]);
		expect(log.failures).toHaveLength(1);
	});

	test("a child whose first prompt is refused outright is reported as failed", async () => {
		const { log, handlers } = makeLog();
		const unknownModel = { ...world.environment.model, provider: "nowhere" };

		const child = await createChild({ ...world.environment, model: unknownModel }, finder);
		await child.start(handlers);

		expect(log.failures).toHaveLength(1);
		expect(log.stops).toEqual([]);
	});

	test("a child never gets delegate or reply, even when its extensions offer them", async () => {
		const offering = await makeChildWorld({
			extensions: [
				{
					name: "offers-delegation",
					factory: (pi) => {
						for (const name of ["delegate", "reply", "harmless"]) {
							pi.registerTool({
								name,
								label: name,
								description: name,
								parameters: Type.Object({}),
								execute: async () => ({ content: [], details: undefined }),
							});
						}
					},
				},
			],
		});
		try {
			const child = await createChild(offering.environment, finder);
			const names = child.session.agent.state.tools.map((tool) => tool.name);

			expect(names).toContain("harmless");
			expect(names).toContain("report");
			expect(names).not.toContain("delegate");
			expect(names).not.toContain("reply");
		} finally {
			offering.dispose();
		}
	});

	test("a child's extensions receive session_start and can scope tools there, as they do in pi's own modes", async () => {
		const starts: string[] = [];
		const scoping = await makeChildWorld({
			extensions: [
				{
					name: "scopes-on-start",
					factory: (pi) => {
						pi.registerTool({
							name: "only_elsewhere",
							label: "only elsewhere",
							description: "scoped away on session start",
							parameters: Type.Object({}),
							execute: async () => ({ content: [], details: undefined }),
						});
						pi.on("session_start", (event) => {
							starts.push(event.reason);
							pi.setActiveTools(pi.getActiveTools().filter((name) => name !== "only_elsewhere"));
						});
					},
				},
			],
		});
		try {
			const child = await createChild(scoping.environment, finder);
			const names = child.session.agent.state.tools.map((tool) => tool.name);

			expect(starts).toEqual(["startup"]);
			expect(names).not.toContain("only_elsewhere");
		} finally {
			scoping.dispose();
		}
	});

	test("a child resumed from its file keeps its history and can report again", async () => {
		world.faux.setResponses([question, report]);
		const onDisk = {
			...world.environment,
			openSession: () => SessionManager.create(world.environment.cwd, join(world.environment.cwd, "sessions")),
		};
		const original = await createChild(onDisk, finder);
		await original.start(makeLog().handlers);
		const file = original.session.sessionFile!;
		original.session.dispose();
		const { log, handlers } = makeLog();

		const resumed = await resumeChild(onDisk, file);
		await resumed.start(handlers);

		expect(resumed.session.sessionManager.getSessionName()).toBe("sub: finder");
		expect(resumed.session.messages.some((m) => m.role === "assistant")).toBe(true);
		expect(log).toEqual({ begins: 0, stops: [], reports: [], failures: [] });

		await resumed.send("Human: the second one.");

		expect(log.reports).toEqual(["Found it."]);
	});

	test("send starts a new turn on an idle child and the handlers follow it", async () => {
		world.faux.setResponses([question, report]);
		const { log, handlers } = makeLog();
		const child = await createChild(world.environment, finder);
		await child.start(handlers);

		await child.send("Human: the second one.");

		expect(log).toEqual({ begins: 2, stops: ["Which file?"], reports: ["Found it."], failures: [] });
		const userTexts = child.session.messages.filter((m) => m.role === "user").map((m) => JSON.stringify(m.content));
		expect(userTexts.at(-1)).toContain("Human: the second one.");
	});
});
