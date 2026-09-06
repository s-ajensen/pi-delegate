import { describe, expect, test } from "bun:test";
import { describeUsage, sumCost } from "../src/usage.ts";

const assistant = (total: number) => ({ type: "message", message: { role: "assistant", usage: { cost: { total } } } });

describe("sumCost", () => {
	test("is zero with no assistant messages", () => {
		expect(sumCost([{ type: "message", message: { role: "user" } }])).toBe(0);
	});

	test("adds the cost of every assistant message", () => {
		expect(sumCost([assistant(0.01), { type: "session" }, assistant(0.02)])).toBeCloseTo(0.03);
	});
});

describe("describeUsage", () => {
	test("shows model, context share and cost", () => {
		expect(describeUsage("gpt-6-astra", { tokens: 12000, contextWindow: 100000, percent: 12 }, 0.0431)).toBe(
			"gpt-6-astra  ctx 12%  $0.043",
		);
	});

	test("shows context as unknown right after compaction", () => {
		expect(describeUsage("gpt-6-astra", { tokens: null, contextWindow: 100000, percent: null }, 0)).toBe(
			"gpt-6-astra  ctx ?  $0.000",
		);
	});

	test("copes with no model and no usage yet", () => {
		expect(describeUsage(undefined, undefined, 0)).toBe("no model  ctx ?  $0.000");
	});
});
