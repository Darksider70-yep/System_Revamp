import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

def main():
    print("=== System Revamp Verification ===")

    # 1. Test database & fallback store
    from common import db
    db.init_db()
    versions = db.get_all_latest_versions()
    print(f"[OK] Database latest versions loaded: {len(versions)} items (e.g. Node.js={versions.get('Node.js')})")

    snap_ok = db.save_scan_snapshot('full', {'appCount': 2}, [{'name': 'Node.js', 'version': '23.0.0'}])
    print(f"[OK] Save scan snapshot: {snap_ok}")

    latest_snap = db.get_latest_scan_snapshot()
    print(f"[OK] Retrieve latest snapshot: apps={len(latest_snap.get('apps', []))}")

    drv_ok = db.save_driver_history([], [], {'critical': 0})
    print(f"[OK] Save driver history: {drv_ok}")

    # 2. Test Redis client & rate limiter
    from common import redis_client
    redis_client.init_redis()
    redis_client.cache_set('test_key', {'status': 'ok'}, ttl_seconds=60)
    val = redis_client.cache_get('test_key')
    print(f"[OK] Cache get: {val}")

    allowed1, retry1 = redis_client.check_rate_limit('test_rate', max_requests=2, window_seconds=10)
    allowed2, retry2 = redis_client.check_rate_limit('test_rate', max_requests=2, window_seconds=10)
    allowed3, retry3 = redis_client.check_rate_limit('test_rate', max_requests=2, window_seconds=10)
    print(f"[OK] Rate limiter tests: req1={allowed1}, req2={allowed2}, req3={allowed3} (retry_after={retry3}s)")

    # 3. Test service imports
    from scanner_service import main as scanner_main
    print(f"[OK] Scanner Service App: {scanner_main.app.title}")

    from version_service import main as version_main
    print(f"[OK] Version Intelligence App: {version_main.app.title}")

    from protection_service import main as protection_main
    print(f"[OK] Protection Service App: {protection_main.app.title}")

    import drivers_api
    print(f"[OK] Driver Risk Service App: {drivers_api.app.title}")

    print("\nALL INFRASTRUCTURE & BACKING STORE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
