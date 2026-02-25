import { prisma } from "./client.js";

export type MessageRole = "user" | "assistant" | "system";

export const message = {
  append: (sessionId: string, role: MessageRole, content: string) =>
    prisma.message.create({
      data: { sessionId, role, content },
    }),

  listBySession: (sessionId: string) =>
    prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    }),
};
