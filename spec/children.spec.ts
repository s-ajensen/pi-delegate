import { describe, expect, test } from "bun:test";
import { findChildren, mergeChildren, type LiveChild } from "../src/children.ts";
import { createRegistry, type Entry } from "../src/registry.ts";

const parent = "/s/parent.jsonl";
const now = new Date("2026-09-05T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe("findChildren", () => {
	test("keeps only sessions whose parent is this one and whose name marks them as subagents", () => {
		const found = findChildren(
			[
				{ path: "/s/a.jsonl", parentSessionPath: parent, name: "sub: finder", modified: now },
				{ path: "/s/b.jsonl", parentSessionPath: parent, name: "meta: parent.jsonl", modified: now },
				{ path: "/s/c.jsonl", parentSessionPath: "/s/other.jsonl", name: "sub: reader", modified: now },
				{ path: "/s/d.jsonl", name: "sub: orphan", modified: now },
			],
			parent,
		);

		expect(found.map((child) => child.path)).toEqual(["/s/a.jsonl"]);
	});

	test("ignores trailing slashes when matching the parent path", () => {
		const found = findChildren(
			[{ path: "/s/a.jsonl", parentSessionPath: `${parent}/`, name: "sub: finder", modified: now }],
			`${parent}//`,
		);

		expect(found).toHaveLength(1);
	});

	test("strips the prefix to give the child's plain name", () => {
		const found = findChildren([{ path: "/s/a.jsonl", parentSessionPath: parent, name: "sub: finder", modified: now }], parent);

		expect(found[0]?.name).toBe("finder");
	});
});

describe("mergeChildren", () => {
	type C = { file: string | undefined };
	const live = (entry: Entry<C>, streaming: boolean, modified?: Date): LiveChild<C> => ({
		entry,
		path: entry.child.file,
		streaming,
		modified,
	});

	test("lists running children by key and state, then finished ones by age, columns aligned", () => {
		const registry = createRegistry<C>();
		const working = registry.add("asker", { file: "/s/a.jsonl" });
		const done = registry.add("children", { file: "/s/b.jsonl" });
		registry.mark(done, "reported");
		const rows = mergeChildren(
			[live(working, true), live(done, false, minutesAgo(12))],
			[
				{ path: "/s/b.jsonl", name: "children", modified: minutesAgo(12) },
				{ path: "/s/c.jsonl", name: "bowling", modified: minutesAgo(90) },
			],
			now,
		);

		expect(rows.map((row) => row.label)).toEqual([
			"alt+1  asker     working",
			"       children  finished 12m ago",
			"       bowling   finished 1h ago",
		]);
		expect(rows[0]?.live).toBe(working);
		expect(rows[1]?.live).toBe(done);
		expect(rows[2]).toEqual({ label: "       bowling   finished 1h ago", name: "bowling", path: "/s/c.jsonl" });
	});

	test("shows a stopped child as waiting, and one beyond the ninth key without a key", () => {
		const registry = createRegistry<C>();
		for (let i = 0; i < 9; i++) registry.add(`c${i + 1}`, { file: undefined });
		const tenth = registry.add("tenth", { file: undefined });
		const first = registry.byKey(1)!;

		const rows = mergeChildren([live(first, false), live(tenth, true)], [], now);

		expect(rows.map((row) => row.label)).toEqual(["alt+1  c1     waiting", "       tenth  working"]);
	});

	test("keeps labels distinct when two finished children look the same", () => {
		const rows = mergeChildren(
			[],
			[
				{ path: "/s/a.jsonl", name: "asker", modified: minutesAgo(5) },
				{ path: "/s/b.jsonl", name: "asker", modified: minutesAgo(5) },
			],
			now,
		);

		expect(new Set(rows.map((row) => row.label)).size).toBe(2);
	});
});
