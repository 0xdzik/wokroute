/** Create / Edit / Revealed key dialogs + CopyButton (moved unchanged from page.tsx). */

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "../../lib/toast";
import { copyText } from "../../lib/clipboard";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Input, Label } from "../../components/ui/input";
import { KeyLimitsFields } from "./key-limits-fields";
import type { CreatedKey, TokenBudgetMode } from "./types";

/** Props bundle forwarded to KeyLimitsFields by the create/edit dialogs. */
export interface KeyLimitsFormProps {
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
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
  }, []);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        void copyText(value).then((ok) => {
          if (!ok) {
            toast.error("Clipboard unavailable on this origin");
            return;
          }
          setCopied(true);
          if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
          copiedTimerRef.current = window.setTimeout(() => { copiedTimerRef.current = null; setCopied(false); }, 1500);
        });
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function CreateKeyDialog({
  open,
  onClose,
  name,
  setName,
  prefix,
  setPrefix,
  customKey,
  setCustomKey,
  limits,
  busy,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  setName: (value: string) => void;
  prefix: string;
  setPrefix: (value: string) => void;
  customKey: string;
  setCustomKey: (value: string) => void;
  limits: KeyLimitsFormProps;
  busy: boolean;
  onCreate: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create API Key"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={name.trim().length < 2 || busy} onClick={onCreate}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ci-key" disabled={busy} />
        </div>
        <div>
          <Label>Custom API key value (optional)</Label>
          <Input value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder="ctk_inibansos" disabled={busy} spellCheck={false} autoComplete="off" />
          <p className="mt-1 text-[11px] text-[var(--text-3)]">Use an exact value such as <code>ctk_inibansos</code>. Leave blank to generate a secure random key. 8–256 letters, digits, underscores, or hyphens.</p>
        </div>
        <div>
          <Label>Generated key prefix (optional)</Label>
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="ctk (default)" disabled={busy || customKey.trim().length > 0} />
          <p className="mt-1 text-[11px] text-[var(--text-3)]">Only applies when generating a random key.</p>
        </div>
        <KeyLimitsFields {...limits} disabled={busy} />
      </div>
    </Dialog>
  );
}

export function EditKeyDialog({
  targetName,
  onClose,
  customKey,
  setCustomKey,
  limits,
  busy,
  onSave,
}: {
  /** null while closed — mirrors the old `!!editTarget` open check. */
  targetName: string | null;
  onClose: () => void;
  customKey: string;
  setCustomKey: (value: string) => void;
  limits: KeyLimitsFormProps;
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog
      open={targetName !== null}
      onClose={onClose}
      title={targetName ? `Edit API Key — ${targetName}` : "Edit API Key"}
      wide
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={targetName === null || busy} onClick={onSave}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Replace API key value (optional)</Label>
          <Input value={customKey} onChange={(event) => setCustomKey(event.target.value)} placeholder="Leave blank to keep current key" disabled={busy} spellCheck={false} autoComplete="off" />
          <p className="mt-1 text-[11px] text-[var(--text-3)]">A replacement immediately invalidates the previous value. 8–256 letters, digits, underscores, or hyphens.</p>
        </div>
        <KeyLimitsFields {...limits} disabled={busy} />
      </div>
    </Dialog>
  );
}

export function RevealedKeyDialog({ revealed, onClose }: { revealed: CreatedKey | null; onClose: () => void }) {
  if (!revealed) return null;
  return (
    <Dialog open={true} onClose={onClose} title="New API Key Created" wide>
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-2)]">{revealed.note || "Store this key safely. It will not be shown again."}</p>
        <div className="rounded-[12px] bg-[var(--surface-2)] p-4">
          <div className="font-mono text-sm break-all text-[var(--accent)]">{revealed.key}</div>
        </div>
        <CopyButton value={revealed.key} />
      </div>
    </Dialog>
  );
}
