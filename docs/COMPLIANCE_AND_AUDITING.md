# System Revamp v2.0 — Compliance, Auditing & Standards Mapping

<p align="center">
  <strong>Comprehensive Compliance Crosswalk for NIST SP 800-53 Rev. 5, CIS Controls v8, ISO/IEC 27001:2022, and Institutional Auditing</strong>
</p>

---

## 1. Regulatory Context & Compliance Mandate

Educational institutions, university laboratories, and enterprise IT departments must satisfy stringent security compliance frameworks to retain accreditation, research grant funding, and insurance coverage.

System Revamp v2.0 provides continuous, automated evidence collection, tamper-evident audit logging, and deterministic vulnerability analysis directly supporting major compliance standards.

---

## 2. CIS Critical Security Controls v8 Mapping

The Center for Internet Security (CIS) Controls are prioritized sets of actions that form a defense-in-depth cybersecurity foundation:

| CIS Control | Description | System Revamp Technical Implementation | System Revamp Evidence Source |
|---|---|---|---|
| **Control 1.1** | *Establish and Maintain a Detailed Enterprise Asset Inventory* | Continuous outbound agent heartbeat registering hardware specifications, CPU cores, RAM, free disk, MAC addresses, and active IP addresses. | `GET /api/v2/admin/devices` |
| **Control 1.2** | *Address Unauthorized Assets* | Unrecognized or unenrolled endpoints attempting connection are denied access; enrolled endpoints can be filtered by lab and online/offline status. | Admin Console $\rightarrow$ **Devices View** |
| **Control 2.1** | *Establish and Maintain a Software Inventory* | Agent extracts complete Windows Registry (`HKLM`/`HKCU`, `WOW6432Node`) and Linux `dpkg`/`rpm` installed packages, recording exact versions, publishers, and file paths. | `GET /api/v2/admin/fleet/software` |
| **Control 2.2** | *Ensure Authorized Software is Currently Supported* | Upstream connectors continuously cross-reference software versions against `endoflife.date` and vendor databases, flagging end-of-life and major drift. | `DeviceSoftware.risk_level` |
| **Control 2.5** | *Allowlist Authorized Software via Digital Signatures* | Local Authenticode signature checking validates whether binaries are signed by trusted Microsoft Root authorities (`Get-AuthenticodeSignature`). | `DeviceSoftware.signature_status` |
| **Control 7.1** | *Establish and Maintain a Vulnerability Management Process* | Automated risk engine calculates version drift and matches installed packages against real CVE databases (OSV.dev & NVD 2.0). | Admin Console $\rightarrow$ **Exposure Stream** |
| **Control 7.2** | *Establish and Maintain a Remediation Process* | Dispatches silent, attended or unattended upgrades via Windows Package Manager (`winget`) with mandatory dry-run simulation previews. | `POST /api/v2/commands/queue` |
| **Control 8.2** | *Collect Audit Logs* | Relational `audit_logs` table records every administrative login, token generation, command dispatch, and approval with UTC timestamps. | `GET /api/v2/admin/audit-logs` |

---

## 3. NIST SP 800-53 Rev. 5 Security Controls Mapping

| NIST Control Family | Control Identifier & Name | System Revamp Architecture Implementation |
|---|---|---|
| **Configuration Management (CM)** | **CM-8: Information System Component Inventory** | Automated hardware and software component inventory updated continuously via outbound agent telemetry. Includes PnP driver configurations and problem codes. |
| **Configuration Management (CM)** | **CM-7: Least Functionality** | Identifies and catalogs unused, deprecated, or vulnerable applications across computer labs to enable software minimization. |
| **System and Information Integrity (SI)** | **SI-2: Flaw Remediation** | Staged remediation pipeline dispatches verified patches to resolve known CVEs and outdated package versions. |
| **System and Information Integrity (SI)** | **SI-7: Software, Firmware, and Information Integrity** | Calculates SHA-256 hashes of executable binaries locally and verifies Authenticode digital signatures to detect binary tampering. |
| **Risk Assessment (RA)** | **RA-5: Vulnerability Monitoring and Scanning** | Real-time exposure assessment streaming (SSE) matches packages against National Vulnerability Database (NVD) without uploading binaries. |
| **Audit and Accountability (AU)** | **AU-2: Event Logging** | Records administrative access, command dispatch, approval status, and token lifecycle events in permanent audit tables. |
| **Identification and Authentication (IA)** | **IA-2: Identification and Authentication (Organizational Users)** | Argon2id and PBKDF2 password hashing, JWT bearer sessions, and RFC 6238 TOTP two-factor authentication. |

---

## 4. ISO/IEC 27001:2022 Annex A Mapping

| Control Clause | Control Title | System Revamp Capability |
|---|---|---|
| **A.5.9** | *Inventory of information and other associated assets* | Fleet-wide hardware spec catalog and multi-tenant lab mapping. |
| **A.8.8** | *Management of technical vulnerabilities* | Keyless integration with OSV.dev and NVD; automated exposure assessment. |
| **A.8.9** | *Configuration management* | PnP hardware problem code diagnostics (CIM) and software baseline monitoring. |
| **A.8.19** | *Installation of software on operational systems* | Controlled, allowlisted deployment of packages via cryptographic HMAC signatures. |

---

## 5. Generating Compliance Audit Evidence

### 5.1 Exporting Official RFC-4180 CSV Audit Reports
Internal or external auditors requiring spreadsheet evidence can obtain live CSV exports directly from the Central Fleet Server:

```bash
# 1. Export Fleet Compliance Summary:
curl -H "Authorization: Bearer <TOKEN>" \
  "https://fleet.university.edu/api/v2/admin/reports/export?report_type=compliance" \
  -o "SystemRevamp_Compliance_Audit_$(date +%Y%m%d).csv"

# 2. Export Complete Discovered Software Inventory:
curl -H "Authorization: Bearer <TOKEN>" \
  "https://fleet.university.edu/api/v2/admin/reports/export?report_type=software" \
  -o "SystemRevamp_Software_Inventory_$(date +%Y%m%d).csv"

# 3. Export Hardware Diagnostics & Missing Drivers:
curl -H "Authorization: Bearer <TOKEN>" \
  "https://fleet.university.edu/api/v2/admin/reports/export?report_type=drivers" \
  -o "SystemRevamp_Hardware_Drivers_$(date +%Y%m%d).csv"
```
These CSV exports contain zero placeholder data and reflect the exact live database state at the moment of request generation.
