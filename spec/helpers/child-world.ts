import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	fauxProvider,
	InMemoryCredentialStore,
	type FauxProviderHandle,
	type RegisterFauxProviderOptions,
} from "@earendil-works/pi-ai";
import {
	DefaultResourceLoader,
	ModelRuntime,
	SessionManager,
	SettingsManager,
	type InlineExtension,
} from "@earendil-works/pi-coding-agent";
import type { ChildEnvironment } from "../../src/spawn.ts";

export interface ChildWorld {
	faux: FauxProviderHandle;
	environment: ChildEnvironment;
	dispose(): void;
}

export interface ChildWorldOptions {
	faux?: RegisterFauxProviderOptions;
	extensions?: InlineExtension[];
}

export async function makeChildWorld(options: ChildWorldOptions = {}): Promise<ChildWorld> {
	const fauxOptions = options.faux;
	const root = mkdtempSync(join(tmpdir(), "pi-delegate-"));
	const faux = fauxProvider({ models: [{ id: "faux-1", reasoning: true }], ...fauxOptions });
	const modelRuntime = await ModelRuntime.create({
		credentials: new InMemoryCredentialStore(),
		modelsPath: null,
		modelsStorePath: join(root, "models-store.json"),
		refreshOnCreate: false,
	});
	modelRuntime.registerNativeProvider(faux.provider);
	const resourceLoader = new DefaultResourceLoader({
		cwd: root,
		agentDir: root,
		noExtensions: true,
		extensionFactories: options.extensions,
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
