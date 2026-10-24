#!/usr/bin/env python3
"""
System Revamp v2.0 - Cryptographic Secret Rotation Utility
==========================================================
Generates 256-bit cryptographically secure keys and rotates
JWT_SECRET_KEY and/or DEVICE_SIGNING_KEY with 0600 file permissions.

Usage:
    python scripts/rotate_secrets.py [--target jwt|device|all]
"""

import sys
import os
import secrets
import argparse
from pathlib import Path

def rotate_secrets(target: str = "all"):
    base_dir = Path(__file__).resolve().parents[1]
    server_data_dir = base_dir / "server_data"
    env_file = base_dir / ".env"
    server_data_dir.mkdir(parents=True, exist_ok=True)

    rotated = []

    if target in ("jwt", "all"):
        new_jwt = secrets.token_hex(32)
        jwt_file = server_data_dir / ".jwt_secret"
        jwt_file.write_text(new_jwt, encoding="utf-8")
        try:
            os.chmod(jwt_file, 0o600)
        except Exception:
            pass
        rotated.append(("SECRET_KEY (JWT)", new_jwt[:8] + "..." + new_jwt[-8:]))

    if target in ("device", "all"):
        new_dsk = secrets.token_hex(32)
        dsk_file = server_data_dir / ".device_signing_key"
        dsk_file.write_text(new_dsk, encoding="utf-8")
        try:
            os.chmod(dsk_file, 0o600)
        except Exception:
            pass
        rotated.append(("DEVICE_SIGNING_KEY", new_dsk[:8] + "..." + new_dsk[-8:]))

    print("==========================================================")
    print("   [OK] System Revamp Cryptographic Key Rotation Complete")
    print("==========================================================")
    for name, masked in rotated:
        print(f"  - {name:<22}: {masked} (256-bit entropy)")
    print("\nNext step: Restart the central server service to apply new keys.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rotate System Revamp cryptographic keys")
    parser.add_argument(
        "--target",
        choices=["jwt", "device", "all"],
        default="all",
        help="Secret to rotate (default: all)"
    )
    args = parser.parse_args()
    rotate_secrets(args.target)
