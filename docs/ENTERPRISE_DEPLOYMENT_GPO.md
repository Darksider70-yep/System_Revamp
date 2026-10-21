# System Revamp v2.0 — Enterprise Fleet Deployment (GPO, Intune, SCCM, Ansible)

<p align="center">
  <strong>Bulk Enterprise Deployment Guide for Microsoft Active Directory, Intune, System Center Configuration Manager, and Linux Automation</strong>
</p>

---

## 1. Overview of Automated Agent Provisioning

Manually enrolling hundreds or thousands of computer lab machines is impractical. System Revamp v2.0 provides **unattended, silent agent provisioning** designed for standard enterprise management tools:

1. **Active Directory Group Policy (GPO)**: Native, zero-cost deployment via Windows Computer Startup Scripts.
2. **Microsoft Intune (Endpoint Manager)**: Cloud-native MDM deployment via Win32 App packaging or PowerShell Device Scripts.
3. **Microsoft SCCM / MECM**: Silent application packages for large enterprise fleets.
4. **Linux Ansible / Puppet / Salt**: Headless deployment across Linux lab workstations.

---

## 2. Active Directory Group Policy (GPO) Deployment

### 2.1 Preparing Deployment Files
1. Create a network share accessible by all domain computers with read permissions (e.g., `\\dc01.domain.local\SYSVOL\domain.local\scripts\SystemRevamp`).
2. Copy the following files from the repository into this share:
   - `installer/windows/install-agent.ps1`
   - Complete `agent/` folder
   - `requirements.txt` (or pre-bundled Python wheel dependencies if endpoints lack internet)

### 2.2 Writing the Silent Startup Wrapper Script
Create `Deploy-SystemRevamp.ps1` in the network share:

```powershell
<#
.SYNOPSIS
    Silent Computer Startup Script for System Revamp Endpoint Agent.
    Runs in SYSTEM context during machine boot.
#>
param (
    [string]$ServerUrl = "https://fleet.university.edu",
    [string]$EnrollToken = "sr_enroll_your_token_here"
)

$InstallDir = "$env:ProgramData\SystemRevamp"
$ConfigFile = "$InstallDir\agent_config.json"

# Check if agent is already enrolled
if (Test-Path $ConfigFile) {
    # Check if agent daemon process is active
    $Process = Get-Process -Name python* -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*agent.main*" }
    if ($Process) {
        Write-Host "System Revamp Agent is already enrolled and active. Exiting."
        exit 0
    }
}

Write-Host "Installing System Revamp Agent..."
$ScriptPath = "\\dc01.domain.local\SYSVOL\domain.local\scripts\SystemRevamp\install-agent.ps1"

& powershell.exe -ExecutionPolicy Bypass -NoProfile -NonInteractive -File $ScriptPath `
    -ServerUrl $ServerUrl `
    -EnrollToken $EnrollToken `
    -Silent $true
```

### 2.3 Linking GPO to Target Computer Lab OUs
1. Open **Group Policy Management** (`gpmc.msc`).
2. Right-click the target Computer Lab Organizational Unit (e.g., `Domain.local` $\rightarrow$ `University Computers` $\rightarrow$ `Engineering Labs` $\rightarrow$ `Lab 204`) $\rightarrow$ **Create a GPO in this domain, and Link it here...**.
3. Name the GPO: `SystemRevamp-Agent-Deployment`.
4. Right-click the newly created GPO $\rightarrow$ **Edit...**.
5. Navigate to:
   **Computer Configuration** $\rightarrow$ **Policies** $\rightarrow$ **Windows Settings** $\rightarrow$ **Scripts (Startup/Shutdown)** $\rightarrow$ Double-click **Startup**.
6. In the **Startup Properties** dialog, click **Add...**:
   - **Script Name**: `powershell.exe`
   - **Script Parameters**: `-ExecutionPolicy Bypass -File "\\dc01.domain.local\SYSVOL\domain.local\scripts\SystemRevamp\Deploy-SystemRevamp.ps1" -ServerUrl "https://fleet.university.edu" -EnrollToken "sr_enroll_..."`
7. Click **OK** and apply the policy.
8. Upon next computer reboot or `gpupdate /force`, the workstation will automatically enroll and appear in the Admin Console.

---

## 3. Microsoft Intune (Endpoint Manager) Deployment

### 3.1 PowerShell Device Script Deployment
1. Log in to the [Microsoft Intune Admin Center](https://intune.microsoft.com/).
2. Navigate to **Devices** $\rightarrow$ **Scripts and remediations** $\rightarrow$ **Platform scripts** $\rightarrow$ **Add** $\rightarrow$ **Windows 10 and later**.
3. Fill in Basics:
   - **Name**: `Deploy System Revamp Agent`
   - **Description**: `Enrolls endpoint into System Revamp Fleet Platform`
4. Script settings:
   - **Script file**: Upload `installer/windows/install-agent.ps1`.
   - **Run this script using the logged on credentials**: `No` (Must run as Local SYSTEM).
   - **Enforce script signature check**: `No`.
   - **Run script in 64-bit PowerShell Host**: `Yes`.
5. Assignments:
   - Assign to target device groups (e.g., `All Computer Lab Devices`).

---

## 4. Linux Bulk Deployment via Ansible

For Linux-based computer clusters and research labs, deploy the agent using the following Ansible playbook:

```yaml
---
# deploy_system_revamp.yml
- name: Deploy System Revamp Fleet Agent
  hosts: linux_labs
  become: yes
  vars:
    server_url: "https://fleet.university.edu"
    enroll_token: "sr_enroll_your_token_here"
    install_dir: "/opt/system-revamp-agent"

  tasks:
    - name: Ensure Python 3 and prerequisites are installed
      apt:
        name:
          - python3
          - python3-venv
          - python3-pip
          - pciutils
        state: present
        update_cache: yes

    - name: Create agent installation directory
      file:
        path: "{{ install_dir }}"
        state: directory
        mode: '0755'

    - name: Copy agent source code
      copy:
        src: ../agent/
        dest: "{{ install_dir }}/agent/"
        mode: '0755'

    - name: Copy requirements.txt
      copy:
        src: ../requirements.txt
        dest: "{{ install_dir }}/requirements.txt"

    - name: Create Python virtual environment & install requirements
      pip:
        requirements: "{{ install_dir }}/requirements.txt"
        virtualenv: "{{ install_dir }}/venv"
        virtualenv_command: "python3 -m venv"

    - name: Enroll agent with Central Fleet Server
      command: >
        {{ install_dir }}/venv/bin/python -m agent.main enroll
        --server "{{ server_url }}"
        --token "{{ enroll_token }}"
      args:
        creates: "{{ install_dir }}/agent_config.json"

    - name: Deploy systemd service unit
      copy:
        dest: /etc/systemd/system/system-revamp-agent.service
        content: |
          [Unit]
          Description=System Revamp Fleet Endpoint Daemon
          After=network-online.target
          Wants=network-online.target

          [Service]
          Type=simple
          WorkingDirectory={{ install_dir }}
          ExecStart={{ install_dir }}/venv/bin/python -m agent.main run-daemon
          Restart=always
          RestartSec=15
          StandardOutput=journal
          StandardError=journal

          [Install]
          WantedBy=multi-user.target
        mode: '0644'

    - name: Enable and start system-revamp-agent service
      systemd:
        name: system-revamp-agent
        enabled: yes
        state: started
        daemon_reload: yes
```

Run the playbook:
```bash
ansible-playbook -i hosts.ini deploy_system_revamp.yml
```
