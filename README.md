# Flash SQL Studio

A multi-database SQL workspace for **PostgreSQL**, **MySQL / MariaDB**, **SQL Server** and **SQLite** — shipped as a web app and as a Windows desktop app.

Built with Next.js 16 (App Router, Turbopack) and packaged with Electron.

[**Download for Windows**](https://github.com/zaisuf/-FlashSQL-Admin/releases/latest) · [All releases](https://github.com/zaisuf/-FlashSQL-Admin/releases)

---

## Download & install

Grab the latest installer from the [releases page](https://github.com/zaisuf/-FlashSQL-Admin/releases/latest):

| Build | File | Notes |
| --- | --- | --- |
| Installer (recommended) | `FlashSQLStudio-<version>-win-x64.exe` | Per-user install, you choose the folder |
| Portable | `FlashSQLStudio-<version>-win-x64-portable.exe` | Runs directly, nothing installed |

Direct download links are versioned, e.g. for **0.1.0**:

```
https://github.com/zaisuf/-FlashSQL-Admin/releases/download/v0.1.0/FlashSQLStudio-0.1.0-win-x64.exe
https://github.com/zaisuf/-FlashSQL-Admin/releases/download/v0.1.0/FlashSQLStudio-0.1.0-win-x64-portable.exe
```

Use the releases page for a "latest version" button, since the file names carry the version number.

> **Windows SmartScreen:** the app is currently **not code-signed**, so the first launch shows
> *"Windows protected your PC → Unknown publisher"*. Click **More info → Run anyway** to continue.
> This is expected. Each release lists the SHA-256 checksums so you can verify the download first.

Requirements: Windows 10 or later, x64.

---

## Features

- **Database explorer** — browse databases, schemas and tables, with live filtering
- **SQL editor** — table/column autocomplete, multi-statement runs, run-selection, cancel
- **Data grid** — server-side search, sorting and pagination over large tables
- **Row inspector** — tabbed view of a single row, with inline cell editing
- **Sessions** — multiple simultaneous connections as tabs, persisted and restorable after a restart
- **Query log** — per-statement timing, row counts and database notices
- **Multi-database** — the four engines above share one identical UI

---

## Supported databases

| Engine | Default port | Connection fields | Notes |
| --- | --- | --- | --- |
| PostgreSQL | 5432 | host, port, user, password, database, SSL | Pooled connections; works with Neon, Supabase, RDS, etc. |
| MySQL / MariaDB | 3306 | host, port, user, password, database, SSL | |
| SQL Server | 1433 | host, port, user, password, database, SSL | |
| SQLite | — | file path | Local `.db` / `.sqlite` files |

SSL is a toggle per connection. Identifiers coming from the UI are validated (`/^[A-Za-z_][A-Za-z0-9_$]*$/`) before being interpolated into SQL.

---

## Using the app

1. **Connect** — open `/connect`, pick the engine, fill in the fields and save. Connections are remembered, so reconnecting later is one click. *Test* runs a connection check before saving.
2. **Open a session** — each connection opens as a tab. Switch databases from the session header.
3. **Browse** — expand a table in the left panel to see its columns, or open it in the data grid.
4. **Query** — write SQL in the editor. `Run` executes everything (or just the selection); `Cancel` aborts a long-running statement. Results and per-statement timings appear inline.
5. **Edit** — double-click a cell in the grid, or use the row inspector tabs to edit a single row.
6. **Logs** — `/logs` shows the history of queries, timings and errors for the current session.

---

## Running from source

Requirements: **Node.js 22 or newer** (developed against 22.23.3) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` | Production web build (`.next`) |
| `npm run start` | Serve a production web build |
| `npm run desktop:dev` | Electron shell pointed at the dev server (starts `:3000` first) |
| `npm run desktop:build` | Full desktop pipeline → installers in `release/` |
| `npm run desktop:pack` | Repackage only (reuses the existing `.next-build`) |
| `npx tsc --noEmit` | Type check without emitting |

---

## Desktop build

`npm run desktop:build` runs four steps:

1. **Next production build** into `.next-build` (kept separate from the dev `.next`)
2. **Copy assets** — `static/` and `public/` into the standalone output, and drop stray `.data/` / cache / trace files
3. **Native module probe** — boots `better-sqlite3` inside a real Electron process to confirm SQLite works in the packaged app
4. **Package** — `electron-builder` produces the NSIS installer and portable exe in `release/`

Artifacts:

```
release/FlashSQLStudio-<version>-win-x64.exe            # installer
release/FlashSQLStudio-<version>-win-x64-portable.exe   # portable
release/latest.yml                                      # auto-update metadata
release/FlashSQLStudio-<version>-win-x64.exe.blockmap   # delta-update map
release/win-unpacked/                                   # unpacked app (for testing)
```

`electron-builder` is configured to copy the already-extracted Electron from `node_modules/electron/dist` (`electronDist`) and to skip native rebuilds (`npmRebuild: false`) — `better-sqlite3` v13 uses Node-API, so no per-ABI rebuild is needed.

Note: the version in the artifact names comes from `version` in `package.json`.

### macOS builds (via GitHub Actions)

A macOS app cannot be built from Windows — `dmg` creation and code signing need macOS tooling. The workflow in [`.github/workflows/build.yml`](.github/workflows/build.yml) builds it on GitHub's hosted runners instead: **macOS arm64** (Apple Silicon) on `macos-14`, producing a `.dmg` and a `.zip`. Windows installers are built locally with `npm run desktop:build`.

Trigger it by pushing a tag (`git tag v0.1.1 && git push origin v0.1.1`) or by hand from **Actions → Build macOS app → Run workflow**. Tag runs also attach the macOS artifacts to a GitHub release — add the Windows installers you built locally to the same release.

Native modules are platform-specific, so the macOS job installs its own dependencies with `npm ci` on macOS — that is what makes `better-sqlite3` match the target platform. This is why the build must run on a machine of the target OS rather than cross-compiling.

To also cover Intel Macs, add `os: macos-13` to the matrix (if that runner image is still available) rather than cross-building, for the same native-module reason. Electron targets desktop macOS only — it cannot build for iPhone or iPad.

Signing and notarization stay off until these repository secrets exist — `CSC_LINK`, `CSC_KEY_PASSWORD` (Developer ID Application certificate, base64 `.p12`) and `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. electron-builder signs and notarizes automatically once they are set, with no workflow change. Unsigned macOS builds still run, but users must approve them manually in System Settings → Privacy & Security.

---

## Configuration

Environment variables:

| Variable | Default | Applies to | Purpose |
| --- | --- | --- | --- |
| `FLASH_SQL_DATA_DIR` | `./.data` | web + desktop | Where `connections.json`, `sessions.json` and `key` live. The desktop app sets this to `%APPDATA%\flash-sql-studio`. |
| `SQLADMIN_SECRET` | — | web + desktop | If set, derives the encryption key from this value instead of storing a `key` file. |
| `PORT` / `HOSTNAME` | `3000` / `0.0.0.0` | web | Dev/production server binding. |
| `NEXT_DIST_DIR` | `.next` | build | Build output directory (the desktop build uses `.next-build`). |
| `ELECTRON_DEV` | — | desktop | `1` makes Electron load the dev server instead of the bundled app. |
| `ELECTRON_DEV_URL` | `http://localhost:3000` | desktop | Dev server URL. |
| `FLASH_SQL_DISABLE_GPU` | — | desktop | `1` disables hardware acceleration (escape hatch for GPU/rendering problems). |

---

## Where your data lives

Everything stays on your machine. Nothing is sent anywhere except to the database servers you connect to.

| Platform | Data directory |
| --- | --- |
| Desktop app | `%APPDATA%\flash-sql-studio` |
| From source | `./.data` (or `FLASH_SQL_DATA_DIR`) |

| File | Contents |
| --- | --- |
| `connections.json` | Saved connections. Passwords are encrypted with **AES-256-GCM**. |
| `sessions.json` | Open sessions, so they can be restored after a restart. |
| `key` | 32-byte random key used for the above (unless `SQLADMIN_SECRET` is set). Created with mode `0600`. |
| `main.log` | Desktop app runtime log (startup, server port, recovery events, crashes). |

Sessions are identified by the `sqla_sid` / `sqla_sids` cookies (12 hour lifetime) and kept in an in-memory `Map` on the server; the on-disk copy is what makes reconnect-after-restart work.

If you saved a connection and later change `SQLADMIN_SECRET` (or delete `key`), stored passwords can no longer be decrypted and must be re-entered.

---

## HTTP API

All endpoints are same-origin JSON, used by the UI:

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/connections` | GET, POST, DELETE | List / save / delete saved connections |
| `/api/connections/test` | POST | Test a connection without saving |
| `/api/sessions` | GET, POST, DELETE | List / open / close sessions |
| `/api/sessions/activate` | POST | Switch the active session |
| `/api/tables` | GET | Tables and schemas for a session |
| `/api/columns` | GET | Columns for a table |
| `/api/rows` | GET | Paged, sorted, filtered rows |
| `/api/query` | POST | Execute SQL (multi-statement supported) |
| `/api/update` | POST | Update a cell / row |

---

## Project structure

```
electron/           main.js (window, recovery, logging), preload.js, icon.png
scripts/            build-desktop.mjs — the packaging pipeline
build/              electron-builder icons (icon.ico, icon.png)
public/             static assets
src/app/            pages (/, /connect, /editor, /workspace, /logs) + API routes
src/components/     editor, panels (data grid, row inspector, tables), layout, ui
src/lib/db/         one driver per engine + shared interface
src/lib/            crypto, connections, sessions, api helpers
src/store/          zustand workspace store
```

---

## Releasing a new version

1. Bump `version` in `package.json` (this drives the artifact names).
2. Build: `npm run desktop:build`
3. Test the unpacked app: `release\win-unpacked\Flash SQL Studio.exe`
4. Publish a release and upload the assets. With the GitHub CLI (`gh` — install it first, or just use the release page in the browser):

```bash
gh release create v0.1.1 release/FlashSQLStudio-0.1.1-win-x64.exe \
  release/FlashSQLStudio-0.1.1-win-x64-portable.exe \
  release/latest.yml release/FlashSQLStudio-0.1.1-win-x64.exe.blockmap \
  --title "Flash SQL Studio 0.1.1" --notes "What changed…"
```

or create the release in the GitHub web UI and drag the files in.

Generate checksums to paste into the release notes:

```powershell
Get-ChildItem release -File | Where-Object { $_.Name -match '\.exe$' } |
  ForEach-Object { "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name }
```

Notes:

- The installers are **not code-signed**. Signing is configured through `electron-builder`'s `win` options if you later buy a certificate.
- `latest.yml` and the `.blockmap` are for auto-updates. They are uploaded today, but the app does not yet include `electron-updater`, so users update by downloading the new release.
- Do **not** commit installers to git — GitHub rejects files over 100 MB. Always use release assets (up to 2 GB each).

---

## Troubleshooting

**"Windows protected your PC" on launch** — expected for an unsigned build. *More info → Run anyway*. Verify the SHA-256 from the release notes if unsure.

**Black or blank window** — the desktop app tries to recover by itself: after a sleep/resume, screen unlock, GPU process crash or an unresponsive window it captures the page and reloads or invalidates the surface, logging each attempt. If it persists, launch with hardware acceleration disabled:

```powershell
$env:FLASH_SQL_DISABLE_GPU = "1"; & "Flash SQL Studio.exe"
```

**Find out what the app is doing** — read `%APPDATA%\flash-sql-studio\main.log`. It records the Electron/Node versions, the port the local server picked, page loads, recovery events and crashes.

**Port already in use** — nothing to do: the desktop app picks a free port at startup and logs it.

**SQLite connections fail in the packaged app** — the build prints a warning if the native module probe fails. `better-sqlite3` ships prebuilt Node-API binaries, so a rebuild is normally unnecessary; Postgres, MySQL and SQL Server are unaffected either way.

**A saved connection asks for the password again** — the encryption key changed (different `SQLADMIN_SECRET`, or `key` was deleted/moved). Re-enter the password.

---

## Tech stack

Next.js 16.4 · React 19 · TypeScript · Tailwind CSS v4 · zustand · react-resizable-panels · lucide-react · `pg` · `mysql2` · `mssql` · `better-sqlite3` · Electron 44 · electron-builder

---

## License

Released under the **Apache License 2.0** — see [LICENSE](LICENSE).

```
Copyright 2026 zaisuf

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

You are free to use, modify and redistribute this software, including commercially, provided you keep the copyright notices and the [NOTICE](NOTICE) file, and state any changes you make. The license also grants a patent license. "Flash SQL Studio" and the logo are not covered by the license (see section 6, Trademarks).
