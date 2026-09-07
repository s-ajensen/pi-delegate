import { createEventBus, discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";

export const PACKAGE_DIR = new URL("../..", import.meta.url).pathname;

export async function loadDelegate() {
	const result = await discoverAndLoadExtensions([PACKAGE_DIR], PACKAGE_DIR, PACKAGE_DIR, createEventBus());
	if (result.errors?.length) throw new Error(`extension failed to load: ${JSON.stringify(result.errors)}`);
	const extension = result.extensions.find((candidate) => candidate.tools.has("delegate"));
	if (!extension) throw new Error("pi-delegate not found among loaded extensions");
	const sent: unknown[] = [];
	result.runtime.sendMessage = ((message: unknown) => {
		sent.push(message);
	}) as never;
	return { extension, sent };
}
