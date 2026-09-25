import nextEnv from "@next/env";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const { loadEnvConfig } = nextEnv;
loadEnvConfig(resolve(currentDirectory, "../.."));

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  output: "standalone",
  outputFileTracingRoot: resolve(currentDirectory, "../.."),
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
