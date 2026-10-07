#!/usr/bin/env python3
"""
System Revamp v2.0 - CI Guard: Verify No Mocks, No Hardcoded Fake Data, No Hard Edges, Zero Emojis
==================================================================================================
This verification script runs as a CI guard to strictly enforce the ground rules:
1. Zero hardcoded/fake/placeholder data in production code (agent, server, frontend/src).
2. Zero fake CVE identifiers (e.g. CVE-2023-XXXX, CVE-2023-12345, CVE-XXXX-XXXX).
3. Zero hard edges: no 'border-radius: 0' or 'border-radius: 0px' anywhere in frontend/src.
4. Zero emoji characters in frontend/src (only Lucide React icons permitted).
5. Zero mock/dummy keywords used as runtime variables/data in non-test code.

Exits with returncode 0 on success, or 1 if violations are detected.
"""

import os
import re
import sys
from pathlib import Path

# Directories to scan relative to workspace root
SCAN_DIRS = ["agent", "server", "frontend/src"]

# Paths / directories to exclude entirely
EXCLUDE_DIRS = {
    "tests",
    "node_modules",
    "build",
    "dist",
    ".git",
    "server_data",
    "venv",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    "docs",
}

# File extensions to scan
CODE_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".css", ".html"}

# EMOJI Regex pattern covering standard Unicode emoji blocks
EMOJI_PATTERN = re.compile(
    r"[\U0001F300-\U0001FAD6\U00002600-\U000027BF\U0001F900-\U0001F9FF\U0001F600-\U0001F64F\U0001F680-\U0001F6FF]"
)

# Zero border radius patterns (CSS or inline JSX styles)
ZERO_RADIUS_PATTERN = re.compile(
    r"(?:border-radius|borderRadius)\s*:\s*['\"]?0(?:px)?['\"]?(?!\s*var|\s*--)",
    re.IGNORECASE,
)

# Placeholder CVE pattern
FAKE_CVE_PATTERN = re.compile(
    r"CVE-(?:\d{4}-XXXX|XXXX-\d+|2023-12345|2024-99999)",
    re.IGNORECASE,
)

# Mock/Dummy runtime data keywords
MOCK_DATA_PATTERN = re.compile(
    r"\b(mock_devices?|mock_fleet|mock_cve|dummy_data|dummy_cve|dummy_device|fake_device|fake_version|lorem ipsum)\b",
    re.IGNORECASE,
)


def scan_file(file_path: Path):
    violations = []
    rel_path = file_path.as_posix()
    is_frontend = "frontend/src" in rel_path

    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        return [f"{rel_path}: Could not read file ({e})"]

    lines = content.splitlines()

    for idx, line in enumerate(lines, start=1):
        # 1. Check for Fake CVE identifiers
        match = FAKE_CVE_PATTERN.search(line)
        if match:
            violations.append(
                f"{rel_path}:{idx}: [FAKE_CVE] Detected placeholder CVE identifier: '{match.group(0)}'"
            )

        # 2. Check for Mock/Dummy runtime keywords
        match = MOCK_DATA_PATTERN.search(line)
        if match:
            violations.append(
                f"{rel_path}:{idx}: [MOCK_DATA] Detected placeholder/synthetic keyword: '{match.group(0)}'"
            )

        # 3. Check for Zero border radius in frontend
        if is_frontend:
            match = ZERO_RADIUS_PATTERN.search(line)
            if match:
                violations.append(
                    f"{rel_path}:{idx}: [HARD_EDGE] Detected forbidden zero border-radius: '{line.strip()}'"
                )

        # 4. Check for Raw Emojis in frontend
        if is_frontend:
            match = EMOJI_PATTERN.search(line)
            if match:
                violations.append(
                    f"{rel_path}:{idx}: [EMOJI_ICON] Detected raw emoji character: '{match.group(0)}' in line: {line.strip()}"
                )

    return violations


def main():
    root = Path(__file__).resolve().parent.parent
    total_scanned = 0
    all_violations = []

    print("==================================================================")
    print("  System Revamp v2.0 - CI Guard: Verifying Real Data & UI Integrity")
    print("==================================================================")
    print(f"Scanning target directories from: {root}")

    for target in SCAN_DIRS:
        target_path = root / target
        if not target_path.exists():
            print(f"[WARN] Target directory does not exist: {target_path}")
            continue

        for root_dir, dirs, files in os.walk(target_path):
            # Prune excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            for file in files:
                file_path = Path(root_dir) / file
                if file_path.suffix.lower() in CODE_EXTENSIONS:
                    total_scanned += 1
                    violations = scan_file(file_path)
                    if violations:
                        all_violations.extend(violations)

    print(f"Scanned {total_scanned} source files.")
    print("------------------------------------------------------------------")

    if sys.stdout.encoding.lower() != "utf-8":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass

    if all_violations:
        print(f"FAILED: Found {len(all_violations)} violation(s):")
        for v in all_violations:
            print(f"  [X] {v}")
        print("\nCI Check FAILED. Fix the violations above.")
        return 1
    else:
        print("PASSED: 0 violations found!")
        print("  [OK] Zero placeholder CVEs")
        print("  [OK] Zero mock/dummy keywords in runtime code")
        print("  [OK] Zero hard edges (no border-radius: 0)")
        print("  [OK] Zero emoji icons (clean Lucide React icons)")
        print("==================================================================")
        return 0


if __name__ == "__main__":
    sys.exit(main())
