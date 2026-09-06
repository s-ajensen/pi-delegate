import { describeAge } from "./age.ts";
import { hotkey, pressable } from "./key.ts";
import type { Entry } from "./registry.ts";
import { CHILD_NAME_PREFIX } from "./seed.ts";

export interface SessionCandidate {
	path: string;
	parentSessionPath?: string;
	name?: string;
	modified: Date;
}

export interface DiskChild {
	path: string;
	name: string;
	modified: Date;
}

export interface LiveChild<C> {
	entry: Entry<C>;
	path: string | undefined;
	streaming: boolean;
	modified: Date | undefined;
}

export interface Row<C> {
	label: string;
	name: string;
	path: string | undefined;
	live?: Entry<C>;
}

const KEY_WIDTH = "alt+1".length;

function stripTrailingSlashes(path: string): string {
	return path.replace(/\/+$/, "");
}

export function findChildren(candidates: SessionCandidate[], parentSessionFile: string): DiskChild[] {
	const parent = stripTrailingSlashes(parentSessionFile);
	return candidates
		.filter(
			(candidate) =>
				candidate.parentSessionPath !== undefined &&
				stripTrailingSlashes(candidate.parentSessionPath) === parent &&
				candidate.name?.startsWith(CHILD_NAME_PREFIX),
		)
		.map((candidate) => ({
			path: candidate.path,
			name: (candidate.name ?? "").slice(CHILD_NAME_PREFIX.length),
			modified: candidate.modified,
		}));
}

interface Draft<C> {
	key: number | undefined;
	name: string;
	state: string;
	path: string | undefined;
	live?: Entry<C>;
}

export function mergeChildren<C>(live: LiveChild<C>[], onDisk: DiskChild[], now: Date): Row<C>[] {
	const finishedAt = (modified: Date | undefined) => `finished ${modified ? describeAge(modified, now) : "just now"}`;
	const running: Draft<C>[] = live
		.filter((child) => child.entry.key !== undefined)
		.sort((a, b) => (a.entry.key ?? 0) - (b.entry.key ?? 0))
		.map((child) => ({
			key: child.entry.key,
			name: child.entry.name,
			state: child.streaming ? "working" : "waiting",
			path: child.path,
			live: child.entry,
		}));
	const finishedLive: Draft<C>[] = live
		.filter((child) => child.entry.key === undefined)
		.map((child) => ({ key: undefined, name: child.entry.name, state: finishedAt(child.modified), path: child.path, live: child.entry }));
	const livePaths = new Set(live.map((child) => child.path).filter((path) => path !== undefined));
	const finishedDisk: Draft<C>[] = onDisk
		.filter((child) => !livePaths.has(child.path))
		.map((child) => ({ key: undefined, name: child.name, state: finishedAt(child.modified), path: child.path }));
	return layout([...running, ...finishedLive, ...finishedDisk]);
}

function layout<C>(drafts: Draft<C>[]): Row<C>[] {
	const nameWidth = Math.max(0, ...drafts.map((draft) => draft.name.length));
	const seen = new Map<string, number>();
	return drafts.map((draft) => {
		const key = (pressable(draft.key) ? hotkey(draft.key) : "").padEnd(KEY_WIDTH);
		const base = `${key}  ${draft.name.padEnd(nameWidth)}  ${draft.state}`;
		const count = (seen.get(base) ?? 0) + 1;
		seen.set(base, count);
		const label = count === 1 ? base : `${base} (${count})`;
		return draft.live ? { label, name: draft.name, path: draft.path, live: draft.live } : { label, name: draft.name, path: draft.path };
	});
}
