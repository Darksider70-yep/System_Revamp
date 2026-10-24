#!/usr/bin/env python3
"""
System Revamp v2.0 - OpenAPI Schema Generator CLI
=================================================
Generates the authoritative OpenAPI 3.1.0 JSON specification directly
from the FastAPI application instance without launching a network server.

Usage:
    python -m server.generate_openapi
"""

import json
from pathlib import Path
from server.main import app

def generate_openapi():
    schema = app.openapi()
    
    base_dir = Path(__file__).resolve().parents[1]
    server_data_file = base_dir / "server_data" / "openapi.json"
    docs_file = base_dir / "docs" / "openapi.json"
    
    server_data_file.parent.mkdir(parents=True, exist_ok=True)
    docs_file.parent.mkdir(parents=True, exist_ok=True)
    
    formatted_json = json.dumps(schema, indent=2)
    server_data_file.write_text(formatted_json, encoding="utf-8")
    docs_file.write_text(formatted_json, encoding="utf-8")
    
    print(f"[OK] OpenAPI schema generated successfully:")
    print(f"  - {server_data_file}")
    print(f"  - {docs_file}")
    print(f"  - Total paths exposed: {len(schema.get('paths', {}))}")

if __name__ == "__main__":
    generate_openapi()
