import { getSelectListTheme, Theme } from "@earendil-works/pi-coding-agent";
import { Editor, matchesKey, type Component, type Focusable, type OverlayOptions, type TUI } from "@earendil-works/pi-tui";
import { prefixHuman } from "./deliver.ts";
import { FRAME_COLUMNS, FRAME_ROWS, frame } from "./frame.ts";
import { buildChildName } from "./seed.ts";
import type { Child } from "./spawn.ts";
import { ChildTranscript } from "./transcript.ts";
import { describeUsage, sumCost } from "./usage.ts";

export const OVERLAY_MARGIN = 1;
export const OVERLAY_OPTIONS: OverlayOptions = { width: "100%", maxHeight: "100%", margin: OVERLAY_MARGIN };
const CHROME_ROWS = 2;

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
	}

	handleInput(data: string): void {
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
		return frame([this.renderHeader(inner), ...window, this.renderFooter(inner), ...editorLines], width, this.paintBorder);
	}

	invalidate(): void {
		this.transcript.invalidate();
		this.editor.invalidate();
	}

	dispose(): void {
		this.unfollow();
	}

	private rowBudget(): number {
		return this.tui.terminal.rows - 2 * OVERLAY_MARGIN - FRAME_ROWS;
	}

	private scroll(direction: 1 | -1): void {
		const step = Math.max(1, Math.floor(this.rowBudget() / 2));
		this.scrolledBack = Math.max(0, this.scrolledBack + direction * step);
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
