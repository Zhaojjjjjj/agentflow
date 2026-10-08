// Minimal 5-field cron parser (minute hour dom month dow).
// Supports: *, */n, a-b, a-b/n, a,b, single numbers.

function parseField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  const add = (v: number) => {
    if (v >= min && v <= max) out.add(v);
  };
  for (const part of field.split(",")) {
    const [range, stepStr] = part.split("/");
    const step = stepStr ? parseInt(stepStr, 10) : 1;
    if (!step || step < 1) throw new Error(`cron: 非法步长 "${part}"`);
    let start = min;
    let end = max;
    if (range === "*") {
      // full range
    } else if (range.includes("-")) {
      const [a, b] = range.split("-").map((x) => parseInt(x, 10));
      if (Number.isNaN(a) || Number.isNaN(b)) throw new Error(`cron: 非法范围 "${part}"`);
      start = a;
      end = b;
    } else {
      const v = parseInt(range, 10);
      if (Number.isNaN(v)) throw new Error(`cron: 非法字段 "${part}"`);
      start = v;
      end = v;
    }
    for (let v = start; v <= end; v += step) add(v);
  }
  if (out.size === 0) throw new Error(`cron: 空字段 "${field}"`);
  return out;
}

export interface ParsedCron {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
}

export function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`cron 必须是 5 个字段（分 时 日 月 周）， got: "${expr}"`);
  const dow = parseField(parts[4], 0, 6);
  if (dow.has(7)) {
    dow.delete(7);
    dow.add(0);
  }
  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dom: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dow,
  };
}

function matches(cron: ParsedCron, d: Date): boolean {
  return (
    cron.minute.has(d.getUTCMinutes()) &&
    cron.hour.has(d.getUTCHours()) &&
    cron.dom.has(d.getUTCDate()) &&
    cron.month.has(d.getUTCMonth() + 1) &&
    cron.dow.has(d.getUTCDay())
  );
}

/** Next occurrence strictly after `from` (UTC), searching up to 366 days ahead. */
export function cronNext(expr: string, from: Date): Date | null {
  const cron = parseCron(expr);
  const d = new Date(from.getTime());
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (matches(cron, d)) return new Date(d.getTime());
    d.setUTCMinutes(d.getUTCMinutes() + 1);
  }
  return null;
}

/** Validate a cron expression, returning a friendly error or null. */
export function validateCron(expr: string): string | null {
  try {
    parseCron(expr);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
