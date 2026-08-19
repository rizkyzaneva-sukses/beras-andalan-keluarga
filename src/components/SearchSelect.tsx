"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchSelectOption = {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
};

type Props = {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
};

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Cari...",
  emptyText = "Tidak ditemukan",
  required = false,
  disabled = false,
  className = "",
  allowClear = true,
}: Props) {
  const listId = useId();
  const selected = options.find((o) => o.value === value) || null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.description || ""} ${o.keywords || ""} ${o.value}`
        .toLowerCase()
        .includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => setHighlight(0), [query, open]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.children[highlight] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function pick(opt: SearchSelectOption) {
    onChange(opt.value);
    close();
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const n = filtered.length;
      if (!n) return;
      setHighlight((h) => (e.key === "ArrowDown" ? (h + 1) % n : (h - 1 + n) % n));
    } else if (e.key === "Enter") {
      // Tanpa ini, Enter men-submit form dengan pilihan yang belum dipilih.
      if (open) {
        e.preventDefault();
        const opt = filtered[highlight];
        if (opt) pick(opt);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={open ? query : selected?.label || ""}
          disabled={disabled}
          autoComplete="off"
          placeholder={open && selected ? selected.label : placeholder}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2.5 pr-16 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
        />
        {/* Validasi HTML harus ikut `value` asli, bukan teks pencarian. */}
        {required && (
          <input
            tabIndex={-1}
            aria-hidden="true"
            required
            value={value}
            onChange={() => {}}
            onFocus={() => inputRef.current?.focus()}
            className="absolute left-3 bottom-0 w-px h-px p-0 border-0 opacity-0"
          />
        )}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {allowClear && value && !disabled && (
            <button
              type="button"
              onClick={clear}
              className="w-8 h-8 rounded-md text-muted-foreground hover:bg-muted text-sm"
              aria-label="Hapus pilihan"
            >
              ×
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              if (open) {
                close();
              } else {
                setOpen(true);
                inputRef.current?.focus();
              }
            }}
            className="w-8 h-8 rounded-md text-muted-foreground hover:bg-muted text-xs"
            aria-label="Buka daftar"
          >
            ▾
          </button>
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-30 mt-1.5 w-full bg-white border border-border rounded-xl overflow-hidden shadow-lg">
          <div ref={listRef} id={listId} role="listbox" className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground text-center">{emptyText}</p>
            ) : (
              filtered.map((o, i) => (
                <button
                  key={o.value}
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(o)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors ${
                    i === highlight ? "bg-primary-soft/60" : ""
                  } ${o.value === value ? "font-semibold" : ""}`}
                >
                  <span className="block">{o.label}</span>
                  {o.description && (
                    <span className="text-muted-foreground text-sm font-mono">{o.description}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
