import { describe, expect, test } from "bun:test";
import { createRegistry } from "../src/registry.ts";

describe("registry", () => {
	test("has nothing running when empty", () => {
		const registry = createRegistry<string>();
		expect(registry.running()).toEqual([]);
		expect(registry.byKey(1)).toBeUndefined();
	});

	test("an added child is running at alt+1", () => {
		const registry = createRegistry<string>();
		const entry = registry.add("finder", "child-a");

		expect(registry.running()).toEqual([entry]);
		expect(registry.byKey(1)).toBe(entry);
		expect(entry.key).toBe(1);
		expect(entry.state).toBe("running");
		expect(entry.watched).toBe(false);
	});

	test("a reported child gives up its key but stays in the full list", () => {
		const registry = createRegistry<string>();
		const entry = registry.add("finder", "child-a");
		registry.mark(entry, "reported");

		expect(registry.running()).toEqual([]);
		expect(registry.all()).toEqual([entry]);
		expect(entry.key).toBeUndefined();
		expect(entry.state).toBe("reported");
	});

	test("keys stay put when an earlier child finishes", () => {
		const registry = createRegistry<string>();
		const first = registry.add("finder", "child-a");
		const second = registry.add("reader", "child-b");
		registry.mark(first, "reported");

		expect(second.key).toBe(2);
		expect(registry.byKey(1)).toBeUndefined();
		expect(registry.byKey(2)).toBe(second);
	});

	test("a new child takes the lowest free key", () => {
		const registry = createRegistry<string>();
		const first = registry.add("finder", "child-a");
		registry.add("reader", "child-b");
		registry.mark(first, "failed");

		const third = registry.add("writer", "child-c");

		expect(third.key).toBe(1);
		expect(registry.running().map((entry) => entry.name)).toEqual(["writer", "reader"]);
	});

	test("a finished child that runs again takes a key again", () => {
		const registry = createRegistry<string>();
		const entry = registry.add("finder", "child-a");
		registry.mark(entry, "reported");
		registry.mark(entry, "running");

		expect(entry.key).toBe(1);
		expect(registry.running()).toEqual([entry]);
	});

	test("finds the most recent child of a name, finished or not", () => {
		const registry = createRegistry<string>();
		const older = registry.add("asker", "child-a");
		const newer = registry.add("asker", "child-b");
		registry.mark(newer, "reported");

		expect(registry.byName("asker")).toBe(newer);
		expect(registry.byName("nobody")).toBeUndefined();
		expect(older.state).toBe("running");
	});

	test("notifies subscribers on add and on state change", () => {
		const registry = createRegistry<string>();
		let notified = 0;
		registry.subscribe(() => notified++);
		const entry = registry.add("finder", "child-a");
		registry.mark(entry, "reported");

		expect(notified).toBe(2);
	});
});
