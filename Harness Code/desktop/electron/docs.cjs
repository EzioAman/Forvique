// Document search for the desktop app: meaning-based search over the workspace's files (embedded on
// this device, nothing leaves it) plus each connected client server through the Forvique search API
// (docs/search-api.md). Pure Node so it can be tested without Electron.
const fs = require("node:fs/promises");
const path = require("node:path");
const { inside, SKIP } = require("./workspace.cjs");

const TEXT = new Set(
  ".md .mdx .txt .rst .csv .json .yaml .yml .toml .ini .xml .html .css .py .js .jsx .ts .tsx .go .rs .java .kt .c .h .cpp .cs .rb .php .sql .sh .ps1".split(" "),
);
const MAX_FILE = 5 * 1024 * 1024;
const MAX_FILES = 2000; // shortcut: whole-folder scan per search, capped; move to a persistent index (SQLite + watcher) for big repos
const MODEL = "Xenova/all-MiniLM-L6-v2";

async function extract(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = await fs.readFile(file);
  if (ext === ".pdf") {
    const { extractText } = await import("unpdf");
    return (await extractText(new Uint8Array(buf), { mergePages: true })).text;
  }
  if (ext === ".docx") return (await require("mammoth").extractRawText({ buffer: buf })).value;
  if (ext === ".xlsx") {
    const ExcelJS = require("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buf);
    const lines = [];
    book.eachSheet((sheet) =>
      sheet.eachRow((row) => lines.push(`${sheet.name}: ${row.values.slice(1).map((v) => v?.text ?? v?.result ?? v ?? "").join(" | ")}`)),
    );
    return lines.join("\n");
  }
  return TEXT.has(ext) ? buf.toString("utf8") : null;
}

function chunk(text, size = 1000, overlap = 150) {
  const out = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    const piece = text.slice(i, i + size).trim();
    if (piece) out.push({ text: piece, start: i });
    if (i + size >= text.length) break;
  }
  return out;
}

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

let embedder;
async function embed(texts, cacheDir) {
  if (!embedder) {
    const t = await import("@huggingface/transformers");
    // shortcut: the model (~25 MB) downloads on first use into cacheDir; bundle it in the installer for fully offline machines
    if (cacheDir) t.env.cacheDir = cacheDir;
    embedder = await t.pipeline("feature-extraction", MODEL);
  }
  const out = await embedder(texts, { pooling: "mean", normalize: true });
  return out.tolist();
}
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0); // vectors are normalized, so this is cosine similarity

async function* walk(dir, seen = { n: 0 }) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (seen.n >= MAX_FILES || SKIP.has(e.name) || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, seen);
    else if (e.isFile()) {
      seen.n++;
      yield p;
    }
  }
}

const cache = new Map(); // file -> { mtimeMs, text, chunks: [{ text, start, vec }] }

async function searchLocal(root, query, k, cacheDir) {
  const realRoot = await inside(root, "");
  const files = [];
  for await (const f of walk(realRoot)) files.push(f);
  for (const f of files) {
    const stat = await fs.stat(f);
    if (stat.size > MAX_FILE || cache.get(f)?.mtimeMs === stat.mtimeMs) continue;
    let text;
    try {
      text = await extract(f);
    } catch {
      text = null; // unreadable or corrupt file: skip it rather than fail the whole search
    }
    const chunks = text ? chunk(text) : [];
    const vecs = chunks.length ? await embed(chunks.map((c) => c.text), cacheDir) : [];
    cache.set(f, { mtimeMs: stat.mtimeMs, text, chunks: chunks.map((c, i) => ({ ...c, vec: vecs[i] })) });
  }
  const [q] = await embed([query], cacheDir);
  return files
    .flatMap((f) => (cache.get(f)?.chunks ?? []).map((c) => ({ f, c })))
    .map(({ f, c }) => ({
      source: path.relative(realRoot, f).split(path.sep).join("/"),
      location: `line ${lineOf(cache.get(f).text, c.start)}`,
      text: c.text,
      score: Number(dot(q, c.vec).toFixed(3)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// The Forvique search API: POST {url}/search {query, k} with a Bearer token -> {passages:[{text, source, location?, score?}]}
async function searchServer(server, query, k) {
  const url = `${server.url.replace(/\/+$/, "")}/search`;
  if (!/^https?:\/\//.test(url)) throw new Error(`${server.name}: the server URL must start with http:// or https://`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(server.token && { authorization: `Bearer ${server.token}` }) },
    body: JSON.stringify({ query, k }),
    signal: AbortSignal.timeout(15000),
  }).catch((e) => {
    throw new Error(`${server.name}: could not reach ${url} (${e.cause?.code ?? e.message})`);
  });
  if (!res.ok) throw new Error(`${server.name}: HTTP ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body?.passages)) throw new Error(`${server.name}: response has no passages list`);
  return body.passages
    .filter((p) => typeof p?.text === "string" && typeof p?.source === "string")
    .slice(0, k)
    .map((p) => ({ text: p.text, source: p.source, location: p.location ?? null, score: p.score ?? null }));
}

// Each source is reported separately: scores from different systems are not comparable.
async function search({ workspace, servers = [] }, query, k = 5, cacheDir) {
  if (!workspace && !servers.length) throw new Error("No documents are connected. Choose a workspace or add a server in Settings.");
  const settle = (p) => p.then((passages) => ({ passages }), (e) => ({ error: e.message }));
  const [local, ...remote] = await Promise.all([
    workspace ? settle(searchLocal(workspace, query, k, cacheDir)) : Promise.resolve(null),
    ...servers.map((s) => settle(searchServer(s, query, k))),
  ]);
  return {
    ...(local && { workspace: local }),
    servers: servers.map((s, i) => ({ name: s.name, ...remote[i] })),
  };
}

module.exports = { search, chunk, extract };
