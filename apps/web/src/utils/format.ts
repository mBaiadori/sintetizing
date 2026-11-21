import type { DocUniverse } from "@sintetizing/wire";

export const GENERAL_CATEGORY_ID = "__general__";

export function shortHex(hex: string): string {
  return hex.length > 14 ? `${hex.slice(0, 8)}...${hex.slice(-4)}` : hex;
}

export function getInitials(label: string | null | undefined, fallback = "SZ"): string {
  if (!label) {
    return fallback;
  }
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return fallback;
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function formatDateMs(ms: number | null): string {
  if (!ms) {
    return "sem data";
  }
  return new Date(ms).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function universeChipClass(universe: DocUniverse): string {
  switch (universe) {
    case "cmnt":
      return "chip chip--cmnt";
    case "memb":
      return "chip chip--memb";
    case "stze":
      return "chip chip--stze";
    case "snap":
      return "chip chip--snap";
  }
}

export interface HeatInfo {
  readonly quorumProgressPct: number;
  readonly quorumReached: boolean;
}

export function computeHeatInfo(pickCount: number, requiredVotes: number): HeatInfo {
  const quorumProgressPct =
    requiredVotes > 0 ? Math.min(100, Math.round((pickCount / requiredVotes) * 100)) : 0;
  return {
    quorumProgressPct,
    quorumReached: requiredVotes > 0 && pickCount >= requiredVotes,
  };
}
