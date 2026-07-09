/**
 * Reusable SVG figure builders for topic articles.
 * Each returns { id, svg, caption } with unique marker IDs per topic.
 */

const C = {
  client: "#9aa7c7",
  service: "#7c5cff",
  gateway: "#ff8fab",
  ledger: "#3ddc97",
  queue: "#ffb454",
  accent: "#5b9dff",
  muted: "#93a1bd",
  ink: "#cdd6e8",
  panel: "#1a2236",
  ok: "#3ddc97",
  warn: "#ffb454",
  err: "#ff5c6c",
  lock: "#ffd166",
};

function marker(topicId) {
  return `fig-${topicId}-arr`;
}

function defs(topicId) {
  const m = marker(topicId);
  return `<defs><marker id="${m}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${C.accent}"/></marker></defs>`;
}

function box(x, y, w, h, label, sub, stroke, fs = 11) {
  const cy = sub ? y + (h / 2) - 6 : y + h / 2 + 4;
  const subY = sub ? y + h / 2 + 10 : null;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${C.panel}" stroke="${stroke}" stroke-width="1.5"/>
<text x="${x + w / 2}" y="${cy}" text-anchor="middle" fill="${C.ink}" font-size="${fs}" font-family="system-ui">${label}</text>${sub ? `<text x="${x + w / 2}" y="${subY}" text-anchor="middle" fill="${C.muted}" font-size="9" font-family="system-ui">${sub}</text>` : ""}`;
}

function arrow(x1, y1, x2, y2, topicId) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.accent}" stroke-width="1.5" marker-end="url(#${marker(topicId)})"/>`;
}

function title(text, x = 260, y = 18) {
  return `<text x="${x}" y="${y}" text-anchor="middle" fill="${C.muted}" font-size="10" font-family="system-ui">${text}</text>`;
}

export function buildFigure(diagramType, topicId, titleText, opts = {}) {
  const builders = {
    timeline: timelineDiagram,
    lockTimeline: lockTimelineDiagram,
    stateMachine: stateMachineDiagram,
    requestFlow: requestFlowDiagram,
    cacheFlow: cacheFlowDiagram,
    hashRing: hashRingDiagram,
    quorum: quorumDiagram,
    consensus: consensusDiagram,
    outboxFlow: outboxFlowDiagram,
    comparison: comparisonDiagram,
    capTriangle: capTriangleDiagram,
    fanOut: fanOutDiagram,
    stampede: stampedeDiagram,
    messagingLoop: messagingLoopDiagram,
    architecture: architectureDiagram,
    tokenBucket: tokenBucketDiagram,
    saga: sagaDiagram,
    twoPc: twoPcDiagram,
    clock: clockDiagram,
    domino: dominoDiagram,
    poolExhaustion: poolExhaustionDiagram,
    slowConsumer: slowConsumerDiagram,
    retryAmplification: retryAmplificationDiagram,
  };
  const fn = builders[diagramType] || timelineDiagram;
  return fn(topicId, titleText, opts);
}

export function timelineDiagram(topicId, titleText, { variant = "rmw" } = {}) {
  const id = variant === "toctou" ? "toctou-gap" : "timeline";
  const caption = variant === "toctou"
    ? `${titleText}: check-then-act gap — state changes between check and act.`
    : `${titleText}: two workers interleave read-modify-write on the same row; the second write overwrites the first.`;
  const svg = `<svg viewBox="0 0 520 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} timeline">
${defs(topicId)}
${title("Concurrent timeline — time flows right", 260)}
${box(20, 40, 70, 32, "Worker A", null, C.accent)}
${box(20, 90, 70, 32, "Worker B", null, C.warn)}
${box(120, 65, 90, 40, "Shared row", "Ledger", C.service)}
${variant === "toctou" ? `${box(240, 40, 80, 32, "check OK", null, C.client)}
${box(340, 40, 80, 32, "act fails", "stale", C.err)}
${box(240, 90, 80, 32, "state changed", null, C.warn)}
${box(440, 65, 70, 40, "race ✗", null, C.err)}` : `${box(240, 40, 80, 32, "read 100", null, C.client)}
${box(340, 40, 80, 32, "write 120", null, C.ok)}
${box(240, 90, 80, 32, "read 100", null, C.client)}
${box(340, 90, 80, 32, "write 130", "stale!", C.err)}
${box(440, 65, 70, 40, "130 ✗", "lost +20", C.err)}`}
${arrow(90, 56, 118, 80, topicId)}
${arrow(90, 106, 118, 88, topicId)}
${arrow(210, 80, 238, variant === "toctou" ? 56 : 56, topicId)}
${arrow(210, 88, 238, variant === "toctou" ? 106 : 106, topicId)}
${arrow(320, 56, 338, 56, topicId)}
${arrow(320, 106, 338, 106, topicId)}
${arrow(420, 56, 438, 78, topicId)}
${arrow(420, 106, 438, 92, topicId)}
</svg>`;
  return { id, svg, caption };
}

export function lockTimelineDiagram(topicId, titleText) {
  return {
    id: "lock-timeline",
    caption: `${titleText}: lease-based lock with fencing token — stale holder must not write after expiry.`,
    svg: `<svg viewBox="0 0 560 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} lock timeline">
${defs(topicId)}
${title("Lock lease timeline", 280)}
${box(30, 50, 80, 36, "Worker A", "holds lock", C.accent)}
${box(30, 110, 80, 36, "Worker B", "waits", C.warn)}
${box(140, 80, 100, 40, "Redis lock", "SET NX PX", C.lock)}
${box(270, 50, 90, 36, "lease OK", "f=1", C.ok)}
${box(270, 110, 90, 36, "blocked", null, C.muted)}
${box(390, 50, 90, 36, "lease expired", null, C.err)}
${box(390, 110, 90, 36, "acquires", "f=2", C.ok)}
${box(500, 80, 50, 40, "safe", null, C.ok)}
${arrow(110, 68, 138, 88, topicId)}
${arrow(110, 128, 138, 100, topicId)}
${arrow(240, 68, 268, 68, topicId)}
${arrow(240, 128, 268, 128, topicId)}
${arrow(360, 68, 388, 68, topicId)}
${arrow(360, 128, 388, 128, topicId)}
${arrow(480, 128, 498, 100, topicId)}
<text x="330" y="38" text-anchor="middle" fill="${C.muted}" font-size="9" font-family="system-ui">TTL expires</text>
</svg>`,
  };
}

export function stateMachineDiagram(topicId, titleText, { states } = {}) {
  const s = states || [
    { x: 30, label: "Closed", sub: "requests pass", stroke: C.ok },
    { x: 190, label: "Open", sub: "fail fast", stroke: C.err },
    { x: 350, label: "Half-open", sub: "test probe", stroke: C.warn },
  ];
  const boxes = s.map((st) => box(st.x, 40, 100, 44, st.label, st.sub, st.stroke)).join("\n");
  return {
    id: "state-machine",
    caption: `${titleText}: state transitions — normal operation, failure isolation, and recovery probe.`,
    svg: `<svg viewBox="0 0 480 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} states">
${boxes}
<text x="130" y="30" text-anchor="middle" fill="${C.muted}" font-size="9" font-family="system-ui">failures ↑</text>
<text x="270" y="30" text-anchor="middle" fill="${C.muted}" font-size="9" font-family="system-ui">timeout</text>
<text x="400" y="30" text-anchor="middle" fill="${C.muted}" font-size="9" font-family="system-ui">success → closed</text>
</svg>`,
  };
}

export function requestFlowDiagram(topicId, titleText, { highlight, fanOut } = {}) {
  const hl = highlight || titleText.slice(0, 14);
  const id = fanOut ? "fan-out" : "request-flow";
  const nodes = fanOut
    ? `${box(10, 40, 72, 36, "Client", null, C.client)}
${box(100, 40, 88, 36, hl, "1 query", C.accent)}
${box(210, 20, 64, 32, "DB #1", null, C.ledger)}
${box(210, 55, 64, 32, "DB #2", null, C.ledger)}
${box(210, 90, 64, 32, "DB #N", null, C.ledger)}
${box(300, 40, 80, 36, "N+1 total", "1+N", C.err)}`
    : `${box(10, 40, 72, 36, "Client", null, C.client)}
${box(100, 40, 88, 36, hl, "this layer", C.accent)}
${box(206, 40, 80, 36, "Order", null, C.service)}
${box(304, 40, 84, 36, "Gateway", null, C.gateway)}
${box(406, 40, 72, 36, "Ledger", null, C.ledger)}`;
  const lines = fanOut
    ? `${arrow(82, 58, 98, 58, topicId)}
${arrow(188, 48, 208, 36, topicId)}
${arrow(188, 58, 208, 71, topicId)}
${arrow(188, 68, 208, 106, topicId)}
${arrow(274, 58, 298, 58, topicId)}`
    : `${arrow(82, 58, 98, 58, topicId)}
${arrow(188, 58, 204, 58, topicId)}
${arrow(286, 58, 302, 58, topicId)}
${arrow(388, 58, 404, 58, topicId)}`;
  return {
    id,
    caption: fanOut
      ? `${titleText}: one list query triggers N per-row lookups — classic ORM N+1 amplification.`
      : `${titleText} on the ingress path — client traffic flows through this layer to backend services.`,
    svg: `<svg viewBox="0 0 ${fanOut ? 400 : 500} 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} flow">
${defs(topicId)}
${title(fanOut ? "Query fan-out" : "Request flow", fanOut ? 200 : 250)}
${nodes}
${lines}
</svg>`,
  };
}

export function cacheFlowDiagram(topicId, titleText, { mode = "aside" } = {}) {
  const modes = {
    aside: { miss: "cache miss → DB", hit: "cache hit" },
    through: { miss: "read-through", hit: "write-through" },
    stampede: { miss: "thundering herd", hit: "single-flight" },
  };
  const m = modes[mode] || modes.aside;
  return {
    id: "cache-flow",
    caption: `${titleText}: ${m.miss} vs ${m.hit} — app, cache, and database interaction.`,
    svg: `<svg viewBox="0 0 520 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} cache">
${defs(topicId)}
${box(20, 50, 70, 36, "App", null, C.service)}
${box(130, 50, 80, 36, "Cache", mode === "stampede" ? "lock" : "Redis", C.warn)}
${box(250, 50, 70, 36, "DB", null, C.ledger)}
${box(360, 30, 130, 32, m.hit, null, C.ok)}
${box(360, 78, 130, 32, m.miss, null, mode === "stampede" ? C.err : C.accent)}
${arrow(90, 68, 128, 68, topicId)}
${arrow(210, 68, 248, 68, topicId)}
${arrow(130, 40, 358, 46, topicId)}
${arrow(210, 90, 358, 94, topicId)}
</svg>`,
  };
}

export function hashRingDiagram(topicId, titleText) {
  const nodes = [
    { label: "A", angle: -90 },
    { label: "B", angle: 30 },
    { label: "C", angle: 150 },
  ];
  const keys = [
    { label: "k1", angle: -45, owner: "B" },
    { label: "k2", angle: 90, owner: "C" },
    { label: "k3", angle: 200, owner: "A" },
  ];
  const cx = 200;
  const cy = 105;
  const r = 72;
  const pos = (deg, rad = r) => {
    const a = (deg * Math.PI) / 180;
    return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
  };
  const nodeEls = nodes.map((n) => {
    const p = pos(n.angle);
    return `${box(p.x - 28, p.y - 18, 56, 36, `Node ${n.label}`, "vnode", C.accent)}`;
  }).join("\n");
  const keyEls = keys.map((k) => {
    const kp = pos(k.angle, r - 18);
    const np = pos(nodes.find((n) => n.label === k.owner).angle);
    return `<circle cx="${kp.x}" cy="${kp.y}" r="5" fill="${C.client}"/>
<text x="${kp.x}" y="${kp.y - 9}" text-anchor="middle" fill="${C.muted}" font-size="8" font-family="system-ui">${k.label}</text>
<line x1="${kp.x}" y1="${kp.y}" x2="${np.x}" y2="${np.y}" stroke="${C.muted}" stroke-width="1" stroke-dasharray="3 2"/>`;
  }).join("\n");
  return {
    id: "hash-ring",
    caption: `${titleText}: keys sit on a hash ring — each maps clockwise to the nearest virtual node; add/remove shifts only adjacent ranges.`,
    svg: `<svg viewBox="0 0 400 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} ring">
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.muted}" stroke-width="1.5" stroke-dasharray="4 3"/>
${nodeEls}
${keyEls}
<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${C.ink}" font-size="10" font-family="system-ui">hash ring</text>
<text x="${cx}" y="198" text-anchor="middle" fill="${C.muted}" font-size="10" font-family="system-ui">key → clockwise nearest vnode</text>
</svg>`,
  };
}

export function quorumDiagram(topicId, titleText) {
  const cx = 240;
  const cy = 95;
  const r = 62;
  const replicas = ["R1", "R2", "R3", "R4", "R5"];
  const writeSet = new Set(["R1", "R2", "R3"]);
  const readSet = new Set(["R3", "R4", "R5"]);
  const pos = (i) => {
    const a = ((i / replicas.length) * 360 - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const ringNodes = replicas.map((id, i) => {
    const p = pos(i);
    const w = writeSet.has(id);
    const rd = readSet.has(id);
    const stroke = w && rd ? C.ok : w ? C.accent : rd ? C.ledger : C.muted;
    const sub = w && rd ? "W+R" : w ? "W" : rd ? "R" : "";
    return `${box(p.x - 24, p.y - 16, 48, 32, id, sub, stroke, 10)}`;
  }).join("\n");
  return {
    id: "quorum",
    caption: `${titleText}: N=5 replicas on a ring — W=3 write quorum and R=3 read quorum overlap at R3 so reads see the latest write.`,
    svg: `<svg viewBox="0 0 480 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} quorum">
${defs(topicId)}
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.muted}" stroke-width="1.5" stroke-dasharray="4 3"/>
${ringNodes}
${box(390, 55, 72, 40, "Client", "R=3", C.client)}
${arrow(390, 75, cx + r * Math.cos(54 * Math.PI / 180), cy + r * Math.sin(54 * Math.PI / 180), topicId)}
<text x="${cx}" y="18" text-anchor="middle" fill="${C.muted}" font-size="10" font-family="system-ui">N=5, W=3, R=3 → R+W &gt; N overlap</text>
</svg>`,
  };
}

export function consensusDiagram(topicId, titleText) {
  const cx = 250;
  const cy = 100;
  const r = 70;
  const nodes = [
    { id: "L", role: "Leader", leader: true },
    { id: "F1", role: "Follower", leader: false },
    { id: "F2", role: "Follower", leader: false },
    { id: "F3", role: "Follower", leader: false },
    { id: "F4", role: "Follower", leader: false },
  ];
  const pos = (i) => {
    const a = ((i / nodes.length) * 360 - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const nodeEls = nodes.map((n, i) => {
    const p = pos(i);
    const stroke = n.leader ? C.ok : C.service;
    const sub = n.leader ? "elected" : "follower";
    return `${box(p.x - 30, p.y - 18, 60, 36, n.id, sub, stroke, 10)}`;
  }).join("\n");
  const leader = pos(0);
  const followerArrows = [1, 2, 3, 4].map((i) => {
    const p = pos(i);
    return `<line x1="${leader.x}" y1="${leader.y}" x2="${p.x}" y2="${p.y}" stroke="${C.accent}" stroke-width="1.2" stroke-dasharray="4 2" marker-end="url(#${marker(topicId)})"/>`;
  }).join("\n");
  return {
    id: "consensus",
    caption: `${titleText}: one elected leader replicates log entries to a quorum of followers — partition blocks commit until a majority is reachable.`,
    svg: `<svg viewBox="0 0 500 185" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} consensus">
${defs(topicId)}
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.muted}" stroke-width="1.5" stroke-dasharray="4 3"/>
${nodeEls}
${followerArrows}
<text x="${cx}" y="18" text-anchor="middle" fill="${C.muted}" font-size="10" font-family="system-ui">Raft cluster — AppendEntries to quorum</text>
</svg>`,
  };
}

export function outboxFlowDiagram(topicId, titleText) {
  return {
    id: "outbox-flow",
    caption: `${titleText}: business row and outbox row commit atomically; relay publishes asynchronously.`,
    svg: `<svg viewBox="0 0 560 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} outbox">
${defs(topicId)}
${box(20, 50, 80, 40, "Order Svc", "txn", C.service)}
${box(130, 35, 70, 36, "Ledger", "UPDATE", C.ledger)}
${box(130, 85, 70, 36, "Outbox", "INSERT", C.queue)}
${box(240, 60, 90, 40, "COMMIT", "both", C.ok)}
${box(360, 60, 80, 40, "Relay", "poll", C.accent)}
${box(470, 60, 70, 40, "Queue", "Kafka", C.queue)}
${arrow(100, 53, 128, 53, topicId)}
${arrow(100, 103, 128, 103, topicId)}
${arrow(200, 80, 238, 80, topicId)}
${arrow(330, 80, 358, 80, topicId)}
${arrow(440, 80, 468, 80, topicId)}
<text x="165" y="28" text-anchor="middle" fill="${C.muted}" font-size="9" font-family="system-ui">single DB transaction</text>
</svg>`,
  };
}

export function comparisonDiagram(topicId, titleText, { left = "Option A", right = "Option B" } = {}) {
  return {
    id: "comparison",
    caption: `${titleText}: tradeoff comparison — when to choose each approach.`,
    svg: `<svg viewBox="0 0 480 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} comparison">
${box(40, 35, 160, 50, left, "pros / cons", C.accent)}
${box(280, 35, 160, 50, right, "pros / cons", C.service)}
<text x="240" y="105" text-anchor="middle" fill="${C.muted}" font-size="10" font-family="system-ui">vs</text>
</svg>`,
  };
}

export function capTriangleDiagram(topicId, titleText) {
  return {
    id: "cap-triangle",
    caption: `${titleText}: under partition, systems trade consistency (C) vs availability (A); partition tolerance (P) is assumed.`,
    svg: `<svg viewBox="0 0 360 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} CAP">
<polygon points="180,30 50,170 310,170" fill="${C.panel}" stroke="${C.muted}" stroke-width="1.5"/>
<text x="180" y="50" text-anchor="middle" fill="${C.ink}" font-size="12" font-family="system-ui">Consistency</text>
<text x="70" y="165" text-anchor="middle" fill="${C.ink}" font-size="12" font-family="system-ui">Availability</text>
<text x="290" y="165" text-anchor="middle" fill="${C.ink}" font-size="12" font-family="system-ui">Partition</text>
<text x="180" y="120" text-anchor="middle" fill="${C.muted}" font-size="10" font-family="system-ui">pick 2 under partition</text>
</svg>`,
  };
}

export function fanOutDiagram(topicId, titleText) {
  return requestFlowDiagram(topicId, titleText, { fanOut: true });
}

export function stampedeDiagram(topicId, titleText) {
  return cacheFlowDiagram(topicId, titleText, { mode: "stampede" });
}

export function messagingLoopDiagram(topicId, titleText) {
  return {
    id: "messaging-loop",
    caption: `${titleText}: poison or failing messages requeue indefinitely — consumer lag grows without DLQ.`,
    svg: `<svg viewBox="0 0 480 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} messaging">
${defs(topicId)}
${box(30, 40, 80, 40, "Queue", "retry", C.queue)}
${box(150, 40, 90, 40, "Consumer", "fails", C.err)}
${box(280, 40, 80, 40, "Requeue", "∞ loop", C.warn)}
${box(390, 40, 70, 40, "DLQ", "fix", C.ok)}
${arrow(110, 60, 148, 60, topicId)}
${arrow(240, 60, 278, 60, topicId)}
${arrow(360, 60, 88, 80, topicId)}
<text x="430" y="95" text-anchor="middle" fill="${C.muted}" font-size="9" font-family="system-ui">with DLQ → break loop</text>
</svg>`,
  };
}

export function architectureDiagram(topicId, titleText, { components } = {}) {
  const comps = components || ["Client", "API", "DB", "Cache", "Queue"];
  const boxes = comps.map((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return box(30 + col * 140, 40 + row * 55, 120, 44, c, null, [C.client, C.service, C.ledger, C.warn, C.queue][i % 5]);
  }).join("\n");
  return {
    id: "architecture",
    caption: `${titleText}: high-level components and data flow for the system design.`,
    svg: `<svg viewBox="0 0 460 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} architecture">
${title("System components", 230)}
${boxes}
</svg>`,
  };
}

export function tokenBucketDiagram(topicId, titleText) {
  return {
    id: "token-bucket",
    caption: `${titleText}: tokens refill at fixed rate; each request consumes one token or is rejected.`,
    svg: `<svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} bucket">
<rect x="80" y="40" width="120" height="70" rx="8" fill="${C.panel}" stroke="${C.accent}" stroke-width="1.5"/>
<text x="140" y="70" text-anchor="middle" fill="${C.ink}" font-size="11" font-family="system-ui">tokens: 7/10</text>
<text x="140" y="90" text-anchor="middle" fill="${C.muted}" font-size="9" font-family="system-ui">refill 10/s</text>
${arrow(30, 75, 78, 75, topicId)}
${box(10, 58, 50, 34, "request", null, C.client)}
${arrow(200, 75, 248, 75, topicId)}
${box(250, 58, 80, 34, "allow/deny", null, C.ok)}
</svg>`,
  };
}

export function sagaDiagram(topicId, titleText) {
  return {
    id: "saga-flow",
    caption: `${titleText}: forward steps with compensating transactions on failure — no global 2PC lock.`,
    svg: `<svg viewBox="0 0 520 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} saga">
${defs(topicId)}
${["Reserve", "Charge", "Ship"].map((s, i) => box(30 + i * 150, 40, 100, 40, s, i === 2 ? "fail" : "ok", i === 2 ? C.err : C.ok)).join("\n")}
${arrow(130, 60, 178, 60, topicId)}
${arrow(280, 60, 328, 60, topicId)}
<text x="400" y="95" text-anchor="middle" fill="${C.err}" font-size="9" font-family="system-ui">↩ compensate Charge, Reserve</text>
</svg>`,
  };
}

export function twoPcDiagram(topicId, titleText) {
  return {
    id: "two-pc",
    caption: `${titleText}: coordinator runs prepare (vote) then commit/abort across participants.`,
    svg: `<svg viewBox="0 0 480 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} 2PC">
${defs(topicId)}
${box(30, 40, 90, 40, "Coordinator", null, C.accent)}
${box(160, 30, 80, 32, "Prepare", "vote", C.warn)}
${box(160, 78, 80, 32, "Commit", "all yes", C.ok)}
${box(280, 40, 80, 40, "Participant A", null, C.service)}
${box(390, 40, 80, 40, "Participant B", null, C.service)}
${arrow(120, 60, 158, 46, topicId)}
${arrow(120, 60, 158, 94, topicId)}
${arrow(240, 46, 278, 55, topicId)}
${arrow(240, 94, 278, 65, topicId)}
</svg>`,
  };
}

export function clockDiagram(topicId, titleText, { kind = "lamport" } = {}) {
  return {
    id: "clock-ordering",
    caption: kind === "vector"
      ? `${titleText}: vector clocks track causal history per node — detect concurrent events.`
      : `${titleText}: Lamport clocks assign monotonic logical time — order events without synchronized wall clocks.`,
    svg: `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} clocks">
${["Node A", "Node B", "Node C"].map((n, i) => box(30 + i * 120, 40, 90, 40, n, kind === "vector" ? `[${i + 1},0,0]` : `L=${i + 3}`, C.accent)).join("\n")}
<text x="200" y="105" text-anchor="middle" fill="${C.muted}" font-size="10" font-family="system-ui">${kind === "vector" ? "vector timestamps" : "logical timestamps"}</text>
</svg>`,
  };
}

export function dominoDiagram(topicId, titleText) {
  return {
    id: "cascade",
    caption: `${titleText}: failure propagates through dependent services — isolate with bulkheads and timeouts.`,
    svg: `<svg viewBox="0 0 480 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} cascade">
${["Gateway", "Order", "Wallet", "Ledger"].map((s, i) => box(30 + i * 110, 35, 90, 40, s, i === 0 ? "down" : "overload", i === 0 ? C.err : C.warn)).join("\n")}
${arrow(120, 55, 138, 55, topicId)}
${arrow(230, 55, 248, 55, topicId)}
${arrow(340, 55, 358, 55, topicId)}
</svg>`,
  };
}

export function poolExhaustionDiagram(topicId, titleText) {
  return {
    id: "pool-exhaustion",
    caption: `${titleText}: all connections checked out — new requests block until timeout.`,
    svg: `<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} pool">
${Array.from({ length: 8 }, (_, i) => `<rect x="${30 + i * 42}" y="40" width="36" height="36" rx="4" fill="${C.panel}" stroke="${i < 8 ? C.err : C.ok}" stroke-width="1.5"/>`).join("")}
<text x="200" y="30" text-anchor="middle" fill="${C.muted}" font-size="10" font-family="system-ui">connection pool: 8/8 in use</text>
${box(30, 85, 120, 28, "waiting clients", "timeout", C.warn)}
</svg>`,
  };
}

export function slowConsumerDiagram(topicId, titleText) {
  return {
    id: "slow-consumer",
    caption: `${titleText}: consumer lag grows when processing rate < publish rate.`,
    svg: `<svg viewBox="0 0 420 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} lag">
${box(30, 35, 80, 40, "Producer", "fast", C.ok)}
${box(150, 35, 100, 40, "Queue depth", "lag ↑", C.err)}
${box(290, 35, 100, 40, "Consumer", "slow", C.warn)}
${arrow(110, 55, 148, 55, topicId)}
${arrow(250, 55, 288, 55, topicId)}
</svg>`,
  };
}

export function retryAmplificationDiagram(topicId, titleText) {
  return {
    id: "retry-amp",
    caption: `${titleText}: retries multiply load on a degraded backend — use backoff and circuit breakers.`,
    svg: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleText} retries">
${defs(topicId)}
${box(30, 40, 70, 36, "Client", "×3 retry", C.client)}
${box(130, 40, 90, 36, "Client", "×3 retry", C.client)}
${box(250, 40, 90, 36, "Backend", "overloaded", C.err)}
${arrow(100, 58, 128, 58, topicId)}
${arrow(100, 58, 128, 58, topicId)}
${arrow(220, 58, 248, 58, topicId)}
<text x="210" y="95" text-anchor="middle" fill="${C.muted}" font-size="10" font-family="system-ui">N clients × R retries = N×R load</text>
</svg>`,
  };
}

/** Ingress topics that legitimately use request-flow diagrams. */
export const INGRESS_TOPICS = new Set([
  "reverse-proxy", "api-gateway", "load-balancer-l4-l7", "cdn", "service-mesh",
  "tls-termination", "edge-rate-limiting", "service-discovery", "edge-compute",
  "websockets", "sse", "long-polling", "webhooks", "grpc", "http-evolution",
  "rest-vs-graphql", "tcp-udp-tradeoffs", "global-load-balancing",
]);
