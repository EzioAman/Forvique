// node --test electron/docs.test.cjs   (first run downloads the ~25 MB embeddings model)
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { search, chunk } = require("./docs.cjs");

test("chunks overlap and cover the text", () => {
  const parts = chunk("x".repeat(2500), 1000, 150);
  assert.equal(parts.length, 3);
  assert.equal(parts[1].start, 850);
});

test("searches local files by meaning and a server through the Forvique API", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "harness-docs-"));
  await fs.writeFile(path.join(root, "billing.md"), "Invoices are sent on the first day of each month. Late payments incur a 2% fee.");
  await fs.writeFile(path.join(root, "garden.txt"), "Tomatoes need full sun and regular watering in summer.");
  await fs.writeFile(path.join(root, "photo.png"), Buffer.from([0x89, 0x50]));

  let seenAuth;
  const server = http.createServer((req, res) => {
    seenAuth = req.headers.authorization;
    let body = "";
    req.on("data", (d) => (body += d)).on("end", () => {
      const { query, k } = JSON.parse(body);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ passages: [{ text: `stub hit for ${query}`, source: "crm/contracts.pdf", location: "page 2", score: 0.9 }, { bad: true }].slice(0, k) }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}`;

  try {
    const out = await search(
      { workspace: root, servers: [{ name: "Acme", url, token: "t0k" }, { name: "Down", url: "http://127.0.0.1:1", token: "" }] },
      "when do I get billed?",
      2,
      path.join(os.tmpdir(), "harness-models"),
    );
    assert.equal(out.workspace.passages[0].source, "billing.md"); // meaning, not keywords: "billed" vs "Invoices"
    assert.ok(out.workspace.passages[0].score > out.workspace.passages[1].score);
    assert.ok(!out.workspace.passages.some((p) => p.source === "photo.png"));
    assert.deepEqual(out.servers[0].passages, [{ text: "stub hit for when do I get billed?", source: "crm/contracts.pdf", location: "page 2", score: 0.9 }]);
    assert.equal(seenAuth, "Bearer t0k");
    assert.match(out.servers[1].error, /Down/); // one failing server does not sink the search
  } finally {
    server.close();
  }
  await assert.rejects(search({ workspace: "", servers: [] }, "x"), /No documents are connected/);
});
