const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("flashsql", {
  isDesktop: true,
  platform: process.platform,
});

function markDesktopTitlebar() {
  document.documentElement.classList.add("desktop-titlebar");
}

if (document.documentElement) {
  markDesktopTitlebar();
} else {
  document.addEventListener("DOMContentLoaded", markDesktopTitlebar);
}
