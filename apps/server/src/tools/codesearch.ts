import { tool } from "ai";
import { z } from "zod/v4";

const API_CONFIG = {
  BASE_URL: "https://mcp.exa.ai",
  ENDPOINT: "/mcp",
} as const;

interface McpCodeRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: {
    name: string;
    arguments: {
      query: string;
      tokensNum: number;
    };
  };
}

interface McpCodeResponse {
  jsonrpc: string;
  result: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
}

export const createCodeSearchTool = () =>
  tool({
    description:
      "Search and get relevant context for any programming task using Exa Code API. " +
      "Provides the highest quality and freshest context for libraries, SDKs, and APIs. " +
      "Use this tool for ANY question or task related to programming. " +
      "Returns comprehensive code examples, documentation, and API references. " +
      "Examples: 'React useState hook examples', 'Python pandas dataframe filtering', 'Express.js middleware', 'Next.js partial prerendering configuration'.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Search query to find relevant context for APIs, libraries, and SDKs"
        ),
      tokensNum: z
        .number()
        .min(1000)
        .max(50000)
        .optional()
        .describe(
          "Number of tokens to return (1000-50000). Default is 5000 tokens. Use lower values for focused queries and higher values for comprehensive documentation."
        ),
    }),
    execute: async ({ query, tokensNum }) => {
      const codeRequest: McpCodeRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "get_code_context_exa",
          arguments: {
            query,
            tokensNum: tokensNum || 5000,
          },
        },
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(
          `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINT}`,
          {
            method: "POST",
            headers: {
              accept: "application/json, text/event-stream",
              "content-type": "application/json",
            },
            body: JSON.stringify(codeRequest),
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Code search error (${response.status}): ${errorText}`
          );
        }

        const responseText = await response.text();

        // Parse SSE response
        const lines = responseText.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data: McpCodeResponse = JSON.parse(line.substring(6));
            if (
              data.result &&
              data.result.content &&
              data.result.content.length > 0
            ) {
              return data.result.content[0].text;
            }
          }
        }

        return "No code snippets or documentation found. Please try a different query, be more specific about the library or programming concept, or check the spelling of framework names.";
      } catch (error) {
        clearTimeout(timeout);

        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Code search request timed out");
        }

        throw error;
      }
    },
  });
