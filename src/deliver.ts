import { hotkey } from "./key.ts";

export const CHILD_MESSAGE_TYPE = "delegate_message";

export type ChildMessageKind = "report" | "stop";

export interface ChildSource {
	key: number | undefined;
	name: string;
	model: string;
	sessionFile: string | undefined;
}

export interface ChildMessage {
	customType: typeof CHILD_MESSAGE_TYPE;
	content: string;
	display: true;
	details: ChildSource & { kind: ChildMessageKind; text: string };
}

const VERBS: Record<ChildMessageKind, string> = { report: "reports", stop: "says" };

export function describeSource(source: Pick<ChildSource, "key" | "name" | "model">): string {
	const parts = [source.key === undefined ? undefined : hotkey(source.key), source.model].filter((p) => p !== undefined);
	return `subagent "${source.name}" (${parts.join(", ")})`;
}

export function buildChildMessage(source: ChildSource, kind: ChildMessageKind, text: string): ChildMessage {
	const who = describeSource(source);
	return {
		customType: CHILD_MESSAGE_TYPE,
		content: `${who[0]?.toUpperCase()}${who.slice(1)} ${VERBS[kind]}:\n\n${text}`,
		display: true,
		details: { ...source, kind, text },
	};
}

export function prefixOrchestrator(model: string, text: string): string {
	return `Orchestrator (${model}): ${text}`;
}

export function prefixHuman(text: string): string {
	return `Human: ${text}`;
}
