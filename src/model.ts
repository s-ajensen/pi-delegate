import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import { resolveCliModel, type ModelRuntime } from "@earendil-works/pi-coding-agent";

export interface Defaults {
	model?: string;
}

export interface Choice {
	model: Model<string>;
	thinkingLevel: ThinkingLevel | undefined;
}

const THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

export function defaultsPath(agentDir: string): string {
	return join(agentDir, "delegate.json");
}

export function readDefaults(agentDir: string): Defaults {
	const path = defaultsPath(agentDir);
	if (!existsSync(path)) return {};
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8")) as Defaults;
		return parsed.model === undefined ? {} : { model: parsed.model };
	} catch (error) {
		throw new Error(`Could not read ${path}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

export async function chooseModel(pattern: string | undefined, parent: Choice, modelRuntime: ModelRuntime): Promise<Choice> {
	if (pattern === undefined) return parent;
	const { base, thinkingLevel } = splitThinking(pattern);
	const usable = matchAmong(await modelRuntime.getAvailable(), base);
	if (usable.length === 1) return { model: usable[0]!, thinkingLevel };
	if (usable.length > 1) {
		const names = usable.map((model) => `${model.provider}/${model.id}`).join(", ");
		throw new Error(`Model "${base}" is ambiguous among the providers you can use: ${names}. Use provider/id.`);
	}
	const resolved = resolveCliModel({ cliModel: pattern, modelRuntime });
	if (!resolved.model) throw new Error(resolved.error ?? `Model "${pattern}" could not be resolved.`);
	return { model: resolved.model, thinkingLevel: resolved.thinkingLevel };
}

function splitThinking(pattern: string): { base: string; thinkingLevel: ThinkingLevel | undefined } {
	const colon = pattern.lastIndexOf(":");
	const suffix = colon === -1 ? undefined : pattern.slice(colon + 1);
	const level = THINKING_LEVELS.find((candidate) => candidate === suffix);
	return level ? { base: pattern.slice(0, colon), thinkingLevel: level } : { base: pattern, thinkingLevel: undefined };
}

function matchAmong(models: readonly Model<string>[], base: string): Model<string>[] {
	const wanted = base.toLowerCase();
	const exact = models.filter((model) => `${model.provider}/${model.id}`.toLowerCase() === wanted || model.id.toLowerCase() === wanted);
	if (exact.length > 0) return exact;
	return models.filter((model) => model.id.toLowerCase().includes(wanted));
}
