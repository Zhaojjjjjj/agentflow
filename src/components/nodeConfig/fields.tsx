"use client";

import { useEffect, useRef, useState } from "react";
import type { VarOption } from "./vars";

/* ---------- 插入变量按钮 ---------- */

function InsertVarButton({ vars, onInsert }: { vars: VarOption[]; onInsert: (snippet: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  if (vars.length === 0) return null;
  const groups: ("触发输入" | "上游节点")[] = ["触发输入", "上游节点"];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-100"
      >
        {open ? "收起 ▴" : "+ 插入变量"}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 max-h-72 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/70">
          {groups.map((g) => {
            const list = vars.filter((v) => v.group === g);
            if (list.length === 0) return null;
            return (
              <div key={g} className="mb-1 last:mb-0">
                <p className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400">{g}</p>
                {list.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    className="block w-full rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-brand-50"
                    onClick={() => {
                      onInsert(`{{${v.value}}}`);
                      setOpen(false);
                    }}
                    title={v.desc}
                  >
                    <span className="block truncate font-mono text-xs text-slate-700">{v.label}</span>
                    <span className="block truncate text-[11px] text-slate-400">{v.desc}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function insertAtCursor(
  el: HTMLTextAreaElement | HTMLInputElement | null,
  cur: string,
  snippet: string,
  onChange: (v: string) => void
) {
  if (!el) {
    onChange(cur + snippet);
    return;
  }
  const s = el.selectionStart ?? cur.length;
  const e = el.selectionEnd ?? cur.length;
  const next = cur.slice(0, s) + snippet + cur.slice(e);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(s + snippet.length, s + snippet.length);
  });
}

/* ---------- 带变量插入的文本框 ---------- */

export function TemplateTextarea({
  value,
  onChange,
  vars,
  rows = 4,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  vars: VarOption[];
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <div className="mb-1.5 flex justify-end">
        <InsertVarButton vars={vars} onInsert={(s) => insertAtCursor(ref.current, value, s, onChange)} />
      </div>
      <textarea
        ref={ref}
        className="input"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function TemplateInput({
  value,
  onChange,
  vars,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  vars: VarOption[];
  placeholder?: string;
  mono?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="mb-1.5 flex justify-end">
        <InsertVarButton vars={vars} onInsert={(s) => insertAtCursor(ref.current, value, s, onChange)} />
      </div>
      <input
        ref={ref}
        className={`input ${mono ? "font-mono" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/* ---------- Temperature 滑杆 ---------- */

export function TemperatureSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const v = Number.isFinite(value) ? value : 0.7;
  const label = v <= 0.3 ? "严谨" : v <= 1.0 ? "平衡" : "发散";
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          严谨 <span className="text-slate-300">·</span> 平衡 <span className="text-slate-300">·</span> 发散
        </span>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
          {label} {v.toFixed(1)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={2}
        step={0.1}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-brand-600"
      />
      <p className="mt-1 text-[11px] text-slate-400">越往右越有想象力，越往左越稳定。写文案用偏右，做判断用偏左。</p>
    </div>
  );
}

/* ---------- 条件构造器 ---------- */

const OPERATORS = [
  { op: ">", label: "大于" },
  { op: "<", label: "小于" },
  { op: "==", label: "等于" },
  { op: "!=", label: "不等于" },
  { op: ">=", label: "大于等于" },
  { op: "<=", label: "小于等于" },
  { op: "contains", label: "包含" },
  { op: "not contains", label: "不包含" },
  { op: "starts with", label: "开头是" },
  { op: "ends with", label: "结尾是" },
];

function parseExpr(expr: string): { left: string; op: string; right: string } | null {
  const m = expr
    .trim()
    .match(/^\{\{\s*([^}]+?)\s*\}\}\s*(===|!==|==|!=|>=|<=|>|<|not contains|contains|starts with|ends with)\s*(.+)$/s);
  if (!m) return null;
  let right = m[3].trim();
  // 去掉字符串引号
  if ((right.startsWith('"') && right.endsWith('"')) || (right.startsWith("'") && right.endsWith("'"))) {
    right = right.slice(1, -1);
  }
  return { left: m[1].trim(), op: m[2], right };
}

function quoteValue(v: string): string {
  const t = v.trim();
  if (t === "") return '""';
  if (t === "true" || t === "false" || t === "null" || !Number.isNaN(Number(t))) return t;
  return `"${t.replace(/"/g, '\\"')}"`;
}

export function ConditionBuilder({
  value,
  onChange,
  vars,
}: {
  value: string;
  onChange: (v: string) => void;
  vars: VarOption[];
}) {
  const parsed = parseExpr(value);
  const [raw, setRaw] = useState(!value || !!parsed);
  const [left, setLeft] = useState(parsed?.left || vars.find((v) => v.group === "上游节点")?.value || "input");
  const [op, setOp] = useState(parsed?.op || "==");
  const [right, setRight] = useState(parsed?.right || "");

  // 外部值变化时同步（如切换节点）
  useEffect(() => {
    const p = parseExpr(value);
    if (p) {
      setLeft(p.left);
      setOp(p.op);
      setRight(p.right);
      setRaw(true);
    }
  }, [value]);

  const build = (l: string, o: string, r: string) => {
    onChange(`{{${l}}} ${o} ${quoteValue(r)}`);
  };

  if (!raw) {
    return (
      <div>
        <div className="mb-1.5 flex justify-end">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:border-slate-300"
            onClick={() => setRaw(true)}
          >
            可视化编辑
          </button>
        </div>
        <input
          className="input font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="{{score}} > 0.8"
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex justify-end">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:border-slate-300"
          onClick={() => setRaw(false)}
        >
          手写表达式
        </button>
      </div>
      <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div>
          <p className="mb-1 text-[11px] font-medium text-slate-500">比较谁</p>
          <select className="input bg-white" value={left} onChange={(e) => { setLeft(e.target.value); build(e.target.value, op, right); }}>
            {vars.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2.5">
          <div className="w-32 shrink-0">
            <p className="mb-1 text-[11px] font-medium text-slate-500">怎么比</p>
            <select className="input bg-white" value={op} onChange={(e) => { setOp(e.target.value); build(left, e.target.value, right); }}>
              {OPERATORS.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <p className="mb-1 text-[11px] font-medium text-slate-500">跟什么比</p>
            <input
              className="input bg-white"
              value={right}
              onChange={(e) => { setRight(e.target.value); build(left, op, e.target.value); }}
              placeholder="比如：0.8 或 通过"
            />
          </div>
        </div>
        <p className="rounded-lg bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-500">
          生成：{`{{${left}}} ${op} ${quoteValue(right)}`}
        </p>
      </div>
    </div>
  );
}

/* ---------- 定时构造器 ---------- */

type Freq = "daily" | "weekly" | "monthly";

function parseCron(cron: string): { freq: Freq; time: string; day: number } | null {
  const m = cron.trim().match(/^(\d{1,2})\s+(\d{1,2})\s+(\*|\d{1,2})\s+\*\s+(\*|\d)$/);
  if (!m) return null;
  const time = `${m[2].padStart(2, "0")}:${m[1].padStart(2, "0")}`;
  if (m[3] === "*" && m[4] === "*") return { freq: "daily", time, day: 1 };
  if (m[3] === "*") return { freq: "weekly", time, day: Number(m[4]) };
  return { freq: "monthly", time, day: Number(m[3]) };
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function ScheduleBuilder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseCron(value);
  const [raw, setRaw] = useState(!value || !!parsed);
  const [freq, setFreq] = useState<Freq>(parsed?.freq || "daily");
  const [time, setTime] = useState(parsed?.time || "09:00");
  const [day, setDay] = useState(parsed?.day ?? 1);

  const build = (f: Freq, t: string, d: number) => {
    const [h, mi] = t.split(":").map((x) => String(Number(x)));
    if (f === "daily") onChange(`${mi} ${h} * * *`);
    else if (f === "weekly") onChange(`${mi} ${h} * * ${d}`);
    else onChange(`${mi} ${h} ${d} * *`);
  };

  const summary =
    freq === "daily" ? `每天 ${time} 运行` : freq === "weekly" ? `每周${WEEKDAYS[day]} ${time} 运行` : `每月 ${day} 号 ${time} 运行`;

  if (!raw) {
    return (
      <div>
        <div className="mb-1.5 flex justify-end">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:border-slate-300"
            onClick={() => setRaw(true)}
          >
            可视化设置
          </button>
        </div>
        <input
          className="input font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0 9 * * *"
        />
        <p className="mt-1 text-[11px] text-slate-400">5 字段：分 时 日 月 周（UTC 时间）</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex justify-end">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:border-slate-300"
          onClick={() => setRaw(false)}
        >
          手写 cron
        </button>
      </div>
      <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="flex gap-2.5">
          <div className="flex-1">
            <p className="mb-1 text-[11px] font-medium text-slate-500">多久运行一次</p>
            <select
              className="input bg-white"
              value={freq}
              onChange={(e) => { const f = e.target.value as Freq; setFreq(f); build(f, time, day); }}
            >
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </div>
          <div className="flex-1">
            <p className="mb-1 text-[11px] font-medium text-slate-500">几点</p>
            <input
              type="time"
              className="input bg-white"
              value={time}
              onChange={(e) => { setTime(e.target.value); build(freq, e.target.value, day); }}
            />
          </div>
          {freq !== "daily" && (
            <div className="flex-1">
              <p className="mb-1 text-[11px] font-medium text-slate-500">{freq === "weekly" ? "周几" : "几号"}</p>
              {freq === "weekly" ? (
                <select
                  className="input bg-white"
                  value={day}
                  onChange={(e) => { const d = Number(e.target.value); setDay(d); build(freq, time, d); }}
                >
                  {WEEKDAYS.map((w, i) => (
                    <option key={i} value={i}>
                      {w}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  min={1}
                  max={28}
                  className="input bg-white"
                  value={day}
                  onChange={(e) => { const d = Math.min(28, Math.max(1, Number(e.target.value) || 1)); setDay(d); build(freq, time, d); }}
                />
              )}
            </div>
          )}
        </div>
        <p className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] text-slate-500">
          {summary} <span className="font-mono text-slate-400">（{value || "—"}）</span>
        </p>
      </div>
    </div>
  );
}

/* ---------- 模型选择 ---------- */

interface ProviderOpt {
  id: string;
  name: string;
  model: string;
}

export function ModelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [providers, setProviders] = useState<ProviderOpt[] | null>(null);
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    fetch("/api/settings/providers")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const list = (j?.providers || []).filter((p: { kind: string }) => p.kind === "chat");
        setProviders(list.map((p: { id: string; name: string; model: string }) => ({ id: p.id, name: p.name, model: p.model })));
      })
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    if (providers && value && !providers.some((p) => p.model === value)) setCustom(true);
  }, [providers, value]);

  if (providers === null) {
    return <div className="input animate-pulse text-slate-300">加载模型列表…</div>;
  }
  if (custom) {
    return (
      <div className="flex gap-2">
        <input
          className="input flex-1 font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="输入模型名，如 gpt-4o-mini"
        />
        {providers.length > 0 && (
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-500 hover:border-slate-300"
            onClick={() => { setCustom(false); onChange(""); }}
          >
            从列表选
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <select
        className="input flex-1"
        value={value || ""}
        onChange={(e) => {
          if (e.target.value === "__custom") setCustom(true);
          else onChange(e.target.value);
        }}
      >
        <option value="">自动（用默认模型）</option>
        {providers.map((p) => (
          <option key={p.id} value={p.model}>
            {p.name} · {p.model}
          </option>
        ))}
        <option value="__custom">手动输入…</option>
      </select>
    </div>
  );
}

/* ---------- 键值对编辑器（带变量插入） ---------- */

export function KVEditor({
  value,
  onChange,
  vars,
  valuePlaceholder = "点「插入变量」或直接写文本",
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  vars: VarOption[];
  valuePlaceholder?: string;
}) {
  const [newKey, setNewKey] = useState("");
  const entries = Object.entries(value || {});
  const set = (k: string, v: string) => onChange({ ...(value || {}), [k]: v });
  const del = (k: string) => {
    const c = { ...(value || {}) };
    delete c[k];
    onChange(c);
  };
  const addNew = () => {
    if (newKey.trim()) {
      set(newKey.trim(), "");
      setNewKey("");
    }
  };
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-400">
        <span className="w-1/3">字段名</span>
        <span className="flex-1">内容</span>
        <span className="w-8" />
      </div>
      {entries.map(([k, v]) => (
        <KVRow key={k} k={k} v={v} vars={vars} valuePlaceholder={valuePlaceholder} onSet={set} onDel={del} />
      ))}
      <div className="flex gap-2 bg-slate-50 px-3 py-2">
        <input
          className="input flex-1 !py-1.5 text-xs"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="新字段名，回车添加"
          onKeyDown={(e) => {
            if (e.key === "Enter") addNew();
          }}
        />
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"
          onClick={addNew}
        >
          添加
        </button>
      </div>
    </div>
  );
}

function KVRow({
  k,
  v,
  vars,
  valuePlaceholder,
  onSet,
  onDel,
}: {
  k: string;
  v: string;
  vars: VarOption[];
  valuePlaceholder: string;
  onSet: (k: string, v: string) => void;
  onDel: (k: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-0">
      <code className="w-1/3 shrink-0 truncate font-mono text-xs text-slate-600">{k}</code>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <input
          ref={ref}
          className="input min-w-0 flex-1 !py-1.5 text-xs"
          value={v}
          onChange={(e) => onSet(k, e.target.value)}
          placeholder={valuePlaceholder}
        />
        <InsertVarButton vars={vars} onInsert={(s) => insertAtCursor(ref.current, v, s, (nv) => onSet(k, nv))} />
      </div>
      <button
        type="button"
        className="w-8 shrink-0 rounded-md py-1 text-center text-sm text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
        onClick={() => onDel(k)}
        title="删除字段"
      >
        ×
      </button>
    </div>
  );
}
