#!/usr/bin/env node
import inquirer from "inquirer";
import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import fetch from "node-fetch";
import { load } from "cheerio";
import os from "os";

// ======================================================
// ✅ Strike Project Generator
// ======================================================

// -----------------------------
// Frameworks and templates
// -----------------------------
const frameworks = [
  "Express",
  "Fastify",
  "Koa",
  "Next.js",
  "Vite",
  "NestJS",
  "Hapi",
  "Sapper",
  "AdonisJS",
  "FeathersJS",
  "LoopBack",
  "Flask",
  "Django",
  "FastAPI",
];

const templates = [
  "Bot",
  "Dashboard",
  "API",
  "CLI Tool",
  "Web Scraper",
  "Machine Learning Project",
  "Microservice",
];

// -----------------------------
// Node.js optional dependencies
// -----------------------------
const nodeDependencies = [
  "mongoose",
  "sequelize",
  "socket.io",
  "graphql",
  "apollo-server",
  "prisma",
  "redis",
  "bull",
  "typeorm",
  "jsonwebtoken",
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
function parseDescription(description) {
  const structure = { routes: [], controllers: [], pages: [] };
  if (/route|routes/i.test(description)) structure.routes.push("example");
  if (/controller|controllers/i.test(description)) structure.controllers.push("main");
  if (/dashboard/i.test(description)) structure.pages.push("dashboard");
  if (/login/i.test(description)) structure.pages.push("login");
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
      const res = await fetchWithTimeout(
        `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      );
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

async function fetchCodeFromWeb(description) {
  log("🌐 Fetching full code from web editors...");
  const cached = await getCached(description);
  if (cached) {
    log("✅ Using cached snippet.");
    return cached;
  }

  const searchTasks = [fetchDuckDuckGo(description + " full project code")];
  const results = await Promise.all(searchTasks);
  const urls = results.flat();

  const snippets = await Promise.all(urls.map((url) => fetchCodeSnippet(url)));
  const validSnippet = snippets.find((s) => s.length > 200);
  if (validSnippet) {
    await setCached(description, validSnippet);
    return validSnippet;
  }
  return "";
}

// -----------------------------
// Environment check
// -----------------------------
async function verifyEnvironment() {
  try {
    await execa("node", ["-v"]);
  } catch {
    console.error("❌ Node.js not found. Please install Node.js first.");
    process.exit(1);
  }

  try {
    await execa("python", ["--version"]);
  } catch {
    log("⚠️ Python not found. Python frameworks will be skipped.");
  }
}

// -----------------------------
// Framework setup
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
import fs from 'fs';
import path from 'path';
const app = express();
const routesPath = path.join(process.cwd(), 'routes');
if (fs.existsSync(routesPath)) {
  fs.readdirSync(routesPath).forEach(file => {
    import('./routes/' + file).then(mod => mod.default(app));
  });
}
app.listen(3000, () => console.log('Express server running on http://localhost:3000'));
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
import Router from '@koa/router';
const app = new Koa();
const router = new Router();
router.get('/', ctx => ctx.body = 'Hello from Koa!');
app.use(router.routes()).use(router.allowedMethods());
app.listen(3000, () => console.log('Koa running on http://localhost:3000'));
`);
        await safeExec("npm", ["install", "koa", "@koa/router"], { cwd: projectDir });
        break;

      case "next.js":
        await safeExec("npx", ["create-next-app@latest", "next-app"], { cwd: projectDir });
        break;

      case "vite":
        await safeExec("npm", ["create", "vite@latest", "vite-app"], { cwd: projectDir });
        break;

      case "nestjs":
        await safeExec("npx", ["@nestjs/cli", "new", "nestjs-app"], { cwd: projectDir });
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

      case "flask":
        await fs.writeFile(path.join(projectDir, "app.py"), `
from flask import Flask
app = Flask(__name__)
@app.route('/')
def home():
    return "Hello from Flask!"
if __name__ == '__main__':
    app.run(debug=True)
`);
        await safeExec("python", ["-m", "venv", "venv"], { cwd: projectDir });
        await safeExec(path.join(projectDir, "venv", "Scripts", "pip"), ["install", "flask"], { cwd: projectDir });
        break;

      case "django":
        await safeExec("pip", ["install", "django"], { cwd: projectDir });
        await safeExec("django-admin", ["startproject", "django_app", "."], { cwd: projectDir });
        break;

      case "fastapi":
        await fs.writeFile(path.join(projectDir, "main.py"), `
from fastapi import FastAPI
import uvicorn
app = FastAPI()
@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI!"}
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
`);
        await safeExec("python", ["-m", "venv", "venv"], { cwd: projectDir });
        await safeExec(path.join(projectDir, "venv", "Scripts", "pip"), ["install", "fastapi", "uvicorn"], { cwd: projectDir });
        break;

      default:
        log(`⚠️ Framework "${framework}" setup not implemented.`);
    }
  } catch (err) {
    log(`❌ Failed to set up ${framework}: ${err.message}`);
  }
}

// -----------------------------
// Install optional dependencies
// -----------------------------
async function installDependencies(projectDir, selectedDeps) {
  log("📦 Installing selected Node.js dependencies...");
  const folders = ["models", "services", "middleware", "utils"];
  for (const folder of folders) await fs.ensureDir(path.join(projectDir, folder));

  if (selectedDeps.includes("mongoose")) {
    await fs.writeFile(path.join(projectDir, "models", "user.js"), `
import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({ name: String, email: String });
export default mongoose.model('User', userSchema);
`);
  }

  if (selectedDeps.includes("sequelize")) {
    await fs.writeFile(path.join(projectDir, "models", "post.js"), `
import { Sequelize, DataTypes } from 'sequelize';
const sequelize = new Sequelize('sqlite::memory:');
const Post = sequelize.define('Post', { title: DataTypes.STRING, content: DataTypes.TEXT });
export default Post;
`);
  }

  if (selectedDeps.includes("socket.io")) {
    await fs.writeFile(path.join(projectDir, "services", "socket.js"), `
import { Server } from 'socket.io';
export function initSocket(server) {
  const io = new Server(server);
  io.on('connection', socket => console.log('Client connected'));
}
`);
  }

  if (selectedDeps.includes("graphql") || selectedDeps.includes("apollo-server")) {
    await fs.writeFile(path.join(projectDir, "services", "graphql.js"), `
import { ApolloServer, gql } from 'apollo-server';
const typeDefs = gql\`type Query { hello: String }\`;
const resolvers = { Query: { hello: () => 'Hello GraphQL' } };
export const server = new ApolloServer({ typeDefs, resolvers });
`);
  }

  if (selectedDeps.includes("redis") || selectedDeps.includes("bull")) {
    await fs.writeFile(path.join(projectDir, "services", "queue.js"), `
import Queue from 'bull';
const myQueue = new Queue('tasks');
export default myQueue;
`);
  }

  if (selectedDeps.includes("jsonwebtoken")) {
    await fs.writeFile(path.join(projectDir, "utils", "auth.js"), `
import jwt from 'jsonwebtoken';
export function generateToken(payload) {
  return jwt.sign(payload, 'secret', { expiresIn: '1h' });
}
`);
  }

  for (const dep of selectedDeps) {
    log(`⚙️ Installing ${dep}...`);
    await safeExec("npm", ["install", dep], { cwd: projectDir });
  }

  log("✅ Selected optional dependencies installed!");
}

// -----------------------------
// Main CLI
// -----------------------------
async function main() {
  log("🚀 Strike Project Generator started...");
  await verifyEnvironment();

  const answers = await inquirer.prompt([
    { type: "list", name: "framework", message: "Which framework do you want to use?", choices: frameworks },
    { type: "list", name: "template", message: "Select a project template:", choices: templates },
    { type: "editor", name: "description", message: "Describe your project (multi-line supported):" },
    { type: "checkbox", name: "dependencies", message: "Select optional Node.js dependencies to include:", choices: nodeDependencies },
  ]);

  const { framework, description, dependencies } = answers;
  const projectDir = path.join(process.cwd(), "strike-project");

  await fs.ensureDir(projectDir);
  await fs.emptyDir(projectDir);

  const structure = parseDescription(description);
  const routesDir = path.join(projectDir, "routes");
  const controllersDir = path.join(projectDir, "controllers");
  if (structure.routes.length > 0) await fs.ensureDir(routesDir);
  if (structure.controllers.length > 0) await fs.ensureDir(controllersDir);

  const codeSnippet = await fetchCodeFromWeb(description);
  for (const route of structure.routes)
    await fs.writeFile(path.join(routesDir, `${route}.js`), codeSnippet || `export default function ${route}Routes(app) {}`);
  for (const ctrl of structure.controllers)
    await fs.writeFile(path.join(controllersDir, `${ctrl}.js`), codeSnippet || `export function ${ctrl}Controller() {}`);

  await setupFramework(framework, projectDir);
  await installDependencies(projectDir, dependencies);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`\n✅ Project for ${framework} created successfully in ${duration}s!`);
  log(`📂 Location: ${projectDir}`);
}

// Handle graceful exit
process.on("SIGINT", () => {
  log("\n🧹 Cleaning up temporary cache...");
  fs.emptyDirSync(cacheDir);
  log("👋 Process terminated gracefully.");
  process.exit(0);
});

main().catch((err) => {
  console.error("❌ Fatal error:", err);
});
