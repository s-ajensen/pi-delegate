import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { DefaultResourceLoader, SessionManager } from "@earendil-works/pi-coding-agent";
import { HOTKEYS } from "../src/key.ts";
import { createChild } from "../src/spawn.ts";
import { makeChildWorld, type ChildWorld } from "./helpers/child-world.ts";
import { ignoreHandlers } from "./helpers/handlers.ts";
import { loadDelegate, PACKAGE_DIR } from "./helpers/load-extension.ts";

describe("pi-delegate extension", () => {
	test("registers the delegate and reply tools, the /sub command, and one shortcut per hotkey", async () => {
		const extension = await loadDelegate();

		expect([...extension.tools.keys()]).toEqual(["delegate", "reply"]);
		expect([...extension.commands.keys()]).toEqual(["sub"]);
		expect([...extension.shortcuts.keys()]).toEqual([...HOTKEYS]);
	});

	test("does not give the parent the report tool", async () => {
		const extension = await loadDelegate();

		expect(extension.tools.has("report")).toBe(false);
	});

	test("renders the child's messages itself", async () => {
		const extension = await loadDelegate();

		expect(extension.messageRenderers.has("delegate_message")).toBe(true);
	});
});

describe("pi-delegate across a second load of the extension", () => {
	let world: ChildWorld;
	let previousAgentDir: string | undefined;
	beforeEach(async () => {
		world = await makeChildWorld();
		world.faux.setResponses([fauxAssistantMessage(fauxToolCall("report", { synopsis: "Found it." }))]);
		previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = world.environment.agentDir;
	});
	afterEach(() => {
		if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
		world.dispose();
	});

	test("/sub still lists a child started before another loader loaded pi-delegate", async () => {
		const extension = await loadDelegate();
		const delegate = extension.tools.get("delegate")!.definition;
		const ctx = {
			cwd: world.environment.cwd,
			model: world.environment.model,
			thinkingLevel: undefined,
			sessionManager: { getSessionFile: () => "/parent.jsonl" },
		};
		await delegate.execute("call-1", { name: "finder", brief: "Find the thing." }, undefined, undefined, ctx as never);

		const again = new DefaultResourceLoader({
			cwd: world.environment.cwd,
			agentDir: world.environment.agentDir,
			additionalExtensionPaths: [PACKAGE_DIR],
		});
		await again.reload();

		const offered: string[][] = [];
		const notices: string[] = [];
		await extension.commands.get("sub")!.handler("", {
			cwd: world.environment.cwd,
			sessionManager: { getSessionFile: () => "/parent.jsonl" },
			ui: {
				select: async (_title: string, options: string[]) => {
					offered.push(options);
					return undefined;
				},
				notify: (message: string) => notices.push(message),
			},
		} as never);

		expect(notices).toEqual([]);
		expect(offered.flat().some((label) => label.includes("finder"))).toBe(true);
	});

	test("/sub offers a child that exists only on disk and resumes it when chosen", async () => {
		const extension = await loadDelegate();
		const orphan = await createChild(
			{
				...world.environment,
				openSession: () => SessionManager.create(world.environment.cwd, undefined, { parentSession: "/parent.jsonl" }),
			},
			{ name: "reader", brief: "Read the thing." },
		);
		await orphan.start(ignoreHandlers);
		orphan.session.dispose();
		const offered: string[][] = [];
		let opened = 0;
		const ctx = {
			cwd: world.environment.cwd,
			model: world.environment.model,
			thinkingLevel: undefined,
			sessionManager: { getSessionFile: () => "/parent.jsonl" },
			ui: {
				select: async (_title: string, options: string[]) => {
					offered.push(options);
					return options.find((label) => label.includes("reader"));
				},
				custom: async () => void opened++,
				notify: () => {},
			},
		};
		const sub = extension.commands.get("sub")!.handler;

		await sub("", ctx as never);
		await sub("", ctx as never);

		expect(offered[0]?.[0]).toMatch(/^       reader  finished /);
		expect(offered[1]?.[0]).toMatch(/^       reader  finished /);
		expect(opened).toBe(2);
	});
});
