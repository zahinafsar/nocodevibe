import { tool } from "ai";
import { z } from "zod/v4";

export const createWebSearchTool = () =>
  tool({
    description:
      `Search the web for information using Exa AI. ` +
      `Returns content from the most relevant websites. ` +
      `Use for current events, recent data, or anything beyond your knowledge cutoff. ` +
      `To read a specific URL, use the webfetch tool instead. ` +
      `The current year is ${new Date().getFullYear()}.`,
    inputSchema: z.object({
      query: z.string().describe("Web search query"),
    }),
    execute: async ({ query }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      try {
        const res = await fetch("https://mcp.exa.ai/mcp", {
          method: "POST",
          headers: {
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
              name: "web_search_exa",
              arguments: {
                query,
                type: "auto",
                numResults: 8,
                livecrawl: "fallback",
              },
            },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Search error (${res.status}): ${errorText}`);
        }

        const text = await res.text();
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.substring(6));
            if (data.result?.content?.[0]?.text) {
              return data.result.content[0].text;
            }
          }
        }

        return "No search results found. Please try a different query.";
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Web search request timed out");
        }
        throw error;
      }
    },
  });
