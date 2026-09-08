# System Revamp - Driver Intelligence & Protection Engine

Comprehensive guide to hardware driver detection, risk scoring models, executable resolution, and malware protection analysis.

---

## 1. Driver Risk Intelligence Engine

The Driver Risk Intelligence Engine scans system drivers, checks hardware health, and identifies missing critical components.

### 1.1 Detection Strategy
- **Primary Method**: Queries WMI (`win32_pnpsigneddriver`) via `wmic path win32_pnpsigneddriver get infname /format:csv`.
- **Modern Windows Fallback**: Uses PowerShell CIM (`Get-CimInstance Win32_PnPSignedDriver | Select-Object -ExpandProperty InfName`).
- Normalizes INF driver file base names into a fast lookup table.

### 1.2 Risk Scoring & Classification

Missing drivers are categorized based on their device class impact:

| Device Category | Impact Level | Risk Score | Example Drivers |
|---|---|---|---|
| **Storage / Disk / AHCI / CPU** | `Critical` | **95** | `iaStorA`, `disk`, `storahci`, `intelppm` |
| **Network (NIC / Wi-Fi / Bluetooth)** | `High` | **75** | `rt640x64`, `netwtw06`, `e1d65x64`, `bthusb` |
| **GPU / Audio / USB Controller** | `Medium` | **50** | `nvlddmkm`, `ati2mtag`, `audiodg`, `usbport` |
| **Peripherals (Mouse / Keyboard)** | `Low` | **25** | `kbdhid`, `mouhid`, `hidusb` |

### 1.3 Driver Download & Installation Workflow
When the user triggers **Download Missing Drivers**:
1. Initiates background Windows Update scan (`UsoClient StartScan`).
2. Triggers download for matched hardware drivers (`UsoClient StartDownload`).
3. Starts driver installation cycle (`UsoClient StartInstall`).
4. Forces device enumeration rescanning (`pnputil /scan-devices`).

---

## 2. Software Protection & Threat Engine

The Software Protection Engine investigates installed applications to detect potentially malicious software, unverified binaries, and security anomalies.

### 2.1 Binary Path Resolution
Applications listed in the Windows Registry do not always declare their main binary path explicitly. The engine executes a multi-stage heuristic search:
1. **Registry DisplayIcon**: Extracts and sanitizes the executable path from `DisplayIcon`.
2. **UninstallString**: Parses quoted or bare executable paths from `UninstallString`.
3. **InstallLocation**: Inspects the installation directory for candidate `.exe` binaries.
4. **Known Executable Catalog**: Matches known applications (e.g. Chrome, Git, DBeaver) and queries `where <exe>`.

### 2.2 Dual-Layer Threat Verification

```
                      +-----------------------------+
                      |   Target Application Binary |
                      +-----------------------------+
                                     |
                             Compute SHA256 Hash
                                     |
                                     v
                       Is VT_API_KEY Configured?
                                    / \
                            Yes    /   \   No
                                  /     \
                                 v       v
         +--------------------------+   +------------------------------+
         |  VirusTotal API v3 Query |   | Authenticode Signature Check |
         |  - Malicious engines     |   | (PowerShell API)             |
         |  - Suspicious count      |   | - Valid                      |
         |  - Harmless / Undetected |   | - NotSigned                  |
         +--------------------------+   | - HashMismatch               |
                                        +------------------------------+
```

1. **VirusTotal Live Reputation (Layer 1)**:
   - Queries `https://www.virustotal.com/api/v3/files/{sha256}`.
   - Evaluates engine reports:
     - `malicious > 0` $\rightarrow$ `Malicious` (Threat Score 90)
     - `suspicious > 0` $\rightarrow$ `Suspicious` (Threat Score 70)
     - `harmless + undetected > 0` $\rightarrow$ `Clean` (Threat Score 10)
     - Not found in VirusTotal $\rightarrow$ `Unknown` (Threat Score 30)
2. **Local Authenticode Signature Fallback (Layer 2)**:
   - When no VirusTotal API key is present, queries PowerShell `Get-AuthenticodeSignature`.
   - `Valid` signature $\rightarrow$ Marked as `Clean`.
   - `NotSigned` or `HashMismatch` $\rightarrow$ Marked as `Suspicious`.
