import { getSelectListTheme, Theme } from "@earendil-works/pi-coding-agent";
import {
	Editor,
	matchesKey,
	truncateToWidth,
	type Component,
	type Focusable,
	type OverlayOptions,
	type TUI,
	type TuiMouseEvent,
	type TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import { prefixHuman } from "./deliver.ts";
import { FRAME_COLUMNS, FRAME_ROWS, frame } from "./frame.ts";
import { buildChildName } from "./seed.ts";
import type { Child } from "./spawn.ts";
import { ChildTranscript } from "./transcript.ts";
import { describeUsage, sumCost } from "./usage.ts";

export const OVERLAY_MARGIN = 1;
export const OVERLAY_OPTIONS: OverlayOptions = { width: "100%", maxHeight: "100%", margin: OVERLAY_MARGIN };
export const MOUSE_ON = "\x1b[?1000h\x1b[?1006h";
export const MOUSE_OFF = "\x1b[?1006l\x1b[?1000l";
const CHROME_ROWS = 2;
const WHEEL_LINES = 3;
const SGR_MOUSE = /\x1b\[<(\d+);\d+;\d+[Mm]/g;
const ANY_SGR_MOUSE = /\x1b\[<\d+;\d+;\d+[Mm]/;
const WHEEL_UP_BUTTON = 64;
const WHEEL_DOWN_BUTTON = 65;

export class ChildOverlay implements Component, Focusable {
	focused = false;
	private readonly transcript: ChildTranscript;
	private readonly editor: Editor;
	private readonly unfollow: () => void;
	private scrolledBack = 0;

	constructor(
		private readonly name: string,
		private readonly child: Child,
		private readonly tui: TUI,
		private readonly close: () => void,
		private readonly theme?: Theme,
	) {
		this.transcript = new ChildTranscript(child.session, tui);
		this.unfollow = this.transcript.follow();
		this.editor = new Editor(tui, { borderColor: (text) => text, selectList: getSelectListTheme() });
		this.editor.onSubmit = (text) => this.send(text);
		if (this.ownsMouseModes()) tui.terminal.write(MOUSE_ON);
	}

	handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		if (event.type !== "wheel" || !event.wheelDelta) return undefined;
		this.scrollBy(-event.wheelDelta);
		return { handled: true };
	}

	handleInput(data: string): void {
		if (ANY_SGR_MOUSE.test(data)) return this.scrollByWheel(data);
		if (matchesKey(data, "escape")) return this.close();
		if (matchesKey(data, "ctrl+x")) return void this.child.session.abort();
		if (matchesKey(data, "pageUp")) return this.scroll(1);
		if (matchesKey(data, "pageDown")) return this.scroll(-1);
		this.editor.handleInput(data);
	}

	render(width: number): string[] {
		this.editor.focused = this.focused;
		const inner = width - FRAME_COLUMNS;
		const editorLines = this.editor.render(inner);
		const lines = this.transcript.render(inner);
		const visible = Math.max(0, this.rowBudget() - CHROME_ROWS - editorLines.length);
		this.scrolledBack = Math.min(this.scrolledBack, Math.max(0, lines.length - visible));
		const end = lines.length - this.scrolledBack;
		const window = lines.slice(Math.max(0, end - visible), end);
		return frame(
			[this.renderHeader(inner), ...window, this.renderFooter(inner), ...this.renderQueued(inner), ...editorLines],
			width,
			this.paintBorder,
		);
	}

	invalidate(): void {
		this.transcript.invalidate();
		this.editor.invalidate();
	}

	dispose(): void {
		if (this.ownsMouseModes()) this.tui.terminal.write(MOUSE_OFF);
		this.unfollow();
	}

	private ownsMouseModes(): boolean {
		return this.tui.mode !== "fullscreen";
	}

	private scrollByWheel(data: string): void {
		let lines = 0;
		for (const match of data.matchAll(SGR_MOUSE)) {
			const button = Number(match[1]);
			if (button === WHEEL_UP_BUTTON) lines += WHEEL_LINES;
			if (button === WHEEL_DOWN_BUTTON) lines -= WHEEL_LINES;
		}
		if (lines !== 0) this.scrollBy(lines);
	}

	private rowBudget(): number {
		return this.tui.terminal.rows - 2 * OVERLAY_MARGIN - FRAME_ROWS;
	}

	private scroll(direction: 1 | -1): void {
		this.scrollBy(direction * Math.max(1, Math.floor(this.rowBudget() / 2)));
	}

	private scrollBy(lines: number): void {
		this.scrolledBack = Math.max(0, this.scrolledBack + lines);
		this.tui.requestRender();
	}

	private readonly paintBorder = (text: string) => (this.theme ? this.theme.fg("borderMuted", text) : text);

	private renderHeader(width: number): string {
		const state = this.child.session.isStreaming ? "working" : "waiting";
		const position = this.scrolledBack > 0 ? `  scrolled ${this.scrolledBack} up` : "";
		const keys = "esc close  ctrl+x abort  pgup/pgdn scroll";
		const text = `${buildChildName(this.name)}  ${state}${position}  ${keys}`.slice(0, width);
		return this.theme ? this.theme.bold(text) : text;
	}

	private renderQueued(width: number): string[] {
		const session = this.child.session;
		const lines = [
			...session.getSteeringMessages().map((text) => `Steering: ${text}`),
			...session.getFollowUpMessages().map((text) => `Follow-up: ${text}`),
		];
		if (lines.length === 0) return [];
		lines.push("\u21b3 delivered after the current tool call; ctrl+x interrupts it");
		return lines.map((line) => truncateToWidth(line, width)).map((line) => (this.theme ? this.theme.fg("dim", line) : line));
	}

	private renderFooter(width: number): string {
		const session = this.child.session;
		const text = describeUsage(session.model?.id, session.getContextUsage(), sumCost(session.sessionManager.getEntries()));
		const padded = text.slice(0, width);
		return this.theme ? this.theme.fg("muted", padded) : padded;
	}

	private send(text: string): void {
		const trimmed = text.trim();
		if (trimmed === "") return;
		this.editor.setText("");
		this.scrolledBack = 0;
		this.child.send(prefixHuman(trimmed)).catch(() => {});
	}
}
