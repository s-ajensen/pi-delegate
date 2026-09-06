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

export function chooseModel(pattern: string | undefined, parent: Choice, modelRuntime: ModelRuntime): Choice {
	if (pattern === undefined) return parent;
	const resolved = resolveCliModel({ cliModel: pattern, modelRuntime });
	if (!resolved.model) throw new Error(resolved.error ?? `Model "${pattern}" could not be resolved.`);
	return { model: resolved.model, thinkingLevel: resolved.thinkingLevel };
}
