import { visibleWidth } from "@earendil-works/pi-tui";

export const FRAME_COLUMNS = 2;
export const FRAME_ROWS = 2;

export function frame(lines: string[], width: number, paint: (text: string) => string = (text) => text): string[] {
	const inner = Math.max(0, width - FRAME_COLUMNS);
	const rule = "─".repeat(inner);
	const side = paint("│");
	return [
		paint(`┌${rule}┐`),
		...lines.map((line) => `${side}${line}${" ".repeat(Math.max(0, inner - visibleWidth(line)))}${side}`),
		paint(`└${rule}┘`),
	];
}
