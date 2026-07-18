/**
 * Unified registry — merges Production Failures, HLD, and LLD tracks.
 */
import { FAILURES_CATEGORIES } from "./registry-failures.js";
import { HLD_CATEGORIES } from "./registry-hld.js";
import { LLD_CATEGORIES } from "./registry-lld.js";

export const PAYMENT_CAST = [
  { key: "client", label: "Client / App", color: "#9aa7c7" },
  { key: "wallet", label: "Wallet (balance)", color: "#5b9dff" },
  { key: "order", label: "Order Service", color: "#7c5cff" },
  { key: "gateway", label: "Payment Gateway", color: "#ff8fab" },
  { key: "ledger", label: "Ledger / DB", color: "#3ddc97" },
  { key: "queue", label: "Event Queue", color: "#ffb454" },
];

export const TRACKS = [
  {
    id: "failures",
    title: "Production Failures",
    short: "Failures",
    desc: "Failure modes, concurrency traps, and production bugs in distributed systems.",
    categories: FAILURES_CATEGORIES.map((c) => ({ ...c, track: "failures" })),
  },
  {
    id: "hld",
    title: "High-Level Design",
    short: "HLD",
    desc: "System building blocks, architecture patterns, data platforms, and scale.",
    categories: HLD_CATEGORIES.map((c) => ({ ...c, track: "hld" })),
  },
  {
    id: "lld",
    title: "Low-Level Design",
    short: "LLD",
    desc: "OOP, design patterns, service/DB design, and async implementation patterns.",
    categories: LLD_CATEGORIES.map((c) => ({ ...c, track: "lld" })),
  },
  {
    id: "notes",
    title: "Private Notes",
    short: "Notes",
    desc: "Personal learning notes stored in your local Docker Postgres — not on GitHub Pages.",
    categories: [],
  },
];

/** @deprecated use TRACKS[0].categories */
export const CATEGORIES = TRACKS[0].categories;

const _topicIndex = new Map();
const _flat = [];
const _byTrack = { failures: [], hld: [], lld: [], notes: [] };

TRACKS.forEach((track) => {
  track.categories.forEach((cat) => {
    cat.topics.forEach((t) => {
      const entry = {
        ...t,
        track: track.id,
        category: cat,
        module: `./topics/${track.id}/${cat.id}/${t.id}.js`,
      };
      _topicIndex.set(t.id, entry);
      _flat.push(entry);
      _byTrack[track.id].push(entry);
    });
  });
});

export const FLAT_TOPICS = _flat;
export const TOPICS_BY_TRACK = _byTrack;

export function getTopic(id) { return _topicIndex.get(id); }

export function getTrack(id) { return TRACKS.find((t) => t.id === id) || null; }

export function neighbors(id) {
  const entry = _topicIndex.get(id);
  if (!entry) return { prev: null, next: null };
  const list = _byTrack[entry.track] || _flat;
  const i = list.findIndex((t) => t.id === id);
  return {
    prev: i > 0 ? list[i - 1] : null,
    next: i >= 0 && i < list.length - 1 ? list[i + 1] : null,
  };
}

export const TOPIC_COUNT = _flat.length;
export const FAILURES_COUNT = _byTrack.failures.length;
export const HLD_COUNT = _byTrack.hld.length;
export const LLD_COUNT = _byTrack.lld.length;

/** @deprecated use FAILURES_COUNT */
export const BACKEND_COUNT = FAILURES_COUNT;

export function hiddenGems(trackId) {
  const list = trackId ? (_byTrack[trackId] || []) : _flat;
  return list.filter((t) => t.tier === "hidden-gem");
}
