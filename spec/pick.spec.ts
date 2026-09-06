import { describe, expect, test } from "bun:test";
import { pickOne } from "../src/pick.ts";

describe("pickOne", () => {
	test("returns nothing without asking when there are no rows", async () => {
		let asked = false;
		const picked = await pickOne([], async () => {
			asked = true;
			return undefined;
		});

		expect(picked).toBeUndefined();
		expect(asked).toBe(false);
	});

	test("offers every label and returns the chosen row", async () => {
		const rows = [{ label: "a" }, { label: "b" }];
		let offered: string[] = [];

		const picked = await pickOne(rows, async (options) => {
			offered = options;
			return "b";
		});

		expect(offered).toEqual(["a", "b"]);
		expect(picked).toBe(rows[1]);
	});

	test("returns nothing when the selection is cancelled", async () => {
		expect(await pickOne([{ label: "a" }], async () => undefined)).toBeUndefined();
	});
});
