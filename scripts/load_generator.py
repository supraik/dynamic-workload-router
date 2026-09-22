import time
import requests
import concurrent.futures
from collections import Counter

ROUTER_URL = "http://127.0.0.1:8000/process"
STATS_URL = "http://127.0.0.1:8000/stats-overview"

def send_workload_request(req_id: int, iterations: int = 150000):
    """Sends a single workload request to the 3-Tier Decision Router."""
    start = time.perf_counter()
    try:
        resp = requests.post(f"{ROUTER_URL}?iterations={iterations}", timeout=12.0)
        data = resp.json()
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        decision = data.get("decision", {})
        tier = decision.get("selected_tier", "unknown").upper()
        verdict = decision.get("verdict", "UNKNOWN")
        scores = decision.get("scores", {})
        edge_score = scores.get("edge", 0)
        fog_score = scores.get("fog", 0)
        cloud_score = scores.get("cloud", 0)
        
        return {
            "id": req_id,
            "tier": tier,
            "verdict": verdict,
            "duration_ms": duration_ms,
            "edge_score": edge_score,
            "fog_score": fog_score,
            "cloud_score": cloud_score,
            "iterations": iterations,
            "success": True
        }
    except Exception as e:
        return {
            "id": req_id,
            "tier": "ERROR",
            "verdict": "FAILED",
            "duration_ms": round((time.perf_counter() - start) * 1000, 1),
            "error": str(e),
            "success": False
        }

def run_phase(phase_name: str, total_requests: int, concurrency: int, iterations: int, delay_between: float = 0.0):
    print(f"\n=========================================================================================")
    print(f"  >>> {phase_name.upper()}")
    print(f"      (Workload: {iterations:,} iterations | {total_requests} requests | Concurrency={concurrency})")
    print(f"=========================================================================================")
    
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = []
        for i in range(1, total_requests + 1):
            futures.append(executor.submit(send_workload_request, i, iterations))
            if delay_between > 0:
                time.sleep(delay_between)
        
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            results.append(res)
            tier_badge = f"[{res['tier']}]" if res['tier'] != "ERROR" else "[ERROR]"
            verdict_badge = f"({res['verdict']})"
            scores_str = f"Scores -> Edge: {res.get('edge_score', 0):<5} | Fog: {res.get('fog_score', 0):<5} | Cloud: {res.get('cloud_score', 0):<5}"
            print(f"  Req #{res['id']:02d} | {tier_badge:<8} {verdict_badge:<20} | Time: {res['duration_ms']:<7}ms | {scores_str}")

    return results

def main():
    print("=========================================================================================")
    print("       3-TIER DYNAMIC CONTINUUM OFFLOADING SIMULATION (EDGE -> FOG -> CLOUD)             ")
    print("=========================================================================================")

    # Quick check if router is up
    try:
        check = requests.get("http://127.0.0.1:8000/", timeout=2.0)
        if check.status_code != 200:
            print("[ERROR] Decision Router at http://127.0.0.1:8000 is not responding!")
            return
    except Exception:
        print("[ERROR] Decision Router at http://127.0.0.1:8000 is offline. Start the router first!")
        return

    all_results = []

    # Phase 1: Light Tasks -> Best on EDGE (Ultra-low 5ms latency, near user)
    p1 = run_phase("Phase 1: Lightweight IoT Tasks -> Targets EDGE Tier", 
                   total_requests=4, concurrency=2, iterations=25000, delay_between=0.3)
    all_results.extend(p1)
    time.sleep(0.8)

    # Phase 2: Moderate Workload -> Best on FOG (Local Server compute)
    p2 = run_phase("Phase 2: Standard Workload -> Targets FOG Tier", 
                   total_requests=6, concurrency=2, iterations=150000, delay_between=0.3)
    all_results.extend(p2)
    time.sleep(1.0)

    # Phase 3: Traffic Burst Spike -> Offloads to CLOUD (High parallel multi-core capacity)
    p3 = run_phase("Phase 3: High-Concurrency Burst Spike -> Offloads to CLOUD", 
                   total_requests=18, concurrency=10, iterations=250000, delay_between=0.0)
    all_results.extend(p3)
    time.sleep(1.5)

    # Phase 4: Cooldown & Recovery -> Restores back to EDGE / FOG
    p4 = run_phase("Phase 4: Traffic Subsides -> Returns to Local Continuum", 
                   total_requests=4, concurrency=2, iterations=25000, delay_between=0.3)
    all_results.extend(p4)

    # Summary Analysis
    tier_counts = Counter(r["tier"] for r in all_results if r["success"])
    total_successful = sum(tier_counts.values())
    avg_latency = round(sum(r["duration_ms"] for r in all_results if r["success"]) / max(1, total_successful), 1)

    print("\n=========================================================================================")
    print("                              CONTINUUM BENCHMARK SUMMARY                                ")
    print("=========================================================================================")
    print(f"Total Requests Dispatched  : {total_successful}")
    print(f"Processed by EDGE (5ms)    : {tier_counts.get('EDGE', 0)} ({round(tier_counts.get('EDGE', 0)/max(1, total_successful)*100, 1)}%)")
    print(f"Processed by FOG (20ms)    : {tier_counts.get('FOG', 0)} ({round(tier_counts.get('FOG', 0)/max(1, total_successful)*100, 1)}%)")
    print(f"Offloaded to CLOUD (100ms) : {tier_counts.get('CLOUD', 0)} ({round(tier_counts.get('CLOUD', 0)/max(1, total_successful)*100, 1)}%)")
    print(f"Average End-to-End Latency : {avg_latency} ms")
    print("=========================================================================================\n")

if __name__ == "__main__":
    main()
