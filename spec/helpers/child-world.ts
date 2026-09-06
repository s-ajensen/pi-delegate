import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fauxProvider, type FauxProviderHandle, type RegisterFauxProviderOptions } from "@earendil-works/pi-ai";
import {
	DefaultResourceLoader,
	ModelRuntime,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { ChildEnvironment } from "../../src/spawn.ts";

export interface ChildWorld {
	faux: FauxProviderHandle;
	environment: ChildEnvironment;
	dispose(): void;
}

export async function makeChildWorld(fauxOptions?: RegisterFauxProviderOptions): Promise<ChildWorld> {
	const root = mkdtempSync(join(tmpdir(), "pi-delegate-"));
	const faux = fauxProvider({ models: [{ id: "faux-1", reasoning: true }], ...fauxOptions });
	const modelRuntime = await ModelRuntime.create({
		authPath: join(root, "auth.json"),
		modelsPath: null,
		modelsStorePath: join(root, "models-store.json"),
		refreshOnCreate: false,
	});
	modelRuntime.registerNativeProvider(faux.provider);
	const resourceLoader = new DefaultResourceLoader({
		cwd: root,
		agentDir: root,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
	});
	await resourceLoader.reload();
	return {
		faux,
		environment: {
			cwd: root,
			agentDir: root,
			modelRuntime,
			model: faux.getModel(),
			resourceLoader,
			settingsManager: SettingsManager.inMemory(),
			openSession: () => SessionManager.inMemory(root),
		},
		dispose: () => rmSync(root, { recursive: true, force: true }),
	};
}
