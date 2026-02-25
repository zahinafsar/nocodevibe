import { prisma } from "./client.js";

export const provider = {
  list: () => prisma.provider.findMany({ orderBy: { createdAt: "desc" } }),

  get: (id: string) => prisma.provider.findUnique({ where: { id } }),

  upsert: (id: string, data: { apiKey: string; modelId: string }) =>
    prisma.provider.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    }),

  delete: (id: string) => prisma.provider.delete({ where: { id } }),
};
