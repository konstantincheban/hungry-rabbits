export function removeInactiveItems<T extends { active: boolean }>(items: T[]): T[] {
  return items.filter((item) => item.active);
}
