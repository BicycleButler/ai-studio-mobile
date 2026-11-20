#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "../../../..");
const cliScript = path.resolve(rootDir, "scripts/stubs-cli.ts");
const tsxBin = path.resolve(rootDir, "node_modules/.bin/tsx");

const result = spawnSync(tsxBin, [cliScript, ...process.argv.slice(2)], {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env,
});

process.exit(typeof result.status === "number" ? result.status : 1);
