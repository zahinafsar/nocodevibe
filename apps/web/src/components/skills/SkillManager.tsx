import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Zap, ChevronLeft, BookOpen } from "lucide-react";
import { api } from "../../lib/api";
import type { SkillInfo } from "../../lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type View = "list" | "create" | "detail";

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

interface SkillManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillManager({ open, onOpenChange }: SkillManagerProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("list");
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);

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
    if (open) {
      loadSkills();
      setView("list");
      setSelectedSkill(null);
    }
  }, [open, loadSkills]);

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
      setView("list");
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
      if (selectedSkill?.name === name) {
        setSelectedSkill(null);
        setView("list");
      }
      loadSkills();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete skill");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!flex !flex-col sm:max-w-lg max-h-[80vh] overflow-hidden gap-0 p-0"
      >
        {/* ── Header ── */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b flex-none">
          <DialogTitle className="flex items-center gap-2 text-sm">
            {view !== "list" && (
              <button
                type="button"
                onClick={() => { setView("list"); setSelectedSkill(null); }}
                className="p-0.5 -ml-1 rounded hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <Zap className="h-4 w-4" />
            {view === "list" && "Skills"}
            {view === "create" && "New Skill"}
            {view === "detail" && selectedSkill?.name}
          </DialogTitle>
        </DialogHeader>

        {/* ── LIST ── */}
        {view === "list" && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-3 space-y-1">
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
                    className="group flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => { setSelectedSkill(skill); setView("detail"); }}
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-500 flex-none" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{skill.name}</p>
                      {skill.description && (
                        <p className="text-[11px] text-muted-foreground truncate">{skill.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="hidden group-hover:flex flex-none p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleDelete(skill.name); }}
                      title="Delete skill"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-3 border-t flex-none">
              <Button size="sm" className="w-full gap-1.5" onClick={() => setView("create")}>
                <Plus className="h-3.5 w-3.5" />
                New Skill
              </Button>
            </div>
          </>
        )}

        {/* ── CREATE ── */}
        {view === "create" && (
          <>
            <div className="px-4 pt-4 pb-2 space-y-1.5 flex-none">
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
            <div className="flex-1 min-h-0 flex flex-col px-4 pb-2 gap-1.5">
              <label className="text-xs font-medium flex-none">SKILL.md</label>
              <Textarea
                value={readme}
                onChange={(e) => setReadme(e.target.value)}
                className="flex-1 min-h-0 text-xs font-mono resize-none leading-relaxed"
              />
            </div>
            <div className="p-3 border-t flex-none">
              <Button size="sm" className="w-full" onClick={handleCreate}>
                Create Skill
              </Button>
            </div>
          </>
        )}

        {/* ── DETAIL ── */}
        {view === "detail" && selectedSkill && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <p className="text-[10px] text-muted-foreground font-mono mb-3 break-all">
                {selectedSkill.location}
              </p>
              <pre className="text-xs font-mono whitespace-pre-wrap bg-muted rounded-md p-3 leading-relaxed">
                {`---\nname: ${selectedSkill.name}\ndescription: ${selectedSkill.description}\n---\n\n${selectedSkill.content}` || "(empty)"}
              </pre>
            </div>
            <div className="p-3 border-t flex-none">
              <Button
                size="sm"
                variant="destructive"
                className="w-full gap-1.5"
                onClick={() => handleDelete(selectedSkill.name)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Skill
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
