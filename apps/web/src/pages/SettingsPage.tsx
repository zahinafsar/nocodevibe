import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Cpu, Zap } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import type { Provider, ModelsConfig } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConnectProviderDialog } from "../components/settings/ConnectProviderDialog";
import { SkillManager } from "../components/skills/SkillManager";

type Section = "providers" | "skills";

const NAV_ITEMS: { key: Section; label: string; icon: typeof Cpu }[] = [
  { key: "providers", label: "Providers", icon: Cpu },
  { key: "skills", label: "Skills", icon: Zap },
];

function getLabel(id: string, config: ModelsConfig | null) {
  return config?.providers[id]?.label ?? id;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>("providers");

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
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* ── Sidebar (md+) ── */}
      <nav className="hidden md:flex w-[320px] shrink-0 border-r flex-col p-4 gap-1 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="p-1 -ml-1 rounded hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => setSection(item.key)}
            className={cn(
              "flex items-center gap-2 text-sm text-left px-3 py-2 rounded-md transition-colors",
              section === item.key
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* ── Mobile header + tabs (below md) ── */}
      <div className="md:hidden shrink-0 border-b">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit gap-1.5 -ml-2"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold text-foreground">Settings</h1>
        </div>
        <div className="flex gap-1 px-4 pb-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors",
                section === item.key
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50"
              )}
            >
              <item.icon className="h-3 w-3" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[600px] mx-auto px-6 md:px-8 pt-6 md:pt-8 pb-12">

          {/* Providers section */}
          {section === "providers" && (
            <div className="flex flex-col gap-8">
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
          )}

          {/* Skills section */}
          {section === "skills" && <SkillManager />}
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
