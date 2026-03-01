import { tool } from "ai";
import { z } from "zod/v4";

const questionSchema = z.object({
  questions: z
    .array(
      z.object({
        type: z
          .enum(["text", "single_select", "multi_select"])
          .describe(
            "text = free-form textarea, single_select = radio buttons, multi_select = checkboxes",
          ),
        question: z.string().describe("The question to display as a label"),
        options: z
          .array(z.string())
          .optional()
          .describe("Options for single_select / multi_select (ignored for text)"),
      }),
    )
    .describe("Array of questions to ask the user"),
});

export const createQuestionTool = () =>
  tool({
    description:
      "Ask the user clarifying questions before creating a plan. " +
      "Use this to gather requirements, preferences, and constraints. " +
      "Each question can be free-text (textarea), single-select (radio), or multi-select (checkboxes). " +
      "The frontend will show a modal with these questions. " +
      "The user's answers will arrive as the next user message.",
    inputSchema: questionSchema,
    execute: async () => {
      return "Questions displayed to the user. Their answers will come in the next message.";
    },
  });
