// Electron main process: one window that loads the built UI from disk, so the app works offline.
// Set VITE_DEV_SERVER_URL to load the Vite dev server instead while developing.
// The UI reaches the disk only through the handlers below (see preload.cjs), never through Node directly.
const { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const workspace = require("./workspace.cjs");
const docs = require("./docs.cjs");

// ── settings, kept on this device ─────────────────────────────
// { workspace: string, servers: [{ name, url, token }], embeddings: "on-device" | "provider" }
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
const seal = (s) => (s && safeStorage.isEncryptionAvailable() ? `enc:${safeStorage.encryptString(s).toString("base64")}` : s);
const unseal = (s) => (s?.startsWith("enc:") ? safeStorage.decryptString(Buffer.from(s.slice(4), "base64")) : s);

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
    return { workspace: "", embeddings: "on-device", ...raw, servers: (raw.servers ?? []).map((x) => ({ ...x, token: unseal(x.token) })) };
  } catch {
    return { workspace: "", servers: [], embeddings: "on-device" }; // first run or unreadable: start empty
  }
}
function saveSettings(next) {
  const stored = { ...next, servers: next.servers.map((x) => ({ ...x, token: seal(x.token) })) };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(stored, null, 2));
}
// tokens never travel to the UI; it only learns whether one is set
const publicSettings = (s) => ({ ...s, servers: s.servers.map(({ token, ...x }) => ({ ...x, hasToken: Boolean(token) })) });

function registerHandlers() {
  ipcMain.handle("settings:get", () => publicSettings(loadSettings()));
  ipcMain.handle("settings:set", (_e, patch) => {
    const cur = loadSettings();
    const next = { ...cur, ...patch };
    if (patch.servers) {
      // keep a stored token unless the UI sent a new one
      next.servers = patch.servers.map((x) => ({
        name: String(x.name ?? ""),
        url: String(x.url ?? ""),
        token: x.token ?? cur.servers.find((c) => c.url === x.url)?.token ?? "",
      }));
    }
    saveSettings(next);
    return publicSettings(next);
  });
  ipcMain.handle("workspace:pick", async (e) => {
    const res = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ["openDirectory"] });
    if (res.canceled || !res.filePaths[0]) return publicSettings(loadSettings());
    saveSettings({ ...loadSettings(), workspace: res.filePaths[0] });
    return publicSettings(loadSettings());
  });
  ipcMain.handle("workspace:read", (_e, rel) => workspace.read(loadSettings().workspace, rel));
  ipcMain.handle("workspace:current", (_e, rel) => workspace.current(loadSettings().workspace, rel));
  ipcMain.handle("workspace:write", (_e, rel, content) => workspace.write(loadSettings().workspace, rel, String(content)));
  ipcMain.handle("docs:search", (_e, query, k) =>
    docs.search(loadSettings(), String(query), Math.min(Math.max(Number(k) || 5, 1), 20), path.join(app.getPath("userData"), "models")),
  );
}

// The installed app is a locked shell: no DevTools, no reload or zoom keys, no browser menu, no navigating
// away. `pnpm app` (unpackaged) keeps DevTools for development. Node-level debugging is switched off in the
// shipped binary by the electronFuses in package.json.
const locked = app.isPackaged;
const openOutside = (url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url); // only web URLs leave the app, in the user's browser
};
// browser shortcuts that make no sense in an app: reload, devtools, view source, zoom, print, find
const BLOCKED_KEYS = /^(F5|F12|F11)$|^Control\+(r|R|Shift\+R|Shift\+I|Shift\+J|Shift\+C|u|U|=|\+|-|0|p|P|f|F)$/;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 520,
    title: "Harness",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
      devTools: !locked,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl && !locked) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: "deny" };
  });
  // the window only ever shows the app; links clicked inside it open outside
  win.webContents.on("will-navigate", (e, url) => {
    e.preventDefault();
    openOutside(url);
  });
  if (locked) {
    win.webContents.setVisualZoomLevelLimits(1, 1);
    win.webContents.on("before-input-event", (e, input) => {
      const combo = [input.control || input.meta ? "Control" : "", input.shift ? "Shift" : "", input.key].filter(Boolean).join("+");
      if (BLOCKED_KEYS.test(combo)) e.preventDefault();
    });
    win.webContents.on("devtools-opened", () => win.webContents.closeDevTools());
  }
}

// a packaged build refuses to start with a remote debugging port
if (locked && process.argv.some((a) => /^--(remote-debugging|inspect)/.test(a))) app.exit(1);

app.on("web-contents-created", (_e, contents) => {
  contents.on("will-attach-webview", (e) => e.preventDefault()); // no embedded browsers
});

app.whenReady().then(() => {
  if (locked) Menu.setApplicationMenu(null); // drops the default menu and its reload/devtools/zoom accelerators
  registerHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
