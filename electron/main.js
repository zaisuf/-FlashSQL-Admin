const { app, BrowserWindow, dialog, nativeTheme, powerMonitor, shell } = require("electron");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const isDev = !app.isPackaged || process.env.ELECTRON_DEV === "1";
const DEV_URL = process.env.ELECTRON_DEV_URL || "http://localhost:3000";
const BACKGROUND = { r: 10, g: 10, b: 10 };

if (process.env.FLASH_SQL_DISABLE_GPU === "1") {
  app.disableHardwareAcceleration();
}

nativeTheme.themeSource = "dark";

let mainWindow = null;
let baseUrl = DEV_URL;
let logFile = null;
let recovering = false;

function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(" ")}\n`;
  try {
    if (!logFile) logFile = path.join(app.getPath("userData"), "main.log");
    fs.appendFileSync(logFile, line);
  } catch {
    /* logging must never break the app */
  }
  try {
    process.stdout.write(line);
  } catch {
    /* no console attached */
  }
}

process.on("uncaughtException", (error) => {
  log("uncaughtException:", (error && error.stack) || String(error));
});
process.on("unhandledRejection", (reason) => {
  log("unhandledRejection:", (reason && reason.stack) || String(reason));
});

log("boot; electron", process.versions.electron, "node", process.versions.node, "packaged", String(app.isPackaged));

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 3000;
      server.close(() => resolve(port));
    });
  });
}

async function startServer() {
  if (isDev) return DEV_URL;

  const port = await freePort();
  process.env.NODE_ENV = "production";
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.FLASH_SQL_DATA_DIR = app.getPath("userData");

  const serverPath = path.join(process.resourcesPath, "app", "server.js");
  log("loading server:", serverPath, "port", port);
  require(serverPath);
  log("server started on port", port);

  return `http://127.0.0.1:${port}`;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
  ]);
}

function looksBlank(image) {
  const size = image.getSize();
  if (!size.width || !size.height) return true;
  const buffer = image.toBitmap();
  const stepX = Math.max(1, Math.floor(size.width / 48));
  const stepY = Math.max(1, Math.floor(size.height / 48));
  let painted = 0;
  let total = 0;
  for (let y = 0; y < size.height; y += stepY) {
    for (let x = 0; x < size.width; x += stepX) {
      const i = (y * size.width + x) * 4;
      total++;
      const b = buffer[i];
      const g = buffer[i + 1];
      const r = buffer[i + 2];
      const delta =
        Math.abs(r - BACKGROUND.r) + Math.abs(g - BACKGROUND.g) + Math.abs(b - BACKGROUND.b);
      if (delta > 15) painted++;
    }
  }
  return total > 0 && painted / total < 0.02;
}

async function checkPaint(reason) {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  try {
    const image = await withTimeout(win.webContents.capturePage(), 4000);
    if (looksBlank(image)) {
      log(`paint check (${reason}): window is blank -> reloading`);
      win.webContents.reload();
    } else {
      log(`paint check (${reason}): content present -> forcing repaint`);
      win.webContents.invalidate();
    }
  } catch (error) {
    log(`paint check (${reason}): failed (${error.message}) -> reloading`);
    win.webContents.reload();
  }
}

function recover(reason) {
  if (recovering) return;
  recovering = true;
  log("recover:", reason);
  setTimeout(() => {
    checkPaint(reason).finally(() => {
      recovering = false;
    });
  }, 900);
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    show: false,
    backgroundColor: "#0a0a0a",
    title: "Flash SQL Studio",
    icon: path.join(__dirname, "icon.png"),
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a0a",
      symbolColor: "#d4d4d4",
      height: 36,
    },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.on("unresponsive", () => recover("window unresponsive"));
  mainWindow.on("responsive", () => log("window responsive again"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-finish-load", () => log("page loaded"));
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log("render-process-gone:", details.reason, String(details.exitCode));
    recover(`renderer gone (${details.reason})`);
  });
  mainWindow.webContents.on("did-fail-load", (_event, code, description) => {
    log("did-fail-load:", code, description);
    dialog.showErrorBox("Flash SQL Studio", `Could not load the app: ${description}`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });

  mainWindow.loadURL(url);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on("child-process-gone", (_event, details) => {
    log("child-process-gone:", details.type, details.reason, String(details.exitCode));
    if (details.type === "GPU") recover(`gpu process gone (${details.reason})`);
  });

  app.whenReady().then(async () => {
    const gpuEnabled =
      typeof app.isHardwareAccelerationEnabled === "function"
        ? String(app.isHardwareAccelerationEnabled())
        : "unknown";
    log("app ready; hardware acceleration:", gpuEnabled);

    powerMonitor.on("resume", () => recover("system resume"));
    powerMonitor.on("unlock-screen", () => recover("screen unlocked"));

    try {
      baseUrl = await startServer();
    } catch (error) {
      log("server failed:", String(error));
      dialog.showErrorBox("Flash SQL Studio", `Failed to start the local server:\n\n${error}`);
      app.quit();
      return;
    }

    createWindow(baseUrl);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(baseUrl);
    });
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
