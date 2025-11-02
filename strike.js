#!/usr/bin/env node
import fs from "fs-extra";
import path from "path";
import os from "os";
import { execa } from "execa";
import fetch from "node-fetch";
import { load } from "cheerio";

// -----------------------------
// Inputs from GitHub Actions
// -----------------------------
const framework = process.env.STRIKE_FRAMEWORK || "Express";
const description = process.env.STRIKE_DESCRIPTION || "A sample project";

// -----------------------------
// Frameworks and templates
// -----------------------------
const frameworks = [
  "Express", "Fastify", "Koa", "Next.js", "Vite", "NestJS", "Hapi", "Sapper",
  "AdonisJS", "FeathersJS", "LoopBack", "Flask", "Django", "FastAPI"
];

const templates = [
  "Bot", "Dashboard", "API", "CLI Tool", "Web Scraper", "Machine Learning Project", "Microservice"
];

// -----------------------------
// Utilities & logging
// -----------------------------
const cacheDir = path.join(os.tmpdir(), "strike_cache");
await fs.ensureDir(cacheDir);
const startTime = Date.now();

function log(msg) {
  const stamp = new Date().toLocaleTimeString();
  console.log(`[${stamp}] ${msg}`);
}

// -----------------------------
// Caching system
// -----------------------------
async function getCached(query) {
  const file = path.join(cacheDir, Buffer.from(query).toString("base64") + ".txt");
  if (await fs.pathExists(file)) return await fs.readFile(file, "utf-8");
  return null;
}

async function setCached(query, data) {
  const file = path.join(cacheDir, Buffer.from(query).toString("base64") + ".txt");
  await fs.writeFile(file, data);
}

// -----------------------------
// Safe exec wrapper
// -----------------------------
async function safeExec(command, args, options = {}) {
  try {
    await execa(command, args, { stdio: "inherit", ...options });
  } catch (err) {
    log(`⚠️ Command failed: ${command} ${args.join(" ")} | ${err.message}`);
  }
}

// -----------------------------
// Parse description → structure
// -----------------------------
function parseDescription(desc) {
  const structure = { routes: [], controllers: [], pages: [] };
  if (/route|routes/i.test(desc)) structure.routes.push("example");
  if (/controller|controllers/i.test(desc)) structure.controllers.push("main");
  if (/dashboard/i.test(desc)) structure.pages.push("dashboard");
  if (/login/i.test(desc)) structure.pages.push("login");
  return structure;
}

// -----------------------------
// Web scraping helpers
// -----------------------------
async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchDuckDuckGo(query, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchWithTimeout(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      const html = await res.text();
      const $ = load(html);
      const links = [];
      $("a.result__a").each((i, el) => links.push($(el).attr("href")));
      if (links.length) return links.slice(0, 5);
    } catch {
      if (i === retries) log("⚠️ DuckDuckGo fetch failed after retries.");
    }
  }
  return [];
}

async function fetchCodeSnippet(url, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchWithTimeout(url);
      const html = await res.text();
      const $ = load(html);
      const codes = [];
      $("code, pre, .code, .editor, .snippet").each((i, el) => codes.push($(el).text()));
      if (codes.length) return codes.join("\n").slice(0, 5000);
    } catch {
      if (i === retries) log(`⚠️ Failed to fetch snippet from ${url}`);
    }
  }
  return "";
}

async function fetchCodeFromWeb(desc) {
  log("🌐 Fetching full code from web editors...");
  const cached = await getCached(desc);
  if (cached) {
    log("✅ Using cached snippet.");
    return cached;
  }

  const urls = (await fetchDuckDuckGo(desc + " full project code")).flat();
  const snippets = await Promise.all(urls.map((url) => fetchCodeSnippet(url)));
  const validSnippet = snippets.find((s) => s.length > 200);
  if (validSnippet) {
    await setCached(desc, validSnippet);
    return validSnippet;
  }
  return "";
}

// -----------------------------
// Environment check
// -----------------------------
async function verifyEnvironment() {
  try { await execa("node", ["-v"]); } 
  catch { console.error("❌ Node.js not found."); process.exit(1); }

  try { await execa("python3", ["--version"]); } 
  catch { log("⚠️ Python not found. Python frameworks will be skipped."); }
}

// -----------------------------
// Framework-specific setup
// -----------------------------
async function setupFramework(framework, projectDir) {
  const fw = framework.toLowerCase();
  const indexPath = path.join(projectDir, "index.js");
  log(`⚙️ Setting up framework: ${framework}`);

  try {
    switch (fw) {
      case "express":
        await fs.writeFile(indexPath, `
import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('Hello from Express!'));
app.listen(3000, () => console.log('Express running on http://localhost:3000'));
`);
        await safeExec("npm", ["install", "express"], { cwd: projectDir });
        break;

      case "fastify":
        await fs.writeFile(indexPath, `
import Fastify from 'fastify';
const app = Fastify();
app.get('/', async () => ({ message: 'Hello from Fastify!' }));
app.listen({ port: 3000 }, () => console.log('Fastify running on http://localhost:3000'));
`);
        await safeExec("npm", ["install", "fastify"], { cwd: projectDir });
        break;

      case "koa":
        await fs.writeFile(indexPath, `
import Koa from 'koa';
const app = new Koa();
app.use(async ctx => ctx.body = 'Hello from Koa!');
app.listen(3000, () => console.log('Koa running on http://localhost:3000'));
`);
        await safeExec("npm", ["install", "koa"], { cwd: projectDir });
        break;

      case "hapi":
        await fs.writeFile(indexPath, `
import Hapi from '@hapi/hapi';
const server = Hapi.server({ port: 3000, host: 'localhost' });
server.route({ method: 'GET', path: '/', handler: () => 'Hello from Hapi!' });
await server.start();
console.log('Hapi running on', server.info.uri);
`);
        await safeExec("npm", ["install", "@hapi/hapi"], { cwd: projectDir });
        break;

      case "nestjs":
        await safeExec("npx", ["@nestjs/cli", "new", "nestjs-app", "--skip-install"], { cwd: projectDir });
        break;

      case "next.js":
        await safeExec("npx", ["create-next-app@latest", "next-app", "--yes"], { cwd: projectDir });
        break;

      case "vite":
        await safeExec("npm", ["create", "vite@latest", "vite-app", "--yes"], { cwd: projectDir });
        break;

      case "flask":
        await fs.writeFile(path.join(projectDir, "app.py"), `
from flask import Flask
app = Flask(__name__)
@app.route('/')
def home():
    return "Hello from Flask!"
`);
        await safeExec("python3", ["-m", "venv", "venv"], { cwd: projectDir });
        await safeExec(path.join(projectDir, "venv", "bin", "pip"), ["install", "flask"], { cwd: projectDir });
        break;

      case "django":
        await safeExec("python3", ["-m", "pip", "install", "django"], { cwd: projectDir });
        await safeExec("django-admin", ["startproject", "django_app", "."], { cwd: projectDir });
        break;

      case "fastapi":
        await fs.writeFile(path.join(projectDir, "main.py"), `
from fastapi import FastAPI
app = FastAPI()
@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI!"}
`);
        await safeExec("python3", ["-m", "venv", "venv"], { cwd: projectDir });
        await safeExec(path.join(projectDir, "venv", "bin", "pip"), ["install", "fastapi", "uvicorn"], { cwd: projectDir });
        break;

      default:
        log(`⚠️ Framework "${framework}" setup not implemented.`);
    }
  } catch (err) {
    log(`❌ Failed to set up ${framework}: ${err.message}`);
  }
}

// -----------------------------
// Main function
// -----------------------------
async function main() {
  log("🚀 Strike Project Generator started...");
  await verifyEnvironment();

  const projectDir = path.join(process.cwd(), "strike-project");
  await fs.ensureDir(projectDir);
  await fs.emptyDir(projectDir);

  const structure = parseDescription(description);
  const routesDir = path.join(projectDir, "routes");
  const controllersDir = path.join(projectDir, "controllers");
  if (structure.routes.length) await fs.ensureDir(routesDir);
  if (structure.controllers.length) await fs.ensureDir(controllersDir);

  const codeSnippet = await fetchCodeFromWeb(description);
  for (const route of structure.routes)
    await fs.writeFile(path.join(routesDir, `${route}.js`), codeSnippet || `export default function ${route}Routes(app) {}`);
  for (const ctrl of structure.controllers)
    await fs.writeFile(path.join(controllersDir, `${ctrl}.js`), codeSnippet || `export function ${ctrl}Controller() {}`);

  await setupFramework(framework, projectDir);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`\n✅ Project for ${framework} created successfully in ${duration}s!`);
  log(`📂 Location: ${projectDir}`);
}

// -----------------------------
// Graceful cleanup
// -----------------------------
process.on("SIGINT", () => {
  log("\n🧹 Cleaning up temporary cache...");
  fs.emptyDirSync(cacheDir);
  log("👋 Process terminated gracefully.");
  process.exit(0);
});

main().catch(err => console.error("❌ Fatal error:", err));
