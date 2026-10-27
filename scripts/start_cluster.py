#!/usr/bin/env python3
"""
==============================================================================
ExamSecure Enterprise - Multi-Worker Cluster Launcher
==============================================================================
Spawns and manages an active pool of FastAPI/Uvicorn backend workers for
high-concurrency load balancing behind Nginx.

Usage:
    python scripts/start_cluster.py [--workers 4] [--start-port 8000]
"""

import sys
import time
import signal
import socket
import argparse
import subprocess
from pathlib import Path
from typing import List

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0

def main():
    parser = argparse.ArgumentParser(description="Start ExamSecure multi-worker backend cluster")
    parser.add_argument("--workers", type=int, default=4, help="Number of worker processes to spawn (default: 4)")
    parser.add_argument("--start-port", type=int, default=8000, help="Starting TCP port for workers (default: 8000)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface to bind (default: 127.0.0.1)")
    args = parser.parse_args()

    num_workers = args.workers
    start_port = args.start_port
    host = args.host
    ports = [start_port + i for i in range(num_workers)]

    print("=" * 70)
    print("  ExamSecure Enterprise - Backend Cluster Manager")
    print(f"  Spawning {num_workers} Workers across ports {ports[0]} - {ports[-1]}")
    print(f"  Tuned for Nginx Load Balancing (least_conn) & 800+ Concurrent Candidates")
    print("=" * 70)

    # Check for port conflicts
    for port in ports:
        if is_port_in_use(port):
            print(f"[WARNING] Port {port} is already in use. A previous worker or server may be running.")

    processes: List[subprocess.Popen] = []

    def shutdown_all(*_):
        print("\n[CLUSTER] Gracefully terminating all worker processes...")
        for p in processes:
            try:
                p.terminate()
            except Exception:
                pass
        time.sleep(1)
        for p in processes:
            try:
                p.kill()
            except Exception:
                pass
        print("[CLUSTER] All workers terminated cleanly.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_all)
    signal.signal(signal.SIGTERM, shutdown_all)

    # Launch worker processes
    for idx, port in enumerate(ports):
        cmd = [
            sys.executable,
            "-m", "uvicorn",
            "app.main:app",
            "--host", host,
            "--port", str(port),
            "--log-level", "info",
            "--no-access-log"  # Access logging handled by Nginx to reduce I/O under load
        ]
        print(f"[WORKER {idx + 1}/{num_workers}] Starting on http://{host}:{port} ...")
        proc = subprocess.Popen(
            cmd,
            cwd=str(BACKEND_DIR)
        )
        processes.append(proc)
        time.sleep(0.3)

    print("-" * 70)
    print(f"[CLUSTER ONLINE] {len(processes)} FastAPI workers are active and ready.")
    print("Nginx upstream proxying traffic to:")
    for port in ports:
        print(f"  -> http://{host}:{port}")
    print("Press Ctrl+C to shut down all cluster workers.")
    print("-" * 70)

    try:
        while True:
            for idx, p in enumerate(processes):
                ret = p.poll()
                if ret is not None:
                    port = ports[idx]
                    print(f"[WARNING] Worker on port {port} exited with code {ret}. Restarting...")
                    cmd = [
                        sys.executable,
                        "-m", "uvicorn",
                        "app.main:app",
                        "--host", host,
                        "--port", str(port),
                        "--log-level", "info",
                        "--no-access-log"
                    ]
                    processes[idx] = subprocess.Popen(cmd, cwd=str(BACKEND_DIR))
            time.sleep(2)
    except KeyboardInterrupt:
        shutdown_all()

if __name__ == "__main__":
    main()
