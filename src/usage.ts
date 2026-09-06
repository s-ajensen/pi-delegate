import type { ContextUsage } from "@earendil-works/pi-coding-agent";

interface EntryLike {
	type: string;
	message?: { role: string; usage?: { cost?: { total?: number } } };
}

export function sumCost(entries: EntryLike[]): number {
	let total = 0;
	for (const entry of entries) {
		if (entry.type !== "message" || entry.message?.role !== "assistant") continue;
		total += entry.message.usage?.cost?.total ?? 0;
	}
	return total;
}

export function describeUsage(model: string | undefined, usage: ContextUsage | undefined, cost: number): string {
	const context = usage?.percent === null || usage?.percent === undefined ? "?" : `${Math.round(usage.percent)}%`;
	return `${model ?? "no model"}  ctx ${context}  $${cost.toFixed(3)}`;
}
