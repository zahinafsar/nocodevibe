import { tool, zodSchema } from "ai";
import { z } from "zod/v4";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const DEFAULT_TIMEOUT = 30_000; // 30s

export const createImageFetchTool = (supportsVision: boolean) =>
  tool({
    description:
      "Fetch an image from a URL and return it for visual inspection. " +
      "Use this when you need to view or analyze an image from a URL. " +
      "Supports common image formats (PNG, JPEG, GIF, WebP, SVG).",
    inputSchema: zodSchema(
      z.object({
        url: z.string().describe("The image URL to fetch"),
      })
    ),
    execute: async ({ url }) => {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Accept: "image/*,*/*",
          },
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timer);

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }

        const contentType = res.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) {
          throw new Error(
            `URL did not return an image (content-type: ${contentType})`
          );
        }

        const contentLength = res.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
          throw new Error("Image too large (exceeds 20MB limit)");
        }

        const buffer = await res.arrayBuffer();

        if (buffer.byteLength > MAX_IMAGE_SIZE) {
          throw new Error("Image too large (exceeds 20MB limit)");
        }

        const base64 = Buffer.from(buffer).toString("base64");
        const mime = contentType.split(";")[0];
        const sizeKB = Math.round(buffer.byteLength / 1024);

        return { base64, mime, url, sizeKB };
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`Image fetch timed out after ${DEFAULT_TIMEOUT / 1000}s`);
        }
        throw error;
      }
    },
    toModelOutput({ output }) {
      // Vision models: send as file-data content part
      if (supportsVision) {
        return {
          type: "content" as const,
          value: [
            {
              type: "image-data" as const,
              data: output.base64,
              mediaType: output.mime,
            },
            {
              type: "text" as const,
              text: `Image fetched from ${output.url}`,
            },
          ],
        };
      }

      // Non-vision models: text-only summary
      return {
        type: "text" as const,
        value: `Image fetched from ${output.url} (${output.mime}, ${output.sizeKB}KB). This model does not support vision — the image is available in the chat UI for the user to view.`,
      };
    },
  });
