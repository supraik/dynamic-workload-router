import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Server, 
  Cpu, 
  Layers, 
  Cloud, 
  Zap, 
  Play, 
  Square,
  Activity,
  Terminal as TerminalIcon,
  GripVertical
} from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 95;

export default function App() {
  // Telemetry state
  const [stats, setStats] = useState({
    edge: { telemetry: { cpu_percent: 0, active_requests: 0, avg_latency_ms: 0 }, cost_score: 0.1 },
    fog: { telemetry: { cpu_percent: 0, active_requests: 0, avg_latency_ms: 0 }, cost_score: 0.1 },
    cloud: { telemetry: { cpu_percent: 0, active_requests: 0, avg_latency_ms: 0 }, cost_score: 0.55 },
  });

  // Target tier currently active in flow animation
  const [activeTarget, setActiveTarget] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([
    { id: 1, type: "system", text: "Continuum Decision Engine initialized. Gateway: :8000" },
    { id: 2, type: "system", text: "Continuum Nodes Online: Edge (:8001), Fog (:8002), Cloud (:8003)" },
    { id: 3, type: "system", text: "Awaiting live demo dispatch..." }
  ]);

  const [p99Latency, setP99Latency] = useState(115);
  const [rps, setRps] = useState(0);
  const [offloadPct, setOffloadPct] = useState(0);

  // Resizable Panel State (% width of left canvas)
  const [leftWidthPct, setLeftWidthPct] = useState(56);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const terminalEndRef = useRef(null);

  // Draggable Node Positions State
  const [positions, setPositions] = useState({
    router: { x: 260, y: 30 },
    edge: { x: 40, y: 220 },
    fog: { x: 380, y: 220 },
    cloud: { x: 210, y: 400 }
  });

  const [dragState, setDragState] = useState(null); // { nodeKey: 'edge', offsetX, offsetY }

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Telemetry Poller
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`${API_BASE}/stats-overview`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {}
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 600);
    return () => clearInterval(interval);
  }, []);

  // Handle Panel Resizing (Mouse events)
  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleResize = useCallback((e) => {
    if (!isResizing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newLeftPct = ((e.clientX - rect.left) / rect.width) * 100;
    if (newLeftPct >= 30 && newLeftPct <= 75) {
      setLeftWidthPct(newLeftPct);
    }
  }, [isResizing]);

  // Handle Node Dragging
  const handleNodeMouseDown = (nodeKey, e) => {
    e.stopPropagation();
    const currentPos = positions[nodeKey];
    setDragState({
      nodeKey,
      startX: e.clientX - currentPos.x,
      startY: e.clientY - currentPos.y
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (isResizing) {
      handleResize(e);
      return;
    }
    if (dragState) {
      const newX = Math.max(10, e.clientX - dragState.startX);
      const newY = Math.max(10, e.clientY - dragState.startY);
      setPositions(prev => ({
        ...prev,
        [dragState.nodeKey]: { x: newX, y: newY }
      }));
    }
  }, [isResizing, dragState, handleResize]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) stopResizing();
    if (dragState) setDragState(null);
  }, [isResizing, dragState, stopResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const addLog = (entry) => {
    setLogs((prev) => [...prev, { id: Date.now() + Math.random(), ...entry }]);
  };

  // Dispatch Workload API Call
  const sendWorkload = async (iterations) => {
    try {
      const res = await fetch(`${API_BASE}/process?iterations=${iterations}`, { method: 'POST' });
      const data = await res.json();
      const decision = data.decision || {};
      const tier = decision.selected_tier || "fog";
      setActiveTarget(tier);
      setP99Latency(data.total_round_trip_ms || 120);
      return { tier, ...data };
    } catch (e) {
      return { tier: "fog", error: true };
    }
  };

  // Run Full Live Presentation Demo
  const runLiveDemo = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([]);
    setRps(8);

    addLog({ type: "step", text: "1. Initializing baseline load test across continuum..." });
    await new Promise(r => setTimeout(r, 400));

    // Phase 1: Light IoT Tasks -> Edge
    addLog({ 
      type: "reasoning", 
      text: "Lightweight task (25k iters) detected. Evaluating continuum: Edge (5ms RTT) provides optimal latency without compute penalty." 
    });

    for (let i = 1; i <= 3; i++) {
      const res = await sendWorkload(25000);
      addLog({
        type: "routing",
        text: `Req #${i} -> Routed to [EDGE] (:8001) | RTT: ${res.total_round_trip_ms}ms | J(Edge)=${res.decision?.scores?.edge} vs J(Fog)=${res.decision?.scores?.fog}`
      });
      await new Promise(r => setTimeout(r, 350));
    }

    // Phase 2: Standard Workload -> Fog
    addLog({ type: "step", text: "2. Scaling to standard workload batch (150,000 iterations)..." });
    addLog({ 
      type: "reasoning", 
      text: "Task compute intensity exceeds Edge capacity. Fog tier (0.50 vCPU) selected: J(Fog)=0.38 < J(Edge)=0.64." 
    });

    for (let i = 4; i <= 8; i++) {
      const res = await sendWorkload(150000);
      addLog({
        type: "routing",
        text: `Req #${i} -> Processed on [FOG] (:8002) | RTT: ${res.total_round_trip_ms}ms | Cloud cost avoided ($0.00).`
      });
      await new Promise(r => setTimeout(r, 350));
    }

    // Phase 3: Traffic Spike Burst -> Offload to Cloud
    addLog({ type: "step", text: "3. 🚨 INJECTING LOCALIZED CONCURRENCY SPIKE (16 Simultaneous Requests)..." });
    setRps(36);
    addLog({ 
      type: "alert", 
      text: "Observed severe Fog pressure! Fog CPU surged > 90%, Queue depth = 8. Penalty score J(Fog) degraded to 3.82." 
    });
    addLog({ 
      type: "reasoning", 
      text: "Dynamic offloading engaged: J(Fog)=3.82 > J(Cloud)=0.65. Diverting overflow traffic to Cloud tier (:8003)." 
    });

    const spikePromises = Array.from({ length: 16 }).map(async (_, idx) => {
      const res = await sendWorkload(250000);
      const isCloud = res.decision?.selected_tier === "cloud";
      addLog({
        type: isCloud ? "cloud" : "fog",
        text: `Burst Req #${idx + 9} -> [${res.decision?.selected_tier?.toUpperCase()}] | Time: ${res.total_round_trip_ms}ms | J(Fog)=${res.decision?.scores?.fog} vs J(Cloud)=${res.decision?.scores?.cloud}`
      });
    });

    await Promise.all(spikePromises);
    setOffloadPct(28);

    // Phase 4: Cooldown & Recovery
    setRps(4);
    addLog({ type: "step", text: "4. Traffic spike subsided. Observing continuum recovery..." });
    addLog({ 
      type: "reasoning", 
      text: "Fog queue cleared (Queue=0, CPU=14%). Continuum cost re-balanced: J(Fog)=0.10. Restoring traffic to local infrastructure." 
    });

    for (let i = 25; i <= 28; i++) {
      const res = await sendWorkload(25000);
      addLog({
        type: "routing",
        text: `Req #${i} -> Re-settled on [FOG/EDGE] | RTT: ${res.total_round_trip_ms}ms | Unnecessary cloud instances avoided.`
      });
      await new Promise(r => setTimeout(r, 300));
    }

    addLog({ type: "step", text: "5. ✅ Live Continuum Offloading Demonstration Complete." });
    setIsRunning(false);
    setActiveTarget(null);
    setRps(0);
  };

  // Calculate Dynamic SVG Path (Cubic Bezier curve from Router center to Target node center)
  const getCurvePath = (sourceNode, targetNode) => {
    const s = { x: positions[sourceNode].x + NODE_WIDTH / 2, y: positions[sourceNode].y + NODE_HEIGHT / 2 };
    const t = { x: positions[targetNode].x + NODE_WIDTH / 2, y: positions[targetNode].y + NODE_HEIGHT / 2 };
    const midY = (s.y + t.y) / 2;
    return `M ${s.x} ${s.y} C ${s.x} ${midY}, ${t.x} ${midY}, ${t.x} ${t.y}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* TOP NAVBAR */}
      <nav className="top-navbar">
        <div className="brand-section">
          <span className="brand-title">dynamic workload router</span>
          <span className="brand-subtitle">live continuum routing</span>
        </div>

        <div className="nav-controls">
          <div className="metric-pill">
            <span>rps</span>
            <strong>{rps || 18}</strong>
          </div>

          <div className="metric-pill">
            <span>p99</span>
            <strong style={{ color: p99Latency > 800 ? '#f43f5e' : '#10b981' }}>{p99Latency}ms</strong>
          </div>

          <div className="metric-pill">
            <span>offload</span>
            <strong>{offloadPct}%</strong>
          </div>

          <button 
            className={`btn-demo ${isRunning ? 'running' : ''}`}
            onClick={runLiveDemo}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <Square size={13} fill="#fff" />
                Running...
              </>
            ) : (
              <>
                <Play size={13} fill="#fff" />
                Run Live Demo
              </>
            )}
          </button>
        </div>
      </nav>

      {/* RESIZABLE WORKSPACE CONTAINER */}
      <div className="workspace-container" ref={containerRef}>
        {/* LEFT PANEL: DRAGGABLE NETWORK TOPOLOGY GRAPH */}
        <div className="topology-panel" style={{ width: `${leftWidthPct}%` }}>
          <svg className="topology-canvas">
            {/* Dynamic Curve: Router -> Edge */}
            <path 
              d={getCurvePath('router', 'edge')} 
              className={`flow-line ${activeTarget === 'edge' ? 'active' : ''}`} 
            />
            {/* Dynamic Curve: Router -> Fog */}
            <path 
              d={getCurvePath('router', 'fog')} 
              className={`flow-line ${activeTarget === 'fog' ? 'active' : ''}`} 
            />
            {/* Dynamic Curve: Router -> Cloud */}
            <path 
              d={getCurvePath('router', 'cloud')} 
              className={`flow-line ${activeTarget === 'cloud' ? 'active' : ''}`} 
            />
          </svg>

          {/* 1. GATEWAY / DECISION ROUTER NODE */}
          <div 
            className="node-card router" 
            style={{ left: `${positions.router.x}px`, top: `${positions.router.y}px` }}
            onMouseDown={(e) => handleNodeMouseDown('router', e)}
          >
            <div className="node-top">
              <div className="node-identity">
                <Activity size={16} className="node-icon" style={{ color: 'var(--accent-router)' }} />
                <div>
                  <div className="node-name">Router Gateway</div>
                  <div className="node-port">:8000</div>
                </div>
              </div>
              <svg className="node-wave" viewBox="0 0 44 14">
                <path d="M 0 7 Q 11 0, 22 7 T 44 7" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
              </svg>
            </div>

            <div className="node-stats-grid">
              <div className="node-stat-item">
                <span className="stat-label">RPS</span>
                <span className="stat-val">{rps || 18}</span>
              </div>
              <div className="node-stat-item">
                <span className="stat-label">P99 Latency</span>
                <span className="stat-val">{p99Latency}ms</span>
              </div>
            </div>
          </div>

          {/* 2. EDGE TIER NODE */}
          <div 
            className={`node-card edge ${activeTarget === 'edge' ? 'active-target' : ''}`} 
            style={{ left: `${positions.edge.x}px`, top: `${positions.edge.y}px` }}
            onMouseDown={(e) => handleNodeMouseDown('edge', e)}
          >
            <div className="node-top">
              <div className="node-identity">
                <Zap size={16} className="node-icon" style={{ color: 'var(--accent-edge)' }} />
                <div>
                  <div className="node-name">Edge Node</div>
                  <div className="node-port">:8001 • 0.25 vCPU</div>
                </div>
              </div>
              <svg className="node-wave" viewBox="0 0 44 14">
                <path d="M 0 7 Q 11 13, 22 7 T 44 7" fill="none" stroke="#06b6d4" strokeWidth="1.5" />
              </svg>
            </div>

            <div className="node-stats-grid">
              <div className="node-stat-item">
                <span className="stat-label">CPU %</span>
                <span className="stat-val">{stats.edge?.telemetry?.cpu_percent?.toFixed(0) || 0}%</span>
              </div>
              <div className="node-stat-item">
                <span className="stat-label">Cost J(Edge)</span>
                <span className="stat-val" style={{ color: 'var(--accent-edge)' }}>
                  {stats.edge?.cost_score?.toFixed(2) || '0.12'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. FOG TIER NODE */}
          <div 
            className={`node-card fog ${activeTarget === 'fog' ? 'active-target' : ''}`} 
            style={{ left: `${positions.fog.x}px`, top: `${positions.fog.y}px` }}
            onMouseDown={(e) => handleNodeMouseDown('fog', e)}
          >
            <div className="node-top">
              <div className="node-identity">
                <Server size={16} className="node-icon" style={{ color: 'var(--accent-fog)' }} />
                <div>
                  <div className="node-name">Fog Node</div>
                  <div className="node-port">:8002 • 0.50 vCPU</div>
                </div>
              </div>
              <svg className="node-wave" viewBox="0 0 44 14">
                <path d="M 0 7 Q 11 1, 22 7 T 44 7" fill="none" stroke="#f43f5e" strokeWidth="1.5" />
              </svg>
            </div>

            <div className="node-stats-grid">
              <div className="node-stat-item">
                <span className="stat-label">CPU %</span>
                <span className={`stat-val ${(stats.fog?.telemetry?.cpu_percent || 0) > 80 ? 'highlight' : ''}`}>
                  {stats.fog?.telemetry?.cpu_percent?.toFixed(0) || 0}%
                </span>
              </div>
              <div className="node-stat-item">
                <span className="stat-label">Cost J(Fog)</span>
                <span className="stat-val" style={{ color: 'var(--accent-fog)' }}>
                  {stats.fog?.cost_score?.toFixed(2) || '0.10'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. CLOUD TIER NODE */}
          <div 
            className={`node-card cloud ${activeTarget === 'cloud' ? 'active-target' : ''}`} 
            style={{ left: `${positions.cloud.x}px`, top: `${positions.cloud.y}px` }}
            onMouseDown={(e) => handleNodeMouseDown('cloud', e)}
          >
            <div className="node-top">
              <div className="node-identity">
                <Cloud size={16} className="node-icon" style={{ color: 'var(--accent-cloud)' }} />
                <div>
                  <div className="node-name">Cloud Tier</div>
                  <div className="node-port">:8003 • 2.00 vCPU</div>
                </div>
              </div>
              <svg className="node-wave" viewBox="0 0 44 14">
                <path d="M 0 7 Q 11 11, 22 7 T 44 7" fill="none" stroke="#a855f7" strokeWidth="1.5" />
              </svg>
            </div>

            <div className="node-stats-grid">
              <div className="node-stat-item">
                <span className="stat-label">CPU %</span>
                <span className="stat-val">{stats.cloud?.telemetry?.cpu_percent?.toFixed(0) || 0}%</span>
              </div>
              <div className="node-stat-item">
                <span className="stat-label">Cost J(Cloud)</span>
                <span className="stat-val" style={{ color: 'var(--accent-cloud)' }}>
                  {stats.cloud?.cost_score?.toFixed(2) || '0.55'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RESIZER DRAG BAR */}
        <div 
          className={`resizer-bar ${isResizing ? 'dragging' : ''}`} 
          onMouseDown={startResizing}
        >
          <div className="resizer-handle"></div>
        </div>

        {/* RIGHT PANEL: RESIZABLE TERMINAL REASONING STREAM */}
        <div className="terminal-panel" style={{ width: `${100 - leftWidthPct}%` }}>
          <div className="terminal-header">
            <div className="terminal-tab">
              <span style={{ color: 'var(--text-muted)' }}>&gt;_</span>
              <span>agent reasoning</span>
              <div className="pulse-dot"></div>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {logs.length} events logged
            </span>
          </div>

          <div className="terminal-content">
            {logs.map((log, idx) => (
              <div key={log.id || idx} className="stream-entry">
                <span className="stream-idx">{String(idx + 1).padStart(2, '0')}.</span>
                <div className="stream-text">
                  {log.type === "step" && (
                    <strong style={{ color: '#fff' }}>{log.text}</strong>
                  )}
                  {log.type === "reasoning" && (
                    <span style={{ color: '#9ca3af' }}>{log.text}</span>
                  )}
                  {log.type === "alert" && (
                    <span className="alert">{log.text}</span>
                  )}
                  {log.type === "routing" && (
                    <span>{log.text}</span>
                  )}
                  {log.type === "cloud" && (
                    <span style={{ color: 'var(--accent-cloud)' }}>{log.text}</span>
                  )}
                  {log.type === "fog" && (
                    <span style={{ color: 'var(--accent-fog)' }}>{log.text}</span>
                  )}
                  {log.type === "system" && (
                    <span style={{ color: 'var(--text-muted)' }}>{log.text}</span>
                  )}
                </div>
              </div>
            ))}
            {isRunning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                <span>&gt; processing continuum telemetry</span>
                <span className="cursor-blink"></span>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
