import { prisma } from "./client.js";

export const config = {
  get: async (key: string): Promise<string | null> => {
    const row = await prisma.config.findUnique({ where: { key } });
    return row?.value ?? null;
  },

  set: (key: string, value: string) =>
    prisma.config.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    }),

  delete: (key: string) => prisma.config.delete({ where: { key } }),
};
