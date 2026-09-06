import { join } from "node:path";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import {
	DefaultResourceLoader,
	ModelRuntime,
	SessionManager,
	SettingsManager,
	type ResourceLoader,
} from "@earendil-works/pi-coding-agent";
import { readDefaults, type Defaults } from "./model.ts";
import type { ChildEnvironment } from "./spawn.ts";

export interface Home {
	cwd: string;
	agentDir: string;
}

export interface Shared extends Home {
	modelRuntime: ModelRuntime;
	resourceLoader: ResourceLoader;
	settingsManager: SettingsManager;
	defaults: Defaults;
}

export interface Placement {
	model: Model<string>;
	thinkingLevel: ThinkingLevel | undefined;
	parentSessionFile: string | undefined;
	sessionDir?: string;
}

export async function loadShared(home: Home): Promise<Shared> {
	const modelRuntime = await ModelRuntime.create({
		authPath: join(home.agentDir, "auth.json"),
		modelsPath: join(home.agentDir, "models.json"),
		refreshOnCreate: false,
	});
	const resourceLoader = new DefaultResourceLoader({ cwd: home.cwd, agentDir: home.agentDir });
	await resourceLoader.reload();
	return {
		...home,
		modelRuntime,
		resourceLoader,
		settingsManager: SettingsManager.create(home.cwd, home.agentDir),
		defaults: readDefaults(home.agentDir),
	};
}

export function buildEnvironment(shared: Shared, placement: Placement): ChildEnvironment {
	return {
		cwd: shared.cwd,
		agentDir: shared.agentDir,
		modelRuntime: shared.modelRuntime,
		model: placement.model,
		thinkingLevel: placement.thinkingLevel,
		resourceLoader: shared.resourceLoader,
		settingsManager: shared.settingsManager,
		openSession: () =>
			SessionManager.create(shared.cwd, placement.sessionDir, { parentSession: placement.parentSessionFile }),
	};
}
