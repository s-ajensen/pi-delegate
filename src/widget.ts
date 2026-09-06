import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { hotkey, pressable } from "./key.ts";
import type { Child } from "./spawn.ts";

export interface Snapshot {
	key: number;
	name: string;
	streaming: boolean;
	activity: string;
}

export function snapshotChild(key: number, name: string, child: Child): Snapshot {
	return { key, name, streaming: child.session.isStreaming, activity: describeActivity(child.session.messages) };
}

export function renderWidgetLines(running: Snapshot[]): string[] | undefined {
	if (running.length === 0) return undefined;
	return running.map((snapshot) => {
		const key = pressable(snapshot.key) ? hotkey(snapshot.key) : "/sub ";
		const state = snapshot.streaming ? "working" : "waiting";
		return [key, snapshot.name, state, snapshot.activity].filter((part) => part !== "").join("  ");
	});
}

export function describeActivity(messages: AgentMessage[]): string {
	const last = messages.at(-1);
	if (!last || last.role !== "assistant") return "";
	const lastBlock = last.content.at(-1);
	if (!lastBlock) return "";
	if (lastBlock.type === "toolCall") return lastBlock.name;
	if (lastBlock.type === "text") return lastBlock.text.split("\n")[0] ?? "";
	return "";
}
