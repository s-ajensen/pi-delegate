import { describe, expect, test } from "bun:test";
import { frame } from "../src/frame.ts";

describe("frame", () => {
	test("draws a box around nothing", () => {
		expect(frame([], 6)).toEqual(["┌────┐", "└────┘"]);
	});

	test("pads each line to the inner width", () => {
		expect(frame(["ab", "abcd"], 8)).toEqual(["┌──────┐", "│ab    │", "│abcd  │", "└──────┘"]);
	});

	test("measures visible width, not escape codes", () => {
		const red = "\u001b[31mab\u001b[0m";
		expect(frame([red], 6)).toEqual(["┌────┐", `│${red}  │`, "└────┘"]);
	});

	test("paints the border through the given function", () => {
		expect(frame(["x"], 4, (text) => `<${text}>`)).toEqual(["<┌──┐>", "<│>x <│>", "<└──┘>"]);
	});
});
