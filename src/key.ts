export const HOTKEYS = ["alt+1", "alt+2", "alt+3", "alt+4", "alt+5", "alt+6", "alt+7", "alt+8", "alt+9"] as const;

export function hotkey(key: number): string {
	return `alt+${key}`;
}

export function pressable(key: number | undefined): key is number {
	return key !== undefined && key <= HOTKEYS.length;
}
