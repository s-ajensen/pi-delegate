import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Model } from "@earendil-works/pi-ai";
import { chooseModel, readDefaults } from "../src/model.ts";
import { makeChildWorld, type ChildWorld } from "./helpers/child-world.ts";

describe("readDefaults", () => {
	let root: string;
	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "pi-delegate-defaults-"));
	});
	afterEach(() => rmSync(root, { recursive: true, force: true }));

	test("is empty when the agent dir has no delegate.json", () => {
		expect(readDefaults(root)).toEqual({});
	});

	test("reads the configured model pattern", () => {
		writeFileSync(join(root, "delegate.json"), JSON.stringify({ model: "faux/faux-1:high" }));
		expect(readDefaults(root)).toEqual({ model: "faux/faux-1:high" });
	});

	test("rejects a malformed file plainly", () => {
		writeFileSync(join(root, "delegate.json"), "{not json");
		expect(() => readDefaults(root)).toThrow(/delegate\.json/);
	});
});

describe("chooseModel", () => {
	let world: ChildWorld;
	const parent = { model: { provider: "parent", id: "parent-model" } as Model<string>, thinkingLevel: "low" as const };
	beforeEach(async () => {
		world = await makeChildWorld();
	});
	afterEach(() => world.dispose());

	test("errors on a pattern that matches no model", () => {
		expect(() => chooseModel("nope/none", parent, world.environment.modelRuntime)).toThrow(/not found/);
	});

	test("falls back to the parent's model and thinking level when no pattern is set", () => {
		expect(chooseModel(undefined, parent, world.environment.modelRuntime)).toEqual(parent);
	});

	test("resolves a pattern and leaves thinking to pi's defaults when the pattern omits it", () => {
		const choice = chooseModel("faux-1", parent, world.environment.modelRuntime);

		expect(choice.model.id).toBe("faux-1");
		expect(choice.thinkingLevel).toBeUndefined();
	});

	test("takes the thinking level from the pattern", () => {
		const choice = chooseModel("faux/faux-1:high", parent, world.environment.modelRuntime);

		expect(choice.model.id).toBe("faux-1");
		expect(choice.thinkingLevel).toBe("high");
	});
});
