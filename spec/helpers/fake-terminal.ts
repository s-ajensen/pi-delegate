import { TuiAltScreen, TuiMainScreen, type Terminal, type TUI } from "@earendil-works/pi-tui";
import { initTheme } from "@earendil-works/pi-coding-agent";

export class FakeTerminal implements Terminal {
	written: string[] = [];
	constructor(
		public readonly columns = 80,
		public readonly rows = 24,
	) {}
	start(): void {}
	stop(): void {}
	async drainInput(): Promise<void> {}
	write(data: string): void {
		this.written.push(data);
	}
	get kittyProtocolActive(): boolean {
		return false;
	}
	moveBy(): void {}
	hideCursor(): void {}
	showCursor(): void {}
	clearLine(): void {}
	clearFromCursor(): void {}
	clearScreen(): void {}
	setTitle(): void {}
	setProgress(): void {}
}

export function makeTuiOver(terminal: FakeTerminal): TUI {
	initTheme("dark");
	return new TuiMainScreen(terminal);
}

export function makeTui(columns = 80, rows = 24): TUI {
	return makeTuiOver(new FakeTerminal(columns, rows));
}

export function makeFullscreenTuiOver(terminal: FakeTerminal): TUI {
	initTheme("dark");
	return new TuiAltScreen(terminal);
}

const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

export function stripAnsi(lines: string[]): string {
	return lines.map((line) => line.replace(ANSI, "")).join("\n");
}
