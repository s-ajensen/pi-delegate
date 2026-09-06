export interface Attention {
	watched: boolean;
	pending?: string;
}

export type Deliver = (text: string) => void;

export function watch(entry: Attention): void {
	entry.watched = true;
}

export function unwatch(entry: Attention, deliver: Deliver): void {
	entry.watched = false;
	const held = entry.pending;
	entry.pending = undefined;
	if (held !== undefined) deliver(held);
}

export function receiveStop(entry: Attention, text: string, deliver: Deliver): void {
	if (entry.watched) entry.pending = text;
	else deliver(text);
}

export function beginTurn(entry: Attention): void {
	entry.pending = undefined;
}
