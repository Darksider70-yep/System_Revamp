# System Revamp - Offline Sync & Automated Remediation

System Revamp includes built-in enterprise capabilities for managing air-gapped systems and running one-click automated software/driver remediation.

---

## 1. Offline Environment Synchronization

Air-gapped or secured networks often lack direct internet connectivity to query package registries or vendor repositories. System Revamp addresses this with an integrated snapshot and offline packaging engine.

### Package Modes

1. **Full Package (`mode=full`)**:
   - Bundles the complete system state snapshot.
   - Files included in `offline_update_package.zip`:
     - `manifest.json`: Metadata including timestamp, package mode, and total application count.
     - `installed_apps.json`: Complete snapshot of all installed software.
     - `latest_versions.json`: Reference database of verified current software versions.
     - `missing_drivers.json`: Snapshot of missing and critical driver definitions.
2. **Delta Package (`mode=delta`)**:
   - Computes differences between the current scan and the previous snapshot stored at `backend/cache/offline_packages/last_scan_snapshot.json`.
   - Files included in `offline_delta_package.zip`:
     - `manifest.json`: Summary of total changed applications.
     - `delta_apps.json`: Structured list of `added`, `removed`, and `changed` applications (with previous vs current versions).
     - `current_apps.json`: Baseline state.
     - `latest_versions.json` & `missing_drivers.json`.

---

## 2. Automated PowerShell Remediation Generator

The **Export Remediation Script** feature generates an executable PowerShell script (`system_revamp_remediation.ps1`) tailored specifically to the system's current vulnerabilities and missing drivers.

### How it Works:
1. The frontend filters installed software with status `Update Available`.
2. The backend (`POST /generate-remediation-script`) resolves human-readable application names to canonical **Windows Package Manager (Winget)** identifiers:
   - `Node.js` $\rightarrow$ `OpenJS.NodeJS`
   - `Python` $\rightarrow$ `Python.Python.3`
   - `Google Chrome` $\rightarrow$ `Google.Chrome`
   - `GitHub Desktop` $\rightarrow$ `GitHub.GitHubDesktop`
   - `Git` $\rightarrow$ `Git.Git`
   - `Dropbox` $\rightarrow$ `Dropbox.Dropbox`
   - `DBeaver` $\rightarrow$ `DBeaver.DBeaver`
   - `Epic Games Launcher` $\rightarrow$ `EpicGames.EpicGamesLauncher`
3. Generates silent, unattended upgrade commands:
   ```powershell
   winget upgrade --id "Google.Chrome" --exact --accept-package-agreements --accept-source-agreements --disable-interactivity
   ```
4. Appends automated Windows Update driver scan routines using the Windows Update Client (`UsoClient`):
   ```powershell
   UsoClient StartScan
   UsoClient StartDownload
   UsoClient StartInstall
   ```
5. Lists specific unresolved `.sys` driver files for manual administrator validation.
