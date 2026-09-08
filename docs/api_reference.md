# System Revamp - API Reference

Complete documentation of all REST endpoints and real-time streaming interfaces across the System Revamp microservices.

---

## 1. Scanner Service (`http://127.0.0.1:8000`)

### `GET /`
- **Description**: Service health and heartbeat check.
- **Response**:
  ```json
  {
    "message": "Scanner Service running 🚀"
  }
  ```

### `GET /scan`
- **Description**: Enumerates installed applications on the host OS across Windows, Linux, and macOS.
- **Response**:
  ```json
  {
    "apps": [
      { "name": "Google Chrome", "version": "128.0.6613.85" },
      { "name": "Python 3.13.3", "version": "3.13.3" },
      { "name": "Node.js", "version": "22.11.0" }
    ]
  }
  ```

### `GET /generate-offline-package`
- **Query Parameters**:
  - `mode` *(string, optional, default: `"full"`)*: Either `"full"` or `"delta"`.
- **Description**: Bundles application inventory, version catalog, missing driver status, and differential delta data into a ZIP archive.
- **Response**: Streamed `application/zip` download (`offline_update_package.zip` or `offline_delta_package.zip`).

### `POST /generate-remediation-script`
- **Description**: Generates an executable PowerShell remediation script for updating outdated software via Winget and checking drivers.
- **Request Body**:
  ```json
  {
    "apps": ["Python 3", "Google Chrome"],
    "drivers": ["nvlddmkm", "rt640x64"]
  }
  ```
- **Response**: Streamed `text/plain` file download (`system_revamp_remediation.ps1`).

### `GET /simulate-attack/{app_name}`
- **Description**: Server-Sent Events (SSE) stream simulating a penetration test / security assessment on the targeted application.
- **Response Stream Event Types**:
  - `data: {"timestamp": "...", "step": 1, "progress": 10, "level": "INFO", "message": "Reconnaissance started..."}`
  - `event: summary` $\rightarrow$ `data: {"app": "...", "status": "Simulation finished", "issues_found": ["CVE-2023-12345"]}`
  - `event: end` $\rightarrow$ `data: {"done": true}`

---

## 2. Driver Risk Service (`http://127.0.0.1:8001`)

### `GET /drivers`
- **Description**: Scans installed Windows device drivers and cross-references them against critical system driver profiles.
- **Response**:
  ```json
  {
    "missingDrivers": [
      {
        "Driver Name": "nvlddmkm",
        "Device": "NVIDIA GPU",
        "Impact": "Medium",
        "RiskScore": 50,
        "Status": "Missing"
      }
    ],
    "installedDrivers": [
      {
        "Driver Name": "iaStorA",
        "Device": "Unknown",
        "Impact": "Low",
        "RiskScore": 0,
        "Status": "Installed"
      }
    ],
    "riskSummary": {
      "critical": 0,
      "high": 1,
      "medium": 2,
      "low": 0
    }
  }
  ```

### `POST /drivers/download`
- **Description**: Executes automated driver update sequence via `UsoClient` and `pnputil`.
- **Request Body**:
  ```json
  {
    "drivers": ["nvlddmkm", "rt640x64"]
  }
  ```
- **Response**:
  ```json
  {
    "requestedDrivers": ["nvlddmkm", "rt640x64"],
    "steps": [
      {
        "step": "Start driver scan",
        "command": "UsoClient StartScan",
        "returnCode": 0,
        "stdout": "",
        "stderr": ""
      }
    ],
    "success": true,
    "message": "Driver update flow executed."
  }
  ```

---

## 3. Version Intelligence Service (`http://127.0.0.1:8002`)

### `GET /`
- **Description**: Service health check.
- **Response**:
  ```json
  {
    "message": "Version Intelligence Service running 🚀"
  }
  ```

### `POST /check-versions`
- **Description**: Compares current installed software versions against live package registries (Winget, PyPI) and cached database to evaluate update status and version drift risks.
- **Request Body**:
  ```json
  {
    "Node.js": "20.10.0",
    "Python 3": "3.11.0",
    "Google Chrome": "128.0.6613.85"
  }
  ```
- **Response**:
  ```json
  {
    "apps": [
      {
        "name": "Node.js",
        "current": "20.10.0",
        "latest": "22.11.0",
        "status": "Update Available",
        "riskLevel": "High"
      },
      {
        "name": "Google Chrome",
        "current": "128.0.6613.85",
        "latest": "128.0.6613.85",
        "status": "Up-to-date",
        "riskLevel": "Low"
      }
    ]
  }
  ```

---

## 4. Software Protection Service (`http://127.0.0.1:8003`)

### `GET /`
- **Description**: Health check.
- **Response**:
  ```json
  {
    "message": "Software Protection Service running"
  }
  ```

### `GET /protection/debug-key`
- **Description**: Returns debug information regarding active VirusTotal API key configuration.
- **Response**:
  ```json
  {
    "envKeyLen": 64,
    "fileKeyLen": 0,
    "fallbackPath": "C:\\Users\\<User>\\.system_revamp_vt_api_key"
  }
  ```

### `POST /protection/scan`
- **Description**: Resolves binaries for installed applications on disk, calculates SHA256 hashes, performs VirusTotal reputation queries or Authenticode signature verifications.
- **Request Body**:
  ```json
  {
    "apps": [
      { "name": "Google Chrome", "version": "128.0.6613.85" }
    ],
    "maxApps": 20
  }
  ```
- **Response**:
  ```json
  {
    "results": [
      {
        "name": "Google Chrome",
        "version": "128.0.6613.85",
        "path": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "sha256": "4b5c7e3f89012a...",
        "threatStatus": "Clean",
        "threatScore": 10,
        "summary": "Engines: malicious=0, suspicious=0, harmless=72, undetected=0",
        "source": "VirusTotal",
        "vtLink": "https://www.virustotal.com/gui/file/4b5c7e3f89012a..."
      }
    ],
    "summary": {
      "malicious": 0,
      "suspicious": 0,
      "clean": 1,
      "unknown": 0,
      "error": 0
    },
    "scannedCount": 1,
    "note": "Set VT_API_KEY environment variable to enable live VirusTotal reputation."
  }
  ```
