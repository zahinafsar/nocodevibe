import { tool } from "ai";
import { z } from "zod/v4";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

/**
 * Tool for writing the plan file in plan mode.
 * Only writes to the designated plan file path.
 */
export const createPlanWriteTool = (planPath: string) =>
  tool({
    description:
      "Write or update the plan file. Use this to save your implementation plan. " +
      "This is the ONLY file you can write to in plan mode. " +
      "Write the full plan content — this overwrites the previous plan.",
    inputSchema: z.object({
      content: z.string().describe("The full plan content (markdown)"),
    }),
    execute: async ({ content }) => {
      await mkdir(dirname(planPath), { recursive: true });
      await writeFile(planPath, content, "utf-8");
      return `Plan written to ${planPath}`;
    },
  });

/**
 * Tool for exiting plan mode and switching to agent/build mode.
 * The agent calls this when the plan is complete and ready to execute.
 */
export const createPlanExitTool = (planPath: string) =>
  tool({
    description:
      "Call this when your plan is complete and you are ready to switch to agent (build) mode. " +
      "This will signal the user to switch to agent mode to execute the plan.",
    inputSchema: z.object({}),
    execute: async () => {
      let planContent = "";
      try {
        planContent = await readFile(planPath, "utf-8");
      } catch {
        // Plan file may not exist yet
      }
      // Return a signal that the frontend can detect
      return JSON.stringify({
        __mode_switch: true,
        mode: "agent",
        planPath,
        planContent: planContent || "(no plan file written)",
      });
    },
  });

/**
 * Get the plan file path for a session.
 */
export function getPlanPath(_projectDir: string, sessionId: string): string {
  return join(homedir(), ".coodeen", "plans", `${sessionId}.md`);
}

/**
 * Try to read an existing plan file for a session.
 */
export async function readPlan(planPath: string): Promise<string | null> {
  try {
    return await readFile(planPath, "utf-8");
  } catch {
    return null;
  }
}
