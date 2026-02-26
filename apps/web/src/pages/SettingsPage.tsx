import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import type { Provider, ModelsConfig } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectProviderDialog } from "../components/settings/ConnectProviderDialog";

function getLabel(id: string, config: ModelsConfig | null) {
  return config?.providers[id]?.label ?? id;
}

export function SettingsPage() {
  const navigate = useNavigate();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [config, setConfig] = useState<ModelsConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const [connectTarget, setConnectTarget] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, cfg] = await Promise.all([
        api.getProviders(),
        api.getModelsConfig(),
      ]);
      setProviders(list);
      setConfig(cfg);
    } catch {
      toast.error("Failed to load settings.");
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const providerEntries = config
    ? Object.entries(config.providers).map(([id, p]) => ({ value: id, label: p.label }))
    : [];

  const connectedIds = new Set(providers.map((p) => p.id));
  const connected = providerEntries.filter((p) => connectedIds.has(p.value));
  const available = providerEntries.filter((p) => !connectedIds.has(p.value));

  async function handleDisconnect(providerId: string) {
    try {
      await api.deleteProvider(providerId);
      await refresh();
      toast.success(`${getLabel(providerId, config)} disconnected.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to disconnect.",
      );
    }
  }

  function handleConnect(provider: { value: string; label: string }) {
    setConnectTarget(provider);
    setDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-6 pb-12">
        <div className="sticky top-0 z-10 bg-background pt-8 pb-6">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit gap-1.5 mb-4 -ml-2"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Providers</h1>
        </div>

        <div className="flex flex-col gap-8">
          {/* Free Models — always available */}
          {config && (
            <section>
              <h2 className="text-sm font-medium text-foreground mb-2">
                {config.free.label}
              </h2>
              <div className="bg-card rounded-lg border">
                <div className="flex items-center justify-between gap-4 px-4 min-h-[56px] py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-foreground">
                      OpenCode Zen
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] shrink-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    >
                      Free
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {config.free.models.length} models
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                No API key needed.
              </p>
            </section>
          )}

          {/* Connected */}
          <section>
            <h2 className="text-sm font-medium text-foreground mb-2">
              Connected
            </h2>
            <div className="bg-card rounded-lg border">
              {connected.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                  No providers connected yet.
                </div>
              ) : (
                connected.map(({ value, label }) => (
                  <div
                    key={value}
                    className="group flex items-center justify-between gap-4 px-4 min-h-[56px] py-3 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-foreground">
                        {label}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] shrink-0"
                      >
                        API Key
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDisconnect(value)}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Available */}
          {available.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-foreground mb-2">
                Available
              </h2>
              <div className="bg-card rounded-lg border">
                {available.map(({ value, label }) => (
                  <div
                    key={value}
                    className="flex items-center justify-between gap-4 px-4 min-h-[56px] py-3 border-b last:border-b-0"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {label}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleConnect({ value, label })}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Connect
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <ConnectProviderDialog
        provider={connectTarget}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConnected={refresh}
      />
    </div>
  );
}
