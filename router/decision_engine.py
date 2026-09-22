import os
import time
import httpx
from fastapi import FastAPI, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from collections import deque
from typing import List, Dict, Any

app = FastAPI(
    title="Dynamic Workload Decision Router (3-Tier Continuum)",
    description="Multi-factor cost optimization reverse proxy for Edge, Fog, and Cloud."
)

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory request history for live dashboard
recent_requests_log: deque = deque(maxlen=100)
is_simulation_running: bool = False

# Tier Endpoint URLs
TIER_URLS = {
    "edge": os.getenv("EDGE_URL", "http://127.0.0.1:8001"),
    "fog": os.getenv("FOG_URL", "http://127.0.0.1:8002"),
    "cloud": os.getenv("CLOUD_URL", "http://127.0.0.1:8003"),
}

# Baseline Simulated Network RTT Latency (ms)
BASE_NETWORK_LATENCY_MS = {
    "edge": 5.0,    # Ultra-low latency (proximity to user)
    "fog": 20.0,    # Medium local on-premise latency
    "cloud": 100.0  # WAN latency to data center
}

# Cloud Financial Cost Penalty (Edge and Fog are free local hardware)
TIER_COST_FACTOR = {
    "edge": 0.0,
    "fog": 0.0,
    "cloud": 0.35
}

# Hardware Compute Multipliers (reflects 0.25 vs 0.50 vs 2.00 vCPU hardware limits)
HARDWARE_COMPUTE_WEIGHT = {
    "edge": 2.5,    # 0.25 vCPU: Heavy tasks take significantly longer on weak edge chip
    "fog": 1.0,     # 0.50 vCPU: Standard local server
    "cloud": 0.25   # 2.00 vCPU: High-capacity multi-core cloud
}

# Mathematical Cost Function Weights
W_QUEUE = 0.45      # Weight of active request queue congestion
W_CPU = 0.35        # Weight of CPU saturation
W_LATENCY = 0.20    # Weight of network round-trip time

# Async HTTP Client with connection pooling
http_client = httpx.AsyncClient(timeout=10.0)

async def fetch_tier_stats(tier: str) -> dict:
    """Fetches real-time telemetry from a specific tier."""
    url = f"{TIER_URLS[tier]}/stats"
    try:
        resp = await http_client.get(url, timeout=1.5)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return {
        "tier": tier,
        "cpu_percent": 99.0,
        "active_requests": 10,
        "avg_latency_ms": 500.0
    }

def compute_utility_cost(tier: str, stats: dict, iterations: int) -> float:
    """
    Evaluates the 3-Tier Multi-Factor Utility Cost Formula:
    Score = Queue_Penalty + CPU_Penalty + Network_Latency + Cloud_Cost + Workload_Compute_Weight
    """
    active_requests = stats.get("active_requests", 0)
    cpu_fraction = min(stats.get("cpu_percent", 0.0) / 100.0, 1.0)
    norm_latency = BASE_NETWORK_LATENCY_MS[tier] / 100.0
    cloud_penalty = TIER_COST_FACTOR[tier]

    # Compute execution penalty based on workload size and tier hardware capability
    workload_penalty = (iterations / 150000.0) * HARDWARE_COMPUTE_WEIGHT[tier] * 0.25

    score = (
        (W_QUEUE * active_requests) +
        (W_CPU * cpu_fraction) +
        (W_LATENCY * norm_latency) +
        cloud_penalty +
        workload_penalty
    )
    return round(score, 3)

@app.get("/")
def get_info():
    return {
        "service": "Dynamic Workload Decision Router",
        "algorithm": "3-Tier Multi-Factor Utility Cost Optimization",
        "continuum_tiers": ["edge", "fog", "cloud"]
    }

@app.get("/stats-overview")
async def get_all_stats():
    """Returns real-time telemetry and current utility cost scores for all tiers."""
    overview = {}
    for tier in ["edge", "fog", "cloud"]:
        stats = await fetch_tier_stats(tier)
        cost_score = compute_utility_cost(tier, stats, iterations=150000)
        overview[tier] = {
            "telemetry": stats,
            "cost_score": cost_score
        }
    return overview

@app.get("/process")
@app.post("/process")
async def route_and_process(
    iterations: int = Query(default=150000, description="Workload complexity (hashing iterations)")
):
    """
    3-Tier Gateway:
    1. Computes real-time Utility Cost for Edge, Fog, and Cloud.
    2. Routes request to the tier with the minimal score: argmin(Edge, Fog, Cloud).
    3. Forwards workload and returns output with decision rationale.
    """
    overall_start = time.perf_counter()

    # 1. Fetch live telemetry from all 3 tiers concurrently
    edge_stats = await fetch_tier_stats("edge")
    fog_stats = await fetch_tier_stats("fog")
    cloud_stats = await fetch_tier_stats("cloud")

    # 2. Compute Utility Cost Scores across the Continuum
    scores = {
        "edge": compute_utility_cost("edge", edge_stats, iterations),
        "fog": compute_utility_cost("fog", fog_stats, iterations),
        "cloud": compute_utility_cost("cloud", cloud_stats, iterations)
    }

    # 3. Dynamic Placement Decision: Choose tier with minimum penalty score
    selected_tier = min(scores, key=scores.get)

    if selected_tier == "edge":
        verdict = "PROCESS_AT_EDGE"
        reason = f"Lightweight task with 5ms network proximity. Edge score ({scores['edge']}) is lowest."
    elif selected_tier == "fog":
        verdict = "PROCESS_AT_FOG"
        reason = f"Medium task. Fog server ({scores['fog']}) offers faster compute than Edge without Cloud billing."
    else:
        verdict = "OFFLOAD_TO_CLOUD"
        reason = f"Local tiers congested. Cloud ({scores['cloud']}) provides multi-core throughput."

    target_url = f"{TIER_URLS[selected_tier]}/workload"

    # 4. Forward Workload to Selected Tier
    try:
        resp = await http_client.post(f"{target_url}?iterations={iterations}")
        tier_data = resp.json()
    except Exception as err:
        tier_data = {"error": str(err), "tier": selected_tier}

    total_duration_ms = round((time.perf_counter() - overall_start) * 1000.0, 2)

    log_entry = {
        "timestamp": time.strftime("%H:%M:%S"),
        "tier": selected_tier.upper(),
        "verdict": verdict,
        "reason": reason,
        "scores": scores,
        "iterations": iterations,
        "duration_ms": total_duration_ms,
        "execution": tier_data
    }
    recent_requests_log.appendleft(log_entry)

    return {
        "status": "success",
        "decision": {
            "selected_tier": selected_tier,
            "verdict": verdict,
            "reason": reason,
            "scores": scores,
            "telemetry_snapshot": {
                "edge": {"active": edge_stats.get("active_requests", 0), "cpu": edge_stats.get("cpu_percent", 0.0)},
                "fog": {"active": fog_stats.get("active_requests", 0), "cpu": fog_stats.get("cpu_percent", 0.0)},
                "cloud": {"active": cloud_stats.get("active_requests", 0), "cpu": cloud_stats.get("cpu_percent", 0.0)}
            }
        },
        "execution": tier_data,
        "total_round_trip_ms": total_duration_ms
    }

@app.get("/history")
def get_history():
    """Returns the latest 100 routed requests for the React dashboard."""
    return list(recent_requests_log)

@app.post("/clear-history")
def clear_history():
    recent_requests_log.clear()
    return {"status": "cleared"}
