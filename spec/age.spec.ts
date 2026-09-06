import { describe, expect, test } from "bun:test";
import { describeAge } from "../src/age.ts";

const now = new Date("2026-09-05T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("describeAge", () => {
	test("under a minute is just now", () => {
		expect(describeAge(ago(30_000), now)).toBe("just now");
	});

	test("minutes, hours and days", () => {
		expect(describeAge(ago(12 * 60_000), now)).toBe("12m ago");
		expect(describeAge(ago(3 * 3_600_000), now)).toBe("3h ago");
		expect(describeAge(ago(2 * 86_400_000), now)).toBe("2d ago");
	});
});
