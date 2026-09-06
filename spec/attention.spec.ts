import { describe, expect, test } from "bun:test";
import { beginTurn, receiveStop, unwatch, watch, type Attention } from "../src/attention.ts";

function fresh(): { entry: Attention; delivered: string[]; deliver: (text: string) => void } {
	const delivered: string[] = [];
	return { entry: { watched: false }, delivered, deliver: (text) => delivered.push(text) };
}

describe("attention", () => {
	test("delivers a stop at once when nobody is watching", () => {
		const { entry, delivered, deliver } = fresh();
		receiveStop(entry, "Which file?", deliver);

		expect(delivered).toEqual(["Which file?"]);
		expect(entry.pending).toBeUndefined();
	});

	test("holds a stop while the human is watching", () => {
		const { entry, delivered, deliver } = fresh();
		watch(entry);
		receiveStop(entry, "Which file?", deliver);

		expect(delivered).toEqual([]);
		expect(entry.pending).toBe("Which file?");
	});

	test("delivers the held stop when the human stops watching without answering", () => {
		const { entry, delivered, deliver } = fresh();
		watch(entry);
		receiveStop(entry, "Which file?", deliver);
		unwatch(entry, deliver);

		expect(delivered).toEqual(["Which file?"]);
		expect(entry.pending).toBeUndefined();
		expect(entry.watched).toBe(false);
	});

	test("delivers nothing on unwatch when nothing was held", () => {
		const { entry, delivered, deliver } = fresh();
		watch(entry);
		unwatch(entry, deliver);

		expect(delivered).toEqual([]);
	});

	test("drops the held stop once a new turn begins, because someone answered", () => {
		const { entry, delivered, deliver } = fresh();
		watch(entry);
		receiveStop(entry, "Which file?", deliver);
		beginTurn(entry);
		unwatch(entry, deliver);

		expect(delivered).toEqual([]);
	});
});
