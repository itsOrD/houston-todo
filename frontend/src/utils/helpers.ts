// Function composition — pipe N functions left-to-right (HOF bonus)
export function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg);
}

interface TaskLike {
  completed: boolean;
  position: number;
}

// Composable filter — curried HOF returning a filter function
export const filterByCompleted =
  <T extends TaskLike>(completed: boolean | null) =>
  (items: T[]): T[] =>
    completed === null ? items : items.filter((t) => t.completed === completed);

export const sortByPosition = <T extends TaskLike>(items: T[]): T[] =>
  [...items].sort((a, b) => a.position - b.position);

// Pure function — compute account status from credit percentage
export function computeStatus(
  used: number,
  total: number,
): "go" | "standby" | "no-go" {
  if (total === 0) return "no-go";
  const pct = ((total - used) / total) * 100;
  if (pct < 5) return "no-go";
  if (pct <= 25) return "standby";
  return "go";
}
