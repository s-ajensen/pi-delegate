import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fauxAssistantMessage, fauxText } from "@earendil-works/pi-ai";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { ChildOverlay, MOUSE_OFF, MOUSE_ON } from "../src/overlay.ts";
import { createChild, type Child } from "../src/spawn.ts";
import { makeChildWorld, type ChildWorld } from "./helpers/child-world.ts";
import { FakeTerminal, makeFullscreenTuiOver, makeTui, makeTuiOver, stripAnsi } from "./helpers/fake-terminal.ts";
import { ignoreHandlers } from "./helpers/handlers.ts";

const ESCAPE = "\x1b";
const ENTER = "\r";
const CTRL_X = "\x18";
const PAGE_UP = "\x1b[5~";
const PAGE_DOWN = "\x1b[6~";
const WHEEL_UP = "\x1b[<64;10;5M";
const WHEEL_DOWN = "\x1b[<65;10;5M";
const CLICK = "\x1b[<0;10;5M\x1b[<0;10;5m";

function untilAgentEnd(session: AgentSession): Promise<void> {
	return new Promise((resolve) => {
		const stop = session.subscribe((event) => {
			if (event.type !== "agent_end") return;
			stop();
			resolve();
		});
	});
}

function typeText(overlay: ChildOverlay, text: string): void {
	for (const char of text) overlay.handleInput(char);
}

describe("ChildOverlay", () => {
	let world: ChildWorld;
	let child: Child;
	let closed: number;
	const open = (rows = 24) => new ChildOverlay("finder", child, makeTui(80, rows), () => closed++);

	beforeEach(async () => {
		world = await makeChildWorld();
		child = await createChild(world.environment, { name: "finder", brief: "Find the thing." });
		closed = 0;
	});
	afterEach(() => world.dispose());

	test("escape closes the overlay and leaves the child alone", () => {
		const overlay = open();
		overlay.handleInput(ESCAPE);

		expect(closed).toBe(1);
		expect(child.session.messages).toEqual([]);
	});

	test("shows the child's name and state in the header", () => {
		const text = stripAnsi(open().render(80));

		expect(text).toContain("finder");
		expect(text).toContain("waiting");
	});

	test("enter sends the typed text to an idle child as a new prompt, marked as the human's", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText("Sure."))]);
		const overlay = open();
		const ended = untilAgentEnd(child.session);

		typeText(overlay, "Look in src.");
		overlay.handleInput(ENTER);
		await ended;

		const userTexts = child.session.messages
			.filter((message) => message.role === "user")
			.map((message) => JSON.stringify(message.content));
		expect(userTexts.some((text) => text.includes("Human: Look in src."))).toBe(true);
		expect(stripAnsi(overlay.render(80))).toContain("Sure.");
	});

	test("keeps only the tail of a long transcript within the terminal minus the margin", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText(Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n")))]);
		await child.start(ignoreHandlers);

		const lines = open(20).render(78);

		expect(lines.length).toBe(18);
		expect(stripAnsi(lines)).toContain("line 39");
		expect(stripAnsi(lines)).not.toContain("line 0\n");
	});

	test("shows the child's model, context share and cost under the transcript", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText("Sure."))]);
		await child.start(ignoreHandlers);

		const text = stripAnsi(open().render(80));

		expect(text).toMatch(/faux-1  ctx \S+  \$\d+\.\d{3}/);
	});

	test("page up scrolls the transcript back and page down returns to the tail", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText(Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n")))]);
		await child.start(ignoreHandlers);
		const overlay = open(20);

		overlay.handleInput(PAGE_UP);
		const scrolled = stripAnsi(overlay.render(78));
		overlay.handleInput(PAGE_DOWN);
		const back = stripAnsi(overlay.render(78));

		expect(scrolled).not.toContain("line 39");
		expect(scrolled).toContain("scrolled");
		expect(back).toContain("line 39");
		expect(back).not.toContain("scrolled");
	});

	test("in regular mode, turns terminal mouse tracking on while open and off when disposed", () => {
		const terminal = new FakeTerminal();
		const overlay = new ChildOverlay("finder", child, makeTuiOver(terminal), () => {});

		expect(terminal.written.join("")).toContain(MOUSE_ON);
		overlay.dispose();
		expect(terminal.written.join("")).toContain(MOUSE_OFF);
	});

	test("in fullscreen mode, leaves the terminal's mouse modes to pi", () => {
		const terminal = new FakeTerminal();
		const overlay = new ChildOverlay("finder", child, makeFullscreenTuiOver(terminal), () => {});
		overlay.dispose();

		expect(terminal.written.join("")).not.toContain(MOUSE_ON);
		expect(terminal.written.join("")).not.toContain(MOUSE_OFF);
	});

	test("in fullscreen mode, takes wheel events from pi through handleMouse", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText(Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n")))]);
		await child.start(ignoreHandlers);
		const overlay = new ChildOverlay("finder", child, makeFullscreenTuiOver(new FakeTerminal(80, 20)), () => {});
		const wheel = (wheelDelta: number) =>
			overlay.handleMouse({ type: "wheel", button: "none", x: 0, y: 0, screenX: 0, screenY: 0, width: 80, height: 20, shift: false, alt: false, ctrl: false, wheelDelta });

		const up = wheel(-3);
		const scrolled = stripAnsi(overlay.render(78));
		wheel(3);
		const back = stripAnsi(overlay.render(78));
		const ignored = overlay.handleMouse({ type: "click", button: "left", x: 0, y: 0, screenX: 0, screenY: 0, width: 80, height: 20, shift: false, alt: false, ctrl: false });

		expect(up).toEqual({ handled: true });
		expect(scrolled).toContain("scrolled 3 up");
		expect(back).not.toContain("scrolled");
		expect(ignored).toBeUndefined();
	});

	test("the wheel scrolls the transcript three lines per notch, and back", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText(Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n")))]);
		await child.start(ignoreHandlers);
		const overlay = open(20);

		overlay.handleInput(WHEEL_UP + WHEEL_UP);
		const scrolled = stripAnsi(overlay.render(78));
		overlay.handleInput(WHEEL_DOWN);
		const partway = stripAnsi(overlay.render(78));
		overlay.handleInput(WHEEL_DOWN);
		const back = stripAnsi(overlay.render(78));

		expect(scrolled).toContain("scrolled 6 up");
		expect(partway).toContain("scrolled 3 up");
		expect(back).not.toContain("scrolled");
	});

	test("other mouse sequences are swallowed, not typed into the editor", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText("Sure."))]);
		const overlay = open();

		overlay.handleInput(CLICK);
		typeText(overlay, "hi");
		const ended = untilAgentEnd(child.session);
		overlay.handleInput(ENTER);
		await ended;

		const sent = child.session.messages.find((m) => m.role === "user");
		expect(sent ? JSON.stringify(sent.content) : "").toContain("Human: hi");
		expect(sent ? JSON.stringify(sent.content) : "").not.toContain("[<");
	});

	test("page up stops at the top of the transcript", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText("short"))]);
		await child.start(ignoreHandlers);
		const overlay = open();

		for (let i = 0; i < 10; i++) overlay.handleInput(PAGE_UP);

		const text = stripAnsi(overlay.render(80));
		expect(text).toContain("You are a subagent");
		expect(text).toMatch(/scrolled \d+ up/);
	});

	test("draws a border around the whole overlay", () => {
		const lines = open().render(40);

		expect(stripAnsi([lines[0] ?? ""])).toBe(`┌${"─".repeat(38)}┐`);
		expect(stripAnsi([lines.at(-1) ?? ""])).toBe(`└${"─".repeat(38)}┘`);
		for (const line of lines.slice(1, -1)) expect(stripAnsi([line])).toMatch(/^│.*│$/);
	});
});

describe("ChildOverlay abort", () => {
	let world: ChildWorld;
	beforeEach(async () => {
		world = await makeChildWorld({ faux: { tokensPerSecond: 20 } });
	});
	afterEach(() => world.dispose());

	test("shows a message typed mid-turn as queued, until the child takes it", async () => {
		world.faux.setResponses([
			fauxAssistantMessage(fauxText("one two three four five six seven eight nine ten eleven twelve")),
			fauxAssistantMessage(fauxText("Taken.")),
		]);
		const child = await createChild(world.environment, { name: "finder", brief: "Find the thing." });
		const overlay = new ChildOverlay("finder", child, makeTui(), () => {});
		const run = child.start(ignoreHandlers);
		await new Promise((resolve) => setTimeout(resolve, 50));

		typeText(overlay, "Look in src.");
		overlay.handleInput(ENTER);
		const queued = stripAnsi(overlay.render(80));
		await run;
		const taken = stripAnsi(overlay.render(80));

		expect(queued).toContain("Steering: Human: Look in src.");
		expect(queued).toContain("ctrl+x");
		expect(taken).not.toContain("Steering:");
		expect(taken).toContain("Taken.");
	});

	test("ctrl+x aborts a streaming child", async () => {
		world.faux.setResponses([fauxAssistantMessage(fauxText("one two three four five six seven eight nine ten"))]);
		const child = await createChild(world.environment, { name: "finder", brief: "Find the thing." });
		const overlay = new ChildOverlay("finder", child, makeTui(), () => {});
		const run = child.start(ignoreHandlers);
		await new Promise((resolve) => setTimeout(resolve, 50));

		overlay.handleInput(CTRL_X);
		await run;

		const last = child.session.messages.at(-1);
		expect(last?.role === "assistant" ? last.stopReason : undefined).toBe("aborted");
	});
});
