import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fauxProvider } from "@earendil-works/pi-ai";
import { buildEnvironment, loadShared } from "../src/environment.ts";

describe("environment", () => {
	let root: string;
	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "pi-delegate-env-"));
	});
	afterEach(() => rmSync(root, { recursive: true, force: true }));

	test("loadShared reads its resources from the given agent dir", async () => {
		const shared = await loadShared({ cwd: root, agentDir: root });

		expect(shared.resourceLoader.getExtensions().extensions).toEqual([]);
		expect(shared.modelRuntime.getModels()).toBeArray();
		expect(shared.defaults).toEqual({});
	});

	test("loadShared picks up the configured default model", async () => {
		writeFileSync(join(root, "delegate.json"), JSON.stringify({ model: "faux/faux-1:medium" }));

		const shared = await loadShared({ cwd: root, agentDir: root });

		expect(shared.defaults).toEqual({ model: "faux/faux-1:medium" });
	});

	test("buildEnvironment opens child sessions under the session dir, linked to the parent", async () => {
		const shared = await loadShared({ cwd: root, agentDir: root });
		const environment = buildEnvironment(shared, {
			model: fauxProvider().getModel(),
			thinkingLevel: "medium",
			parentSessionFile: "/elsewhere/parent.jsonl",
			sessionDir: join(root, "sessions"),
		});

		const session = environment.openSession();
		session.appendSessionInfo("sub: probe");

		expect(session.getHeader()?.parentSession).toBe("/elsewhere/parent.jsonl");
		expect(session.getSessionFile()).toStartWith(join(root, "sessions"));
		expect(environment.cwd).toBe(root);
		expect(environment.thinkingLevel).toBe("medium");
	});
});
