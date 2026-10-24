<#
.SYNOPSIS
    System Revamp v2.0 — Production SQLite Hot Backup Script (Windows PowerShell)
    Executes atomic non-blocking VACUUM INTO backup without stopping the fleet server.
#>

param (
    [string]$DbPath = "$PSScriptRoot\..\server_data\fleet.db",
    [string]$BackupDir = "$PSScriptRoot\..\server_data\backups"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$TargetFile = Join-Path $BackupDir "fleet_$Timestamp.db"

Write-Host "[+] Executing atomic SQLite hot backup: $TargetFile" -ForegroundColor Cyan

$PythonScript = @"
import sqlite3
con = sqlite3.connect(r'$DbPath')
con.execute(r"VACUUM INTO '$TargetFile'")
con.close()
"@

python -c $PythonScript

if (Test-Path $TargetFile) {
    Write-Host "[OK] Hot backup created successfully: $TargetFile" -ForegroundColor Green
} else {
    Write-Error "Backup creation failed: $TargetFile not found."
}
