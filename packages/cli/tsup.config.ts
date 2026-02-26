import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  outDir: "dist",
  outExtension: () => ({ js: ".mjs" }),
  banner: {
    js: [
      "#!/usr/bin/env node",
      // Create a proper require() for CJS deps that use require('os'), require('fs'), etc.
      "import { createRequire as __cjsCreateRequire } from 'node:module';",
      "const require = __cjsCreateRequire(import.meta.url);",
    ].join("\n"),
  },
  target: "node18",
  platform: "node",
  clean: true,
  external: [
    "@prisma/client",
    ".prisma",
    "prisma",
    "fsevents",
  ],
  // Bundle all non-external packages
  noExternal: [
    /^(?!@prisma|\.prisma|prisma|fsevents).*/,
  ],
  shims: false, // We provide our own require shim via banner
});
