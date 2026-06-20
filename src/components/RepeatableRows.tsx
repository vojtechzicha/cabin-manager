"use client";

import { useState } from "react";

/** One editable column within a repeatable row. */
export interface RowColumn {
  key: string;
  label: string;
}

type Row = Record<string, string>;

/**
 * A structured, add/remove list of records for the trip-info editor (T-203) —
 * the replacement for the old pipe-separated textareas. Each row is a set of
 * typed inputs; the component serializes the non-empty rows into a hidden JSON
 * input (`name`) that the `saveTripInfoAction` parses. Works as a client island
 * inside a plain server-rendered `<form>`.
 */
export function RepeatableRows({
  name,
  columns,
  initial = [],
  addLabel,
}: {
  name: string;
  columns: RowColumn[];
  initial?: Row[];
  addLabel: string;
}) {
  const blank = (): Row => Object.fromEntries(columns.map((c) => [c.key, ""]));
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [blank()]);

  const update = (i: number, key: string, value: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  const add = () => setRows((rs) => [...rs, blank()]);
  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const nonEmpty = rows.filter((r) => columns.some((c) => (r[c.key] ?? "").trim().length > 0));

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify(nonEmpty)} />
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex flex-1 flex-wrap gap-2">
            {columns.map((c) => (
              <input
                key={c.key}
                value={row[c.key] ?? ""}
                onChange={(e) => update(i, c.key, e.target.value)}
                placeholder={c.label}
                aria-label={c.label}
                className="min-h-10 min-w-[140px] flex-1 rounded-btn border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove row"
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border border-line text-muted hover:text-owing"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start rounded-btn border border-dashed border-line px-3 py-2 text-[13px] font-semibold text-muted hover:border-accent hover:text-accent-ink"
      >
        + {addLabel}
      </button>
    </div>
  );
}
