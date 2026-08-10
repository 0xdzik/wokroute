/** Shared limit/ACL form fields used by both the Create and Edit key dialogs. */

import { Input, Label } from "../../components/ui/input";
import { ModelPickerField } from "../../components/model-picker";
import { TOKEN_PRESETS, type TokenBudgetMode } from "./types";

export function KeyLimitsFields({
  rpm,
  daily,
  monthly,
  oneTime,
  budgetMode,
  concurrent,
  allowed,
  setRpm,
  setDaily,
  setMonthly,
  setOneTime,
  setConcurrent,
  setAllowed,
  onBudgetModeChange,
  disabled,
}: {
  rpm: string;
  daily: string;
  monthly: string;
  oneTime: string;
  budgetMode: TokenBudgetMode;
  concurrent: string;
  allowed: string[];
  setRpm: (value: string) => void;
  setDaily: (value: string) => void;
  setMonthly: (value: string) => void;
  setOneTime: (value: string) => void;
  setConcurrent: (value: string) => void;
  setAllowed: (values: string[]) => void;
  onBudgetModeChange: (mode: TokenBudgetMode) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Max RPM (optional)</Label>
          <Input type="number" min={1} value={rpm} onChange={(e) => setRpm(e.target.value)} placeholder="60" disabled={disabled} />
        </div>
        <div>
          <Label>Max concurrent (optional)</Label>
          <Input type="number" min={1} value={concurrent} onChange={(e) => setConcurrent(e.target.value)} placeholder="10" disabled={disabled} />
        </div>
        <div className="col-span-2 border-t border-[var(--border-subtle)] pt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label>Token budget</Label>
            <div className="flex rounded-lg border border-[var(--inner-border)] p-0.5">
              {(["recurring", "one-time"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => onBudgetModeChange(mode)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${budgetMode === mode ? "bg-[var(--text-1)] text-[var(--page-bg)]" : "text-[var(--text-3)] hover:text-[var(--text-1)]"}`}
                >
                  {mode === "one-time" ? "One-time" : "Daily / monthly"}
                </button>
              ))}
            </div>
          </div>
          {budgetMode === "one-time" ? (
            <div>
              <Input type="number" min={1} value={oneTime} onChange={(e) => setOneTime(e.target.value)} placeholder="Choose a preset or enter a cap" disabled={disabled} />
              <p className="mt-2 text-[11px] text-[var(--text-3)]">This budget is consumed once and stops the key when it reaches zero.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Daily (optional)</Label>
                <Input type="number" min={1} value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="Unlimited" disabled={disabled} />
              </div>
              <div>
                <Label>Monthly (optional)</Label>
                <Input type="number" min={1} value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="Unlimited" disabled={disabled} />
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TOKEN_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={disabled}
                onClick={() => budgetMode === "one-time" ? setOneTime(String(preset.value)) : setDaily(String(preset.value))}
                className="rounded-md border border-[var(--inner-border)] px-2 py-1 text-[11px] font-semibold text-[var(--text-2)] hover:border-[var(--text-3)] hover:text-[var(--text-1)]"
              >
                {preset.label}
              </button>
            ))}
            <span className="self-center text-[11px] text-[var(--text-3)]">M = million · B = billion · T = trillion</span>
          </div>
        </div>
      </div>
      <ModelPickerField
        label="Allowed (optional)"
        values={allowed}
        onChange={setAllowed}
        mode="models"
        manualPlaceholder="e.g. kimchi or kimchi/kimi-k2.7"
        disabled={disabled}
        includeCombos
        includeAliases
      />
      <p className="text-xs text-[var(--text-3)]">Empty = all models allowed. Add providers (no slash), models (with slash), combos, or aliases to restrict.</p>
    </>
  );
}
