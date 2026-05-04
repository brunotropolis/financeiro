"use client";

import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#3b82f6", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#84cc16", "#ef4444", "#a855f7", "#0ea5e9",
  "#f97316", "#14b8a6", "#6366f1", "#dc2626", "#0891b2",
  "#6b7280",
];

export function ColorPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={cn(
            "h-7 w-7 rounded-full border-2 transition-all",
            value === c ? "border-white scale-110" : "border-gray-700 hover:border-gray-500"
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
