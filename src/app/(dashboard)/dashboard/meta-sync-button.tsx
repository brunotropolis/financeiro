"use client";

import { useState } from "react";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { syncMetaSpend } from "./actions";

export function MetaSyncButton() {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSync() {
    setState("loading");
    setMsg(null);
    const result = await syncMetaSpend();
    setState(result.ok ? "ok" : "error");
    setMsg(result.message);
    if (result.ok) setTimeout(() => setState("idle"), 4000);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={state === "loading"}
        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${state === "loading" ? "animate-spin" : ""}`} />
        {state === "loading" ? "Lançando..." : "Lançar despesa"}
      </button>
      {msg && state === "ok" && (
        <span className="text-[11px] text-emerald-400 flex items-center gap-1">
          <Check className="w-3 h-3" /> {msg}
        </span>
      )}
      {msg && state === "error" && (
        <span className="text-[11px] text-rose-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {msg}
        </span>
      )}
    </div>
  );
}
