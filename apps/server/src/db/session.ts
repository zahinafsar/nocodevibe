import { prisma } from "./client.js";

export const session = {
  create: (data: {
    title: string;
    providerId?: string;
    modelId?: string;
    projectDir?: string;
    previewUrl?: string;
  }) => prisma.session.create({ data }),

  get: (id: string) =>
    prisma.session.findUnique({ where: { id } }),

  list: () =>
    prisma.session.findMany({ orderBy: { updatedAt: "desc" } }),

  update: (
    id: string,
    data: { providerId?: string; modelId?: string; projectDir?: string; previewUrl?: string },
  ) => prisma.session.update({ where: { id }, data }),

  delete: (id: string) =>
    prisma.session.delete({ where: { id } }),
};
