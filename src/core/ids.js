import { randomUUID } from "node:crypto";

export function makeId(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}
