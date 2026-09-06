const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function describeAge(then: Date, now: Date): string {
	const elapsed = now.getTime() - then.getTime();
	if (elapsed < MINUTE) return "just now";
	if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
	if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
	return `${Math.floor(elapsed / DAY)}d ago`;
}
