import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Zap, BookOpen } from "lucide-react";
import { api } from "../../lib/api";
import type { SkillInfo } from "../../lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const TEMPLATE = `---
name: my-skill
description: What this skill does
---

# My Skill

Instructions for the AI agent go here.

## When to use
- Describe when this skill should be loaded

## Workflow
1. Step one
2. Step two
`;

export function SkillManager() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<SkillInfo | null>(null);

  // Create form
  const [newSlug, setNewSlug] = useState("");
  const [readme, setReadme] = useState(TEMPLATE);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getSkills();
      setSkills(list);
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleCreate = async () => {
    const slug = newSlug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!slug) {
      toast.error("Folder name is required");
      return;
    }
    try {
      await api.createSkillRaw(slug, readme);
      toast.success(`Skill "${slug}" created`);
      setNewSlug("");
      setReadme(TEMPLATE);
      setCreateOpen(false);
      loadSkills();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create skill");
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete skill "${name}"?`)) return;
    try {
      await api.deleteSkill(name);
      toast.success(`Skill "${name}" deleted`);
      setDetailSkill(null);
      loadSkills();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete skill");
    }
  };

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-foreground">Skills</h2>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          New Skill
        </Button>
      </div>

      {/* Skill list */}
      <div className="bg-card rounded-lg border">
        {loading && (
          <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
        )}
        {!loading && skills.length === 0 && (
          <div className="text-center py-8">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No skills yet</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Skills teach the AI specialized workflows
            </p>
          </div>
        )}
        {skills.map((skill) => (
          <div
            key={skill.name}
            className="group flex items-center gap-3 px-4 min-h-[56px] py-3 border-b last:border-b-0 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setDetailSkill(skill)}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500 flex-none" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{skill.name}</p>
              {skill.description && (
                <p className="text-[11px] text-muted-foreground truncate">{skill.description}</p>
              )}
            </div>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 flex-none p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              onClick={(e) => { e.stopPropagation(); handleDelete(skill.name); }}
              title="Delete skill"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        Stored in <code className="bg-muted px-1 rounded text-[11px]">~/.coodeen/skills/</code>
      </p>

      {/* ── Create Dialog ── */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) { setNewSlug(""); setReadme(TEMPLATE); }
        }}
      >
        <DialogContent className="!flex !flex-col sm:max-w-[520px] max-h-[80vh] overflow-hidden gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-none">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4" />
              New Skill
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Folder name</label>
              <Input
                placeholder="e.g. react-components"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="h-8 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Saved to{" "}
                <code className="bg-muted px-1 rounded">
                  ~/.coodeen/skills/{newSlug || "…"}/SKILL.md
                </code>
              </p>
            </div>
            <div className="space-y-1.5 mb-4">
              <label className="text-xs font-medium">SKILL.md</label>
              <Textarea
                value={readme}
                onChange={(e) => setReadme(e.target.value)}
                className="min-h-[250px] text-xs font-mono resize-y leading-relaxed"
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t flex-none">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate}>
              Create Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog
        open={!!detailSkill}
        onOpenChange={(open) => { if (!open) setDetailSkill(null); }}
      >
        <DialogContent className="!flex !flex-col sm:max-w-[520px] max-h-[80vh] overflow-hidden gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-none">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-amber-500" />
              {detailSkill?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
            <p className="text-[10px] text-muted-foreground font-mono mb-3 break-all">
              {detailSkill?.location}
            </p>
            <pre className="text-xs font-mono whitespace-pre-wrap bg-muted rounded-md p-3 leading-relaxed">
              {detailSkill
                ? `---\nname: ${detailSkill.name}\ndescription: ${detailSkill.description}\n---\n\n${detailSkill.content}`
                : ""}
            </pre>
          </div>
          <DialogFooter className="px-6 py-4 border-t flex-none">
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => detailSkill && handleDelete(detailSkill.name)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
