import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Download, RotateCcw, Upload } from "lucide-react";
import type { ValidationIssue } from "@nibblearn/core";

export interface JsonEditorProps {
  value: string;
  onChange: (v: string) => void;
  issues: ValidationIssue[];
  /** JSON parse error (if any). */
  parseError: string | null;
  onReset: () => void;
  fileName: string;
  label?: string;
}

export function JsonEditor({
  value,
  onChange,
  issues,
  parseError,
  onReset,
  fileName,
  label = "Configuration",
}: JsonEditorProps) {
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const invalid = Boolean(parseError) || issues.length > 0;
  const lines = useMemo(() => value.split("\n").length, [value]);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };
  const download = () => {
    const blob = new Blob([value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{label}</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${invalid ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"}`}
            role="status"
          >
            {invalid ? <AlertTriangle size={12} aria-hidden /> : <Check size={12} aria-hidden />}
            {invalid
              ? parseError
                ? "Invalid JSON"
                : `${issues.length} issue${issues.length === 1 ? "" : "s"}`
              : "Valid"}
          </span>
          <span className="text-xs text-muted">{lines} lines</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Tool
            onClick={copy}
            icon={copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            label={copied ? "Copied" : "Copy"}
          />
          <Tool onClick={download} icon={<Download size={14} aria-hidden />} label="Download" />
          <Tool
            onClick={() => fileRef.current?.click()}
            icon={<Upload size={14} aria-hidden />}
            label="Import"
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import JSON file"
            onChange={(e) => importFile(e.target.files?.[0])}
          />
          <Tool onClick={onReset} icon={<RotateCcw size={14} aria-hidden />} label="Reset" />
        </div>
      </div>
      <textarea
        className="json-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label={`${label} JSON`}
        aria-invalid={invalid}
        aria-describedby="json-issues"
      />
      <div id="json-issues" aria-live="polite">
        {parseError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            <strong>JSON syntax error:</strong> {parseError}
          </div>
        )}
        {!parseError && issues.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            {issues.map((i, idx) => (
              <li key={idx} className="flex gap-2">
                <code className="shrink-0 font-mono text-xs">{i.path}</code>
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tool({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-medium hover:bg-surface-2 focus-ring"
    >
      {icon}
      {label}
    </button>
  );
}
