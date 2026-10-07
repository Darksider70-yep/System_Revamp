<#
.SYNOPSIS
    Starts System Revamp Central Server and Admin Dashboard with port and LAN IP checks.
.DESCRIPTION
    Verifies port 8000 (Backend API) and port 3000 (React Admin Console), prints the LAN IP,
    and launches background processes with live logging.
#>

[CmdletBinding()]
param (
    [int]$ServerPort = 8000,
    [int]$DashboardPort = 3000
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "⚡ System Revamp v2.0 — Demo Server & Console Launcher" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# 1. Detect Local LAN IP Address
$localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notlike "*Loopback*" -and 
    $_.InterfaceAlias -notlike "*vEthernet*" -and 
    $_.IPAddress -notlike "169.254*" 
} | Select-Object -First 1).IPAddress

if (-not $localIp) {
    $localIp = "127.0.0.1"
}

# 2. Check Port Availability
function Test-PortOccupied([int]$port) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    return ($null -ne $conn)
}

if (Test-PortOccupied -port $ServerPort) {
    Write-Host "❌ Port $ServerPort is already in use by another process." -ForegroundColor Red
    Write-Host "   Run: Stop-Process -Id (Get-NetTCPConnection -LocalPort $ServerPort).OwningProcess -Force" -ForegroundColor Yellow
    exit 1
}

if (Test-PortOccupied -port $DashboardPort) {
    Write-Host "❌ Port $DashboardPort is already in use by another process." -ForegroundColor Red
    Write-Host "   Run: Stop-Process -Id (Get-NetTCPConnection -LocalPort $DashboardPort).OwningProcess -Force" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Ports $ServerPort and $DashboardPort are available." -ForegroundColor Green
Write-Host "🌐 Detected Server LAN IP: $localIp" -ForegroundColor Yellow
Write-Host "   • Central Server URL:   http://${localIp}:${ServerPort}" -ForegroundColor Cyan
Write-Host "   • Admin Dashboard URL:  http://localhost:${DashboardPort}" -ForegroundColor Cyan
Write-Host "   • Default Credentials:  admin@systemrevamp.local / Admin@123456`n" -ForegroundColor Gray

# 3. Seed Demo Topology Idempotently
Write-Host "🌱 Seeding demo hierarchy (Org, Sites, Labs)..." -ForegroundColor Yellow
python scripts/demo/seed_demo_org.py

# 4. Start Central Server
Write-Host "🚀 Starting Central Server on port $ServerPort..." -ForegroundColor Green
$serverJob = Start-Process -FilePath "python" -ArgumentList "-m server.main" -PassThru -NoNewWindow

Start-Sleep -Seconds 2

# 5. Start Dashboard
Write-Host "🖥️ Starting Admin Dashboard on port $DashboardPort..." -ForegroundColor Green
Push-Location "frontend"
$dashboardJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm start" -PassThru -NoNewWindow
Pop-Location

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "🎉 System Revamp Server & Console are LIVE!" -ForegroundColor Green
Write-Host "   Open your browser at: http://localhost:3000" -ForegroundColor White
Write-Host "   Agent machines should enroll pointing to: http://${localIp}:${ServerPort}" -ForegroundColor Yellow
Write-Host "========================================================`n" -ForegroundColor Cyan
