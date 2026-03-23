// Function composition — pipe N functions left-to-right
export function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg);
}

// Generic groupBy via reduce
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}

// Composable filter — curried HOF returning a filter function
export const filterByCompleted = (completed: boolean | null) => <T extends { completed: boolean }>(items: T[]) =>
  completed === null ? items : items.filter(t => t.completed === completed);

export const sortByPosition = <T extends { position: number }>(items: T[]) =>
  [...items].sort((a, b) => a.position - b.position);

// Pure function — compute account status from credit percentage
export function computeStatus(
  used: number,
  total: number,
): "go" | "standby" | "no-go" {
  if (total === 0) return "go";
  const pct = ((total - used) / total) * 100;
  if (pct < 5) return "no-go";
  if (pct <= 25) return "standby";
  return "go";
}
