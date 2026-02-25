import { prisma } from "./client.js";

export const session = {
  create: (title: string) =>
    prisma.session.create({ data: { title } }),

  get: (id: string) =>
    prisma.session.findUnique({ where: { id } }),

  list: () =>
    prisma.session.findMany({ orderBy: { updatedAt: "desc" } }),

  delete: (id: string) =>
    prisma.session.delete({ where: { id } }),
};
