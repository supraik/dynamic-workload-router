import os
import sys
import time
import subprocess
import requests

def check_service(url: str, timeout: float = 2.0) -> bool:
    try:
        r = requests.get(url, timeout=timeout)
        return r.status_code == 200
    except Exception:
        return False

def main():
    print("""
===================================================================
       LATENCY-AWARE DYNAMIC WORKLOAD OFFLOADING DEMO
       Cloud - Fog - Edge Continuum (Mid-Viva Showcase)
===================================================================
    """)

    # 1. Check Docker Containers
    print("[1/4] Checking Docker Containers (Edge, Fog, Cloud)...")
    fog_alive = check_service("http://127.0.0.1:8002/health")
    cloud_alive = check_service("http://127.0.0.1:8003/health")

    if not (fog_alive and cloud_alive):
        print("  --> Containers are not responding. Starting via Docker Compose...")
        subprocess.run(["docker", "compose", "up", "-d"], check=True)
        time.sleep(3.0)
    else:
        print("  --> Docker Continuum Containers are ONLINE (Fog: :8002, Cloud: :8003).")

    # 2. Start Decision Engine Router
    print("\n[2/4] Launching Decision Router (Port 8000)...")
    router_process = None
    if not check_service("http://127.0.0.1:8000/"):
        router_process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "router.decision_engine:app", "--host", "127.0.0.1", "--port", "8000", "--log-level", "warning"]
        )
        # Wait up to 10 seconds for router to spin up
        started = False
        for _ in range(20):
            time.sleep(0.5)
            if check_service("http://127.0.0.1:8000/"):
                started = True
                break
        if started:
            print("  --> Decision Router Gateway started successfully on http://127.0.0.1:8000.")
        else:
            print("  --> [WARNING] Router process started, proceeding to simulation...")
    else:
        print("  --> Decision Router Gateway is already active on http://127.0.0.1:8000.")

    # 3. Run Traffic Simulation
    print("\n[3/4] Running Live Workload Simulation...")
    try:
        import scripts.load_generator as load_gen
        load_gen.main()
    except Exception as e:
        print(f"[ERROR] Simulation error: {e}")

    # 4. Clean up router if we spawned it
    if router_process:
        print("[4/4] Demo complete. Cleaning up local router process...")
        router_process.terminate()
        router_process.wait()

    print("""
===================================================================
                     VIVA DEMO TALKING POINTS:
1. Normal Load: Multi-factor cost score prioritizes local Fog execution.
2. Traffic Spike: Fog queue & CPU rise -> Cloud cost becomes lower -> 
   Traffic dynamically offloads to Cloud, keeping response times fast!
3. Recovery: Once traffic subsides, the engine automatically routes 
   workloads back to Fog to eliminate unnecessary Cloud usage.
===================================================================
    """)

if __name__ == "__main__":
    main()
