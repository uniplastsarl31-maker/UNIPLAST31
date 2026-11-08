import type { Settings } from "./types.ts";

/** Merge only fields changed by this editor, retaining newer work elsewhere. */
export function mergeSettingsDraft(
  current: Settings,
  base: Settings,
  next: Settings,
  fields: readonly (keyof Settings)[],
): Settings {
  const patch: Partial<Settings> = {};
  for (const field of fields)
    if (JSON.stringify(base[field]) !== JSON.stringify(next[field]))
      Object.assign(patch, { [field]: next[field] });
  return Object.keys(patch).length ? { ...current, ...patch } : current;
}
