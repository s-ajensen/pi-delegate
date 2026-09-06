export type Select = (options: string[]) => Promise<string | undefined>;

export async function pickOne<R extends { label: string }>(rows: R[], select: Select): Promise<R | undefined> {
	if (rows.length === 0) return undefined;
	const chosen = await select(rows.map((row) => row.label));
	return rows.find((row) => row.label === chosen);
}
