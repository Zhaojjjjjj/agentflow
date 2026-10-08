// Template interpolation: {{path.to.value}} resolved against a context object.
// Used by llm prompts, http urls/bodies, condition expressions, output fields, ...

/** Resolve a dotted path (supports numeric array indices) inside an object. */
export function getPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(part);
      if (!Number.isInteger(idx)) return undefined;
      cur = cur[idx];
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * Interpolate a template string. If the whole template is exactly one
 * placeholder (e.g. "{{items}}"), the raw value (array/object) is returned
 * instead of a string — this lets loops/conditions receive real values.
 */
export function interpolate(template: unknown, ctx: Record<string, unknown>): unknown {
  if (typeof template !== "string") return template;
  const full = template.match(/^\{\{\s*([\w$.\-]+)\s*\}\}$/);
  if (full) return getPath(ctx, full[1].trim());
  return template.replace(/\{\{\s*([\w$.\-]+)\s*\}\}/g, (_m, path: string) => {
    const v = getPath(ctx, path.trim());
    if (v === undefined || v === null) return "";
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  });
}

/** Interpolate every string value inside a JSON-ish structure. */
export function interpolateDeep<T>(value: T, ctx: Record<string, unknown>): T {
  if (typeof value === "string") return interpolate(value, ctx) as T;
  if (Array.isArray(value)) return value.map((v) => interpolateDeep(v, ctx)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolateDeep(v, ctx);
    return out as T;
  }
  return value;
}
