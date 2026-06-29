let counter = 0;
export function nanoid(): string {
  return `node-${Date.now()}-${++counter}`;
}
