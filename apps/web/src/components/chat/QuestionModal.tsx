import { useState } from "react";
import type { QuestionInfo } from "../../lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface QuestionModalProps {
  open: boolean;
  questions: QuestionInfo[];
  onSubmit: (answers: Array<{ question: string; answer: string | string[] }>) => void;
}

export function QuestionModal({ open, questions, onSubmit }: QuestionModalProps) {
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});

  const updateAnswer = (index: number, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  };

  const toggleMultiSelect = (index: number, option: string) => {
    setAnswers((prev) => {
      const current = (prev[index] as string[]) || [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [index]: next };
    });
  };

  const handleSubmit = () => {
    const formatted = questions.map((q, i) => ({
      question: q.question,
      answer: answers[i] ?? (q.type === "multi_select" ? [] : ""),
    }));
    onSubmit(formatted);
  };

  const allAnswered = questions.every((q, i) => {
    const a = answers[i];
    if (q.type === "text") return typeof a === "string" && a.trim().length > 0;
    if (q.type === "single_select") return typeof a === "string" && a.length > 0;
    if (q.type === "multi_select") return Array.isArray(a) && a.length > 0;
    return false;
  });

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg max-h-[80vh] flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>A few questions before we plan</DialogTitle>
          <DialogDescription>
            Help me understand your requirements so I can create a better plan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 overflow-y-auto py-2 pr-1">
          {questions.map((q, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-foreground">
                {q.question}
              </Label>

              {q.type === "text" && (
                <Textarea
                  placeholder="Type your answer..."
                  value={(answers[i] as string) ?? ""}
                  onChange={(e) => updateAnswer(i, e.target.value)}
                  className="min-h-20 resize-none"
                />
              )}

              {q.type === "single_select" && q.options && (
                <div className="flex flex-col gap-1.5">
                  {q.options.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => updateAnswer(i, option)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors text-sm text-left",
                        answers[i] === option
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border hover:bg-accent text-muted-foreground",
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                          answers[i] === option
                            ? "border-primary"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {answers[i] === option && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "multi_select" && q.options && (
                <div className="flex flex-col gap-1.5">
                  {q.options.map((option) => {
                    const selected = ((answers[i] as string[]) || []).includes(option);
                    return (
                      <button
                        type="button"
                        key={option}
                        onClick={() => toggleMultiSelect(i, option)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors text-sm text-left",
                          selected
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border hover:bg-accent text-muted-foreground",
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0",
                            selected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40",
                          )}
                        >
                          {selected && (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 10 10"
                              fill="none"
                              className="text-primary-foreground"
                            >
                              <path
                                d="M8.5 2.5L3.5 7.5L1.5 5.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!allAnswered} className="w-full sm:w-auto">
            Submit Answers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
