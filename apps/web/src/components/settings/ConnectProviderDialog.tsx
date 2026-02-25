import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConnectProviderDialogProps {
  provider: { value: string; label: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}

export function ConnectProviderDialog({
  provider,
  open,
  onOpenChange,
  onConnected,
}: ConnectProviderDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setApiKey("");
  }, [open]);

  async function handleSave() {
    if (!provider) return;
    if (!apiKey.trim()) {
      toast.error("API key is required.");
      return;
    }
    setSaving(true);
    try {
      await api.saveProvider(provider.value, { apiKey });
      toast.success(`${provider.label} connected.`);
      onOpenChange(false);
      onConnected();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Connect {provider?.label}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="connect-api-key">API Key</Label>
            <Input
              id="connect-api-key"
              type="password"
              autoFocus
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
