import type { Attention } from "./attention.ts";

export type ChildState = "running" | "reported" | "failed";

export interface Entry<C> extends Attention {
	key: number | undefined;
	name: string;
	child: C;
	state: ChildState;
}

export interface Registry<C> {
	add(name: string, child: C): Entry<C>;
	mark(entry: Entry<C>, state: ChildState): void;
	running(): Entry<C>[];
	all(): Entry<C>[];
	byKey(key: number): Entry<C> | undefined;
	byName(name: string): Entry<C> | undefined;
	subscribe(listener: () => void): () => void;
}

export function createRegistry<C>(): Registry<C> {
	const entries: Entry<C>[] = [];
	const listeners = new Set<() => void>();
	const notify = () => listeners.forEach((listener) => listener());
	const running = () =>
		entries.filter((entry) => entry.key !== undefined).sort((a, b) => (a.key ?? 0) - (b.key ?? 0));
	const lowestFreeKey = () => {
		const taken = new Set(entries.map((entry) => entry.key));
		let key = 1;
		while (taken.has(key)) key++;
		return key;
	};
	return {
		add(name, child) {
			const entry: Entry<C> = { key: lowestFreeKey(), name, child, state: "running", watched: false };
			entries.push(entry);
			notify();
			return entry;
		},
		mark(entry, state) {
			entry.state = state;
			if (state === "running") entry.key ??= lowestFreeKey();
			else entry.key = undefined;
			notify();
		},
		running,
		all: () => [...entries],
		byKey: (key) => entries.find((entry) => entry.key === key),
		byName: (name) => [...entries].reverse().find((entry) => entry.name === name),
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
