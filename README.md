# Latency-Aware Dynamic Workload Offloading in a Cloud-Fog-Edge Continuum

A context-aware dynamic placement and workload offloading system designed for heterogeneous computing environments. It bridges the gap between local resource constraints and cloud scalability by dynamically determining where computational tasks should execute across the Edge-Fog-Cloud continuum in real time.

---

## 1. Problem Statement & Motivation

Modern autoscaling solutions such as Kubernetes Horizontal Pod Autoscaler (HPA) and KEDA (Kubernetes Event-driven Autoscaling) determine how many application instances are required during traffic surges. However, they operate on a fundamental assumption: that underlying physical compute capacity is elastic and virtually unlimited.

In a real-world Cloud-Fog-Edge hierarchy:
* **Edge & Fog nodes** (e.g., IoT gateways, local servers, 5G base stations) possess strictly limited physical CPU cores and memory.
* During localized traffic spikes, naive autoscaling on constrained local nodes results in CPU thrashing, long queue delays, memory exhaustion, or request drops.
* Conversely, routing all traffic to the Cloud guarantees high compute power but incurs unnecessary WAN network latency (~100ms+) and recurring cloud resource costs.

```text
                 [ The Continuum Trade-off ]

        Tier      Network Distance (RTT)      Compute Muscle (CPU)
       ──────     ──────────────────────      ────────────────────
       EDGE    ->  Ultra-Low (~2-5ms)    vs.   Constrained (0.25 vCPU)
       FOG     ->  Fast (~15-25ms)       vs.   Moderate (0.50 vCPU)
       CLOUD   ->  Slower (~80-200ms)    vs.   High-Capacity (2.0+ vCPU)
```

### Core Objective:
Instead of static thresholding or permanently offloading to the cloud, the system dynamically routes workloads to the optimal tier in real time based on live hardware saturation, queue depth, network latency, and cost factors.

---

## 2. System Architecture & Components

The architecture consists of a containerized 3-tier computing continuum, real-time telemetry harvesting, a mathematical decision engine, and an interactive operations center UI:

```text
                                  [ Client Requests ]
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │      DYNAMIC DECISION ENGINE GATEWAY         │
                    │         (Port 8000 • /process)               │
                    │  Evaluates Multi-Factor Cost Function J(T)   │
                    └───────┬──────────────┬──────────────┬────────┘
                            │              │              │
                   Light /  │     Standard │      Burst / │ Local
                   Proximity│     Workload │      Spike   │ Choked
                            ▼              ▼              ▼
                     ┌────────────┐ ┌────────────┐ ┌────────────┐
                     │ EDGE TIER  │ │  FOG TIER  │ │ CLOUD TIER │
                     │ Port: 8001 │ │ Port: 8002 │ │ Port: 8003 │
                     │ 0.25 vCPU  │ │ 0.50 vCPU  │ │ 2.00 vCPU  │
                     │ 128 MB RAM │ │ 256 MB RAM │ │ 1024MB RAM │
                     │ 5ms Latency│ │ 20ms Latency│ │100ms WAN  │
                     └────────────┘ └────────────┘ └────────────┘
```

### Core Modules:

1. **Workload Microservice (`app/main.py`):**
   * Executes synthetic CPU-bound cryptographic loops (SHA-256 rounds) that simulate real computational tasks (image processing, payload compression, inference) and trigger container CPU quotas.
   * Exposes a `/stats` telemetry endpoint reporting active in-flight requests, CPU utilization (`psutil`), and rolling latency.

2. **Heterogeneous Container Continuum (`docker-compose.yml`):**
   * Runs 3 isolated instances of the workload image with hardware throttling via Docker resource quotas (`cpus: 0.25`, `cpus: 0.50`, `cpus: 2.00`).

3. **Multi-Factor Decision Engine (`router/decision_engine.py`):**
   * Acts as an intelligent reverse proxy at `http://127.0.0.1:8000`.
   * Evaluates incoming task complexity against live node metrics and computes utility cost scores for Edge, Fog, and Cloud simultaneously.

4. **Operations Center Dashboard (`frontend/`):**
   * Dark-mode operations console with a draggable network topology graph, animated flow lines, live hardware gauges, and a real-time reasoning terminal.

---

## 3. Decision Algorithm: Multi-Factor Utility Cost Optimization

Rather than relying on a static threshold rule (such as `if CPU > 80%: offload`), the decision engine evaluates a continuous **Penalty Cost Score $J(\text{tier})$** for every candidate tier:

$$J(\text{tier}) = (W_{\text{queue}} \times Q) + (W_{\text{cpu}} \times U_{\text{cpu}}) + (W_{\text{lat}} \times L_{\text{norm}}) + C_{\text{cloud}} + P_{\text{workload}}$$

### Parameter Breakdown:
* **$Q$ (Queue Congestion):** Current active in-flight requests on the tier ($W_{\text{queue}} = 0.45$).
* **$U_{\text{cpu}}$ (CPU Utilization):** Normalized CPU saturation fraction ($W_{\text{cpu}} = 0.35$).
* **$L_{\text{norm}}$ (Network Latency):** Baseline round-trip time: Edge ($0.05$), Fog ($0.20$), Cloud ($1.00$) ($W_{\text{lat}} = 0.20$).
* **$C_{\text{cloud}}$ (Financial Cost Factor):** Edge ($0.00$), Fog ($0.00$), Cloud ($0.35$).
* **$P_{\text{workload}}$ (Compute Penalty):** Workload complexity scaled by tier hardware capacity multiplier (Edge: $2.5\times$, Fog: $1.0\times$, Cloud: $0.25\times$).

### Placement Decision Rule:
$$\text{Selected Tier} = \arg\min \Big( J(\text{Edge}), J(\text{Fog}), J(\text{Cloud}) \Big)$$

---

## 4. AI & Machine Learning Integration

AI can be integrated into the system through two complementary approaches:

### A. Intelligent Reinforcement Learning Decision Agent (Q-Learning)
* **Goal:** Allow the decision engine to learn the optimal routing policy autonomously instead of using fixed manual weights.
* **State Space:** `[Edge_CPU, Fog_CPU, Cloud_CPU, Fog_Queue, Average_Latency]`
* **Action Space:** `[Route to Edge, Route to Fog, Route to Cloud, Split 50-50]`
* **Reward Function:** Penalizes high response latency, dropped requests, and unnecessary cloud billing. Over time, the agent learns the exact tipping point where offloading becomes mathematically advantageous.

### B. Real-World AI Inference Workload Payload
* The synthetic hashing function can be replaced with lightweight pre-trained AI models (such as MobileNet ONNX image classification or text sentiment analysis):
  * **Edge (0.25 vCPU):** Takes ~2.5s due to constrained hardware.
  * **Cloud (2.00 vCPU):** Takes ~0.08s on multi-core compute.
  * This allows the router to demonstrate dynamic offloading of real-time computer vision and machine learning tasks across the continuum.

---

## 5. Future Roadmap & Practical Extensions

The following extensions provide achievable next steps for enhancing the system:

1. **Real-World Task Payloads:**
   * Integrate ONNX / PyTorch lightweight image processing or computer vision inference tasks as the workload endpoint.

2. **Adaptive SLA-Based Thresholds:**
   * Automatically adjust cost weights based on a target response time SLA (e.g., maintain P95 latency below 300ms).

3. **Metrics Export & Visual Reporting:**
   * Implement automated CSV/JSON logging to record latency, throughput, and tier distribution for comparative benchmarking.

4. **Multi-Host Local Deployment:**
   * Run the Edge container on a separate physical local device (e.g., a Raspberry Pi or secondary laptop on the same local network) and Cloud on a remote instance to observe actual physical network latency.

---

## 6. Quickstart Guide (How to Run)

### Prerequisites:
* Docker Desktop (installed and running)
* Python 3.10+
* Node.js 18+ and npm

---

### Step 1: Set Up Python Virtual Environment
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r app/requirements.txt
```

---

### Step 2: Start the 3-Tier Docker Continuum
```powershell
docker compose up --build -d
```
Verify that the services are active:
```powershell
docker compose ps
```

---

### Step 3: Run the Operations Center Dashboard

**Terminal 1 — Start the Decision Router:**
```powershell
.\venv\Scripts\Activate.ps1
python -m uvicorn router.decision_engine:app --host 127.0.0.1 --port 8000
```

**Terminal 2 — Start the React Frontend:**
```powershell
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser. Click **`Run Live Demo`** on the top right to start the live traffic simulation and view real-time request routing.

---

### Step 4: Or Run via Command-Line Runner
```powershell
.\venv\Scripts\Activate.ps1
python run_demo.py
```
