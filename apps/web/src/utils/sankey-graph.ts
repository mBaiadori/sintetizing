import type {
  CommunityConfigVersion,
  CommunityProjection,
  ProposalSummaryView,
  SubjectSummaryView,
} from "@sintetizing/domain";
import { computeHeatInfo, GENERAL_CATEGORY_ID } from "./format.js";

export type GraphFocus =
  | { readonly kind: "community" }
  | { readonly kind: "category"; readonly categoryId: string }
  | {
      readonly kind: "subject";
      readonly categoryId: string;
      readonly subjectScope: string;
    };

export type ArmSide = "left" | "right";
export type ArmTone = "consensus" | "primary" | "warning" | "muted";
export type ConnectorKind = "bezier" | "vertical-dashed" | "sub-bezier";

export type GraphNodeEntity =
  | {
      readonly kind: "category";
      readonly categoryId: string;
      readonly title: string;
      readonly body: string;
      readonly subjectCount: number;
      readonly proposalCount: number;
      readonly totalPicks: number;
      readonly consensusCount: number;
    }
  | {
      readonly kind: "subject";
      readonly categoryId: string;
      readonly categoryTitle: string;
      readonly subject: SubjectSummaryView;
      readonly proposalCount: number;
      readonly totalPicks: number;
      readonly requiredVotes: number;
      readonly leadingProposal: ProposalSummaryView | null;
      readonly quorumProgressPct: number;
      readonly quorumReached: boolean;
    }
  | {
      readonly kind: "proposal";
      readonly categoryId: string;
      readonly categoryTitle: string;
      readonly subject: SubjectSummaryView | null;
      readonly proposal: ProposalSummaryView;
      readonly requiredVotes: number;
      readonly quorumProgressPct: number;
      readonly quorumReached: boolean;
      readonly isMyPick: boolean;
      readonly parentProposal: ProposalSummaryView | null;
      readonly childForks: readonly ProposalSummaryView[];
    }
  | {
      readonly kind: "config";
      readonly version: CommunityConfigVersion;
    };

export interface GraphArmNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly side: ArmSide;
  readonly depth: number;
  readonly x: number;
  readonly y: number;
  readonly parentX: number;
  readonly parentY: number;
  readonly connectorKind: ConnectorKind;
  readonly strokeWidth: number;
  readonly tone: ArmTone;
  readonly label: string;
  readonly metaLabel: string | null;
  readonly countBadge: number | null;
  readonly isCheckmark: boolean;
  readonly isMyPick: boolean;
  readonly isLeader: boolean;
  readonly isFork: boolean;
  readonly entity: GraphNodeEntity;
}

export interface SpineNode {
  readonly id: string;
  readonly y: number;
  readonly label: string;
  readonly subLabel: string | null;
  readonly labelSide: ArmSide;
  readonly status: "head" | "milestone" | "genesis";
  readonly entity: GraphNodeEntity | null;
}

export interface GraphTreeLayout {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly spineX: number;
  readonly spineTopY: number;
  readonly spineBottomY: number;
  readonly topPill: {
    readonly label: string;
    readonly subLabel: string;
    readonly tone: "primary" | "consensus";
    readonly focusTarget: GraphFocus;
  };
  readonly spineNodes: readonly SpineNode[];
  readonly nodes: readonly GraphArmNode[];
}

export interface GraphSummaryStats {
  readonly categoriesCount: number;
  readonly subjectsCount: number;
  readonly proposalsCount: number;
  readonly forksCount: number;
  readonly totalPicks: number;
  readonly consensusCount: number;
  readonly leaderPct: number;
}

export interface SankeyGraphLayout {
  readonly width: number;
  readonly height: number;
  readonly trees: readonly GraphTreeLayout[];
  readonly stats: GraphSummaryStats;
}

export interface BuildGraphOptions {
  readonly projection: CommunityProjection;
  readonly communityTitle: string;
  readonly myPubHex: string;
  readonly focus: GraphFocus;
  readonly showProposals: boolean;
  readonly nodeSpacing: number;
  readonly searchQuery: string;
}

interface ProposalTreeItem {
  readonly proposal: ProposalSummaryView;
  readonly children: readonly ProposalTreeItem[];
}

interface SpacingMetrics {
  readonly rowStep: number;
  readonly groupGap: number;
  readonly spineMinGap: number;
}

const SINGLE_TREE_WIDTH = 960;
const CATEGORY_TREE_WIDTH = 780;
const SUB_INDENT = 24;
const TOP_PILL_Y = 42;
const SPINE_TOP_Y = 86;
const FIRST_BRANCH_Y = 144;
const BOTTOM_PADDING = 68;
const TREE_GRID_GAP_X = 64;
const TREE_GRID_GAP_Y = 64;
const TREE_GRID_COLS = 3;

function computeMetrics(nodeSpacing: number): SpacingMetrics {
  const clamped = Math.max(6, Math.min(44, nodeSpacing));
  return {
    rowStep: 28 + clamped,
    groupGap: Math.max(10, Math.round(clamped * 1.1)),
    spineMinGap: 24 + clamped,
  };
}

function truncateLabel(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function computeArmWidth(weight: number, maxWeight: number, depth: number): number {
  const safeMax = Math.max(1, maxWeight);
  const ratio = weight > 0 ? Math.min(1, weight / safeMax) : 0;
  if (depth === 0) {
    return Number((2.25 + ratio * 4.25).toFixed(2));
  }
  return Number((1.75 + ratio * 2.5).toFixed(2));
}

export function getArmPath(node: GraphArmNode): string {
  const { parentX: x1, parentY: y1, x: x2, y: y2, connectorKind } = node;
  if (connectorKind === "vertical-dashed") {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  if (connectorKind === "sub-bezier") {
    const midY = y1 + (y2 - y1) * 0.6;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x1} ${y2}, ${x2} ${y2}`;
  }
  if (Math.abs(y2 - y1) < 2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const dx = x2 - x1;
  const cx1 = x1 + dx * 0.54;
  const cx2 = x1 + dx * 0.46;
  return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
}

function buildProposalForest(
  proposals: readonly ProposalSummaryView[],
): readonly ProposalTreeItem[] {
  const byId = new Map<string, ProposalSummaryView>();
  for (const prop of proposals) {
    byId.set(prop.docIdHex, prop);
  }

  const childrenMap = new Map<string, ProposalSummaryView[]>();
  const roots: ProposalSummaryView[] = [];

  for (const prop of proposals) {
    if (
      prop.parentHashHex &&
      byId.has(prop.parentHashHex) &&
      prop.parentHashHex !== prop.docIdHex
    ) {
      const list = childrenMap.get(prop.parentHashHex);
      if (list) {
        list.push(prop);
      } else {
        childrenMap.set(prop.parentHashHex, [prop]);
      }
    } else {
      roots.push(prop);
    }
  }

  const sortChildren = (a: ProposalSummaryView, b: ProposalSummaryView) =>
    b.pickCount - a.pickCount || a.timestampMs - b.timestampMs;

  const visited = new Set<string>();
  const buildNode = (prop: ProposalSummaryView): ProposalTreeItem => {
    visited.add(prop.docIdHex);
    const rawChildren = [...(childrenMap.get(prop.docIdHex) ?? [])].sort(sortChildren);
    const children: ProposalTreeItem[] = [];
    for (const child of rawChildren) {
      if (!visited.has(child.docIdHex)) {
        children.push(buildNode(child));
      }
    }
    return { proposal: prop, children };
  };

  const sortedRoots = [...roots].sort(
    (a, b) => b.timestampMs - a.timestampMs || b.pickCount - a.pickCount,
  );
  return sortedRoots.map(buildNode);
}

function resolveCategoryLookup(projection: CommunityProjection) {
  const map = new Map<string, { id: string; title: string; body: string }>();
  for (const cat of projection.categories) {
    map.set(cat.docIdHex, { id: cat.docIdHex, title: cat.title, body: cat.body });
  }
  return (categoryHashHex: string | null) => {
    if (categoryHashHex) {
      const matched = map.get(categoryHashHex);
      if (matched) {
        return matched;
      }
    }
    return {
      id: GENERAL_CATEGORY_ID,
      title: "Geral",
      body: "Assuntos gerais da comunidade.",
    };
  };
}

function computeRequiredVotes(activeMembers: number, quorumPct: number): number {
  return Math.max(1, Math.ceil((activeMembers * quorumPct) / 100));
}

function matchesQuery(
  query: string,
  ...fields: Array<string | null | undefined>
): boolean {
  if (!query) {
    return true;
  }
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

interface CursorState {
  leftY: number;
  rightY: number;
  lastSpineY: number;
}

function pickNextSide(
  cursors: CursorState,
  index: number,
  rowStep: number,
): ArmSide {
  if (Math.abs(cursors.leftY - cursors.rightY) <= rowStep * 0.5) {
    return index % 2 === 0 ? "left" : "right";
  }
  return cursors.leftY <= cursors.rightY ? "left" : "right";
}

function computeArmX(
  spineX: number,
  armSpan: number,
  side: ArmSide,
  depth: number,
): number {
  const dir = side === "left" ? -1 : 1;
  const clampedStep = Math.max(0, Math.min(2, depth - 1));
  return spineX + dir * (armSpan + clampedStep * SUB_INDENT);
}

function createProposalNode(params: {
  id: string;
  parentId: string | null;
  side: ArmSide;
  depth: number;
  x: number;
  y: number;
  parentX: number;
  parentY: number;
  connectorKind: ConnectorKind;
  maxWeight: number;
  proposal: ProposalSummaryView;
  subject: SubjectSummaryView | null;
  categoryId: string;
  categoryTitle: string;
  requiredVotes: number;
  leadingId: string | null;
  myPubHex: string;
  proposalById: ReadonlyMap<string, ProposalSummaryView>;
  childrenByParent: ReadonlyMap<string, readonly ProposalSummaryView[]>;
}): GraphArmNode {
  const {
    id,
    parentId,
    side,
    depth,
    x,
    y,
    parentX,
    parentY,
    connectorKind,
    maxWeight,
    proposal,
    subject,
    categoryId,
    categoryTitle,
    requiredVotes,
    leadingId,
    myPubHex,
    proposalById,
    childrenByParent,
  } = params;

  const heat = computeHeatInfo(proposal.pickCount, requiredVotes);
  const isMyPick = proposal.supporterPubs.includes(myPubHex);
  const isLeader = proposal.docIdHex === leadingId && proposal.pickCount > 0;
  const isFork = proposal.parentHashHex !== null;

  const tone: ArmTone = heat.quorumReached
    ? "consensus"
    : isLeader
      ? "primary"
      : proposal.pickCount > 0 || isFork
        ? "warning"
        : "muted";

  const parentProposal = proposal.parentHashHex
    ? (proposalById.get(proposal.parentHashHex) ?? null)
    : null;
  const childForks = childrenByParent.get(proposal.docIdHex) ?? [];

  return {
    id,
    parentId,
    side,
    depth,
    x,
    y,
    parentX,
    parentY,
    connectorKind,
    strokeWidth: computeArmWidth(proposal.pickCount, maxWeight, depth),
    tone,
    label: proposal.title,
    metaLabel: isFork ? "Síntese" : null,
    countBadge: proposal.pickCount > 0 ? proposal.pickCount : null,
    isCheckmark: heat.quorumReached,
    isMyPick,
    isLeader,
    isFork,
    entity: {
      kind: "proposal",
      categoryId,
      categoryTitle,
      subject,
      proposal,
      requiredVotes,
      quorumProgressPct: heat.quorumProgressPct,
      quorumReached: heat.quorumReached,
      isMyPick,
      parentProposal,
      childForks,
    },
  };
}

function indexProposals(proposals: readonly ProposalSummaryView[]) {
  const byScope = new Map<string, ProposalSummaryView[]>();
  const byId = new Map<string, ProposalSummaryView>();
  const childrenByParent = new Map<string, ProposalSummaryView[]>();

  for (const prop of proposals) {
    byId.set(prop.docIdHex, prop);
    const scopeList = byScope.get(prop.scope);
    if (scopeList) {
      scopeList.push(prop);
    } else {
      byScope.set(prop.scope, [prop]);
    }
    if (prop.parentHashHex) {
      const childList = childrenByParent.get(prop.parentHashHex);
      if (childList) {
        childList.push(prop);
      } else {
        childrenByParent.set(prop.parentHashHex, [prop]);
      }
    }
  }

  for (const list of byScope.values()) {
    list.sort((a, b) => b.pickCount - a.pickCount || b.timestampMs - a.timestampMs);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => b.pickCount - a.pickCount || a.timestampMs - b.timestampMs);
  }

  return { byScope, byId, childrenByParent };
}

function buildSingleCategoryTree(params: {
  projection: CommunityProjection;
  categoryId: string;
  categoryTitle: string;
  categoryTimestampMs: number | null;
  myPubHex: string;
  showProposals: boolean;
  metrics: SpacingMetrics;
  searchQuery: string;
  treeWidth: number;
  armSpan: number;
}): { tree: GraphTreeLayout; stats: GraphSummaryStats } {
  const {
    projection,
    categoryId,
    categoryTitle,
    categoryTimestampMs,
    myPubHex,
    showProposals,
    metrics,
    searchQuery,
    treeWidth,
    armSpan,
  } = params;

  const spineX = Math.round(treeWidth / 2);
  const query = searchQuery.trim().toLowerCase();
  const resolveCategory = resolveCategoryLookup(projection);
  const { byScope, byId, childrenByParent } = indexProposals(projection.proposals);

  const catSubjects = projection.subjects
    .filter((s) => resolveCategory(s.categoryHashHex).id === categoryId)
    .filter((s) => {
      if (!query) {
        return true;
      }
      const props = byScope.get(s.scope) ?? [];
      return (
        matchesQuery(query, categoryTitle, s.title, s.body) ||
        props.some((p) => matchesQuery(query, p.title, p.body, p.authorName))
      );
    })
    .sort((a, b) => b.timestampMs - a.timestampMs);

  const maxPropWeight = Math.max(1, ...projection.proposals.map((p) => p.pickCount));
  const cursors: CursorState = {
    leftY: FIRST_BRANCH_Y,
    rightY: FIRST_BRANCH_Y + Math.round(metrics.rowStep * 0.55),
    lastSpineY: SPINE_TOP_Y + 18,
  };

  const spineNodes: SpineNode[] = [
    {
      id: `spine-head-${categoryId}`,
      y: SPINE_TOP_Y + 12,
      label: categoryTitle,
      subLabel: `${catSubjects.length} assunto(s)`,
      labelSide: "right",
      status: "head",
      entity: null,
    },
  ];
  const nodes: GraphArmNode[] = [];

  let totalProposals = 0;
  let totalForks = 0;
  let totalPicks = 0;
  let consensusCount = 0;

  catSubjects.forEach((subj, idx) => {
    const subjProps = byScope.get(subj.scope) ?? [];
    const req = computeRequiredVotes(projection.activeMemberCount, subj.quorumPct);
    const leader = subjProps[0] ?? null;
    const heat = computeHeatInfo(leader?.pickCount ?? 0, req);
    const subjPicks = subjProps.reduce((acc, p) => acc + p.pickCount, 0);

    totalProposals += subjProps.length;
    totalForks += subjProps.filter((p) => p.parentHashHex !== null).length;
    totalPicks += subjPicks;
    if (heat.quorumReached) {
      consensusCount += 1;
    }

    const side = pickNextSide(cursors, idx, metrics.rowStep);
    const branchY = side === "left" ? cursors.leftY : cursors.rightY;
    const anchorY = Math.max(cursors.lastSpineY + metrics.spineMinGap, branchY);
    cursors.lastSpineY = anchorY;

    const subjX = computeArmX(spineX, armSpan, side, 0);
    const subjNodeId = `subj-${subj.scope}`;

    spineNodes.push({
      id: `spine-subj-${subj.scope}`,
      y: anchorY,
      label: formatShortDate(subj.timestampMs),
      subLabel: `Quórum ${subj.quorumPct}%`,
      labelSide: side === "left" ? "right" : "left",
      status: "milestone",
      entity: null,
    });

    nodes.push({
      id: subjNodeId,
      parentId: null,
      side,
      depth: 0,
      x: subjX,
      y: branchY,
      parentX: spineX,
      parentY: anchorY,
      connectorKind: "bezier",
      strokeWidth: computeArmWidth(subjPicks + subjProps.length, maxPropWeight + 4, 0),
      tone: heat.quorumReached
        ? "consensus"
        : subjProps.length > 0
          ? "primary"
          : "muted",
      label: subj.title,
      metaLabel: subjProps.length > 0 ? `${heat.quorumProgressPct}%` : null,
      countBadge: subjProps.length > 0 ? subjProps.length : null,
      isCheckmark: heat.quorumReached,
      isMyPick: subjProps.some((p) => p.supporterPubs.includes(myPubHex)),
      isLeader: false,
      isFork: false,
      entity: {
        kind: "subject",
        categoryId,
        categoryTitle,
        subject: subj,
        proposalCount: subjProps.length,
        totalPicks: subjPicks,
        requiredVotes: req,
        leadingProposal: leader,
        quorumProgressPct: heat.quorumProgressPct,
        quorumReached: heat.quorumReached,
      },
    });

    let cursorY = branchY + metrics.rowStep;

    if (showProposals && subjProps.length > 0) {
      const forest = buildProposalForest(subjProps);

      const placeForestItem = (
        item: ProposalTreeItem,
        depth: number,
        parentId: string,
        anchorX: number,
        anchorYPos: number,
      ): { x: number; y: number } => {
        const nodeX = computeArmX(spineX, armSpan, side, depth);
        const nodeY = cursorY;
        const nodeId = `prop-${item.proposal.docIdHex}`;
        const connector: ConnectorKind =
          Math.abs(nodeX - anchorX) < 1 ? "vertical-dashed" : "sub-bezier";

        nodes.push(
          createProposalNode({
            id: nodeId,
            parentId,
            side,
            depth,
            x: nodeX,
            y: nodeY,
            parentX: anchorX,
            parentY: anchorYPos,
            connectorKind: connector,
            maxWeight: maxPropWeight,
            proposal: item.proposal,
            subject: subj,
            categoryId,
            categoryTitle,
            requiredVotes: req,
            leadingId: leader?.docIdHex ?? null,
            myPubHex,
            proposalById: byId,
            childrenByParent,
          }),
        );
        cursorY += metrics.rowStep;

        const childAnchorX = nodeX;
        const childAnchorY = nodeY;
        for (const child of item.children) {
          const nextDepth = Math.min(2, depth + 1);
          placeForestItem(child, nextDepth, nodeId, childAnchorX, childAnchorY);
        }
        return { x: nodeX, y: nodeY };
      };

      let prevRootX = subjX;
      let prevRootY = branchY;
      for (const root of forest) {
        const placed = placeForestItem(root, 1, subjNodeId, prevRootX, prevRootY);
        prevRootX = placed.x;
        prevRootY = placed.y;
      }
    }

    const nextY = cursorY + metrics.groupGap;
    if (side === "left") {
      cursors.leftY = nextY;
    } else {
      cursors.rightY = nextY;
    }
  });

  const genesisY =
    Math.max(cursors.leftY, cursors.rightY, cursors.lastSpineY + 40) + 18;
  spineNodes.push({
    id: `spine-genesis-${categoryId}`,
    y: genesisY,
    label: categoryTimestampMs ? "Categoria criada" : "Categoria Geral",
    subLabel: categoryTimestampMs ? formatShortDate(categoryTimestampMs) : null,
    labelSide: "right",
    status: "genesis",
    entity: null,
  });

  return {
    tree: {
      id: `tree-cat-${categoryId}`,
      x: 0,
      y: 0,
      width: treeWidth,
      height: genesisY + BOTTOM_PADDING,
      spineX,
      spineTopY: SPINE_TOP_Y,
      spineBottomY: genesisY,
      topPill: {
        label: `${truncateLabel(categoryTitle, 24)}`,
        subLabel: `${catSubjects.length} assunto(s) · ${totalProposals} proposta(s)`,
        tone: consensusCount > 0 ? "consensus" : "primary",
        focusTarget: { kind: "category", categoryId },
      },
      spineNodes,
      nodes,
    },
    stats: {
      categoriesCount: 1,
      subjectsCount: catSubjects.length,
      proposalsCount: totalProposals,
      forksCount: totalForks,
      totalPicks,
      consensusCount,
      leaderPct: 0,
    },
  };
}

function buildCommunityForest(options: BuildGraphOptions): SankeyGraphLayout {
  const { projection, myPubHex, showProposals, nodeSpacing, searchQuery } = options;
  const metrics = computeMetrics(nodeSpacing);
  const query = searchQuery.trim().toLowerCase();
  const resolveCategory = resolveCategoryLookup(projection);

  const subjectsByCategory = new Map<string, SubjectSummaryView[]>();
  for (const subj of projection.subjects) {
    const cat = resolveCategory(subj.categoryHashHex);
    const list = subjectsByCategory.get(cat.id);
    if (list) {
      list.push(subj);
    } else {
      subjectsByCategory.set(cat.id, [subj]);
    }
  }

  const categoryEntries: Array<{
    id: string;
    title: string;
    timestampMs: number | null;
  }> = projection.categories.map((c) => ({
    id: c.docIdHex,
    title: c.title,
    timestampMs: c.timestampMs,
  }));

  if (subjectsByCategory.has(GENERAL_CATEGORY_ID) || categoryEntries.length === 0) {
    categoryEntries.unshift({
      id: GENERAL_CATEGORY_ID,
      title: "Geral",
      timestampMs: null,
    });
  }

  const builtTrees: GraphTreeLayout[] = [];
  let totalSubjects = 0;
  let totalProposals = 0;
  let totalForks = 0;
  let totalPicks = 0;
  let totalConsensus = 0;

  for (const cat of categoryEntries) {
    const built = buildSingleCategoryTree({
      projection,
      categoryId: cat.id,
      categoryTitle: cat.title,
      categoryTimestampMs: cat.timestampMs,
      myPubHex,
      showProposals,
      metrics,
      searchQuery,
      treeWidth: CATEGORY_TREE_WIDTH,
      armSpan: 155,
    });

    if (query && built.tree.nodes.length === 0 && !matchesQuery(query, cat.title)) {
      continue;
    }

    builtTrees.push(built.tree);
    totalSubjects += built.stats.subjectsCount;
    totalProposals += built.stats.proposalsCount;
    totalForks += built.stats.forksCount;
    totalPicks += built.stats.totalPicks;
    totalConsensus += built.stats.consensusCount;
  }

  // Arrange each category tree in a balanced multi-column grid
  const cols = Math.max(1, Math.min(TREE_GRID_COLS, builtTrees.length));
  const rowHeights: number[] = [];
  for (let i = 0; i < builtTrees.length; i += cols) {
    const slice = builtTrees.slice(i, i + cols);
    rowHeights.push(Math.max(...slice.map((t) => t.height)));
  }

  const positionedTrees: GraphTreeLayout[] = [];
  let currentY = 0;
  for (let row = 0; row < rowHeights.length; row += 1) {
    const rowSlice = builtTrees.slice(row * cols, (row + 1) * cols);
    rowSlice.forEach((tree, colIdx) => {
      positionedTrees.push({
        ...tree,
        x: colIdx * (CATEGORY_TREE_WIDTH + TREE_GRID_GAP_X),
        y: currentY,
      });
    });
    currentY += rowHeights[row]! + TREE_GRID_GAP_Y;
  }

  const totalWidth =
    cols * CATEGORY_TREE_WIDTH + Math.max(0, cols - 1) * TREE_GRID_GAP_X;
  const totalHeight = Math.max(360, currentY - TREE_GRID_GAP_Y);

  return {
    width: totalWidth,
    height: totalHeight,
    trees: positionedTrees,
    stats: {
      categoriesCount: positionedTrees.length,
      subjectsCount: totalSubjects,
      proposalsCount: totalProposals,
      forksCount: totalForks,
      totalPicks,
      consensusCount: totalConsensus,
      leaderPct: 0,
    },
  };
}

function buildCategoryFocusedGraph(
  options: BuildGraphOptions,
  categoryId: string,
): SankeyGraphLayout {
  const { projection, myPubHex, showProposals, nodeSpacing, searchQuery } = options;
  const metrics = computeMetrics(nodeSpacing);
  const catObj =
    categoryId === GENERAL_CATEGORY_ID
      ? null
      : (projection.categories.find((c) => c.docIdHex === categoryId) ?? null);

  const built = buildSingleCategoryTree({
    projection,
    categoryId,
    categoryTitle: catObj ? catObj.title : "Geral",
    categoryTimestampMs: catObj ? catObj.timestampMs : null,
    myPubHex,
    showProposals,
    metrics,
    searchQuery,
    treeWidth: SINGLE_TREE_WIDTH,
    armSpan: 185,
  });

  return {
    width: built.tree.width,
    height: built.tree.height,
    trees: [built.tree],
    stats: built.stats,
  };
}

function buildSubjectEvolutionGraph(
  options: BuildGraphOptions,
  categoryId: string,
  subjectScope: string,
): SankeyGraphLayout {
  const { projection, myPubHex, nodeSpacing, searchQuery } = options;
  const metrics = computeMetrics(nodeSpacing);
  const query = searchQuery.trim().toLowerCase();
  const resolveCategory = resolveCategoryLookup(projection);
  const { byScope, byId, childrenByParent } = indexProposals(projection.proposals);

  const subject = projection.subjects.find((s) => s.scope === subjectScope) ?? null;
  if (!subject) {
    return buildCommunityForest(options);
  }

  const spineX = Math.round(SINGLE_TREE_WIDTH / 2);
  const armSpan = 185;
  const catInfo = resolveCategory(subject.categoryHashHex);
  const allProps = byScope.get(subject.scope) ?? [];
  const requiredVotes = computeRequiredVotes(
    projection.activeMemberCount,
    subject.quorumPct,
  );
  const leader = allProps[0] ?? null;
  const leaderHeat = computeHeatInfo(leader?.pickCount ?? 0, requiredVotes);
  const maxWeight = Math.max(1, ...allProps.map((p) => p.pickCount));

  const visibleProps = query
    ? allProps.filter((p) => matchesQuery(query, p.title, p.body, p.authorName))
    : allProps;

  const forest = buildProposalForest(visibleProps);
  const cursors: CursorState = {
    leftY: FIRST_BRANCH_Y,
    rightY: FIRST_BRANCH_Y + Math.round(metrics.rowStep * 0.55),
    lastSpineY: SPINE_TOP_Y + 20,
  };

  const spineNodes: SpineNode[] = [
    {
      id: "spine-head",
      y: SPINE_TOP_Y + 12,
      label: leader ? truncateLabel(leader.title, 26) : "Sem propostas",
      subLabel: leader
        ? `${leader.pickCount}/${requiredVotes} apoios (${leaderHeat.quorumProgressPct}%)`
        : `Mín. ${requiredVotes} apoio(s)`,
      labelSide: "right",
      status: "head",
      entity: leader
        ? {
            kind: "proposal",
            categoryId: catInfo.id,
            categoryTitle: catInfo.title,
            subject,
            proposal: leader,
            requiredVotes,
            quorumProgressPct: leaderHeat.quorumProgressPct,
            quorumReached: leaderHeat.quorumReached,
            isMyPick: leader.supporterPubs.includes(myPubHex),
            parentProposal: leader.parentHashHex
              ? (byId.get(leader.parentHashHex) ?? null)
              : null,
            childForks: childrenByParent.get(leader.docIdHex) ?? [],
          }
        : null,
    },
  ];
  const nodes: GraphArmNode[] = [];
  const totalRoots = forest.length;

  forest.forEach((rootItem, idx) => {
    const side = pickNextSide(cursors, idx, metrics.rowStep);
    const branchY = side === "left" ? cursors.leftY : cursors.rightY;
    const anchorY = Math.max(cursors.lastSpineY + metrics.spineMinGap, branchY);
    cursors.lastSpineY = anchorY;

    const rootX = computeArmX(spineX, armSpan, side, 0);
    const rootNodeId = `prop-${rootItem.proposal.docIdHex}`;
    const chronoNumber = totalRoots - idx;
    const authorShort = rootItem.proposal.authorName
      ? rootItem.proposal.authorName.split(" ")[0]
      : "Membro";

    spineNodes.push({
      id: `spine-prop-${rootItem.proposal.docIdHex}`,
      y: anchorY,
      label: `#${chronoNumber} · ${authorShort}`,
      subLabel: formatShortDate(rootItem.proposal.timestampMs),
      labelSide: side === "left" ? "right" : "left",
      status: "milestone",
      entity: null,
    });

    const sumTreePicks = (item: ProposalTreeItem): number =>
      item.proposal.pickCount +
      item.children.reduce((s, c) => s + sumTreePicks(c), 0);
    const subtreePicks = sumTreePicks(rootItem);

    const rootNode = createProposalNode({
      id: rootNodeId,
      parentId: null,
      side,
      depth: 0,
      x: rootX,
      y: branchY,
      parentX: spineX,
      parentY: anchorY,
      connectorKind: "bezier",
      maxWeight: Math.max(maxWeight, subtreePicks),
      proposal: rootItem.proposal,
      subject,
      categoryId,
      categoryTitle: catInfo.title,
      requiredVotes,
      leadingId: leader?.docIdHex ?? null,
      myPubHex,
      proposalById: byId,
      childrenByParent,
    });

    nodes.push({
      ...rootNode,
      strokeWidth: computeArmWidth(
        subtreePicks,
        Math.max(maxWeight, subtreePicks),
        0,
      ),
    });

    let cursorY = branchY + metrics.rowStep;

    const placeFork = (
      item: ProposalTreeItem,
      depth: number,
      parentId: string,
      anchorX: number,
      anchorYPos: number,
    ): void => {
      const forkX = computeArmX(spineX, armSpan, side, depth);
      const forkY = cursorY;
      const forkId = `prop-${item.proposal.docIdHex}`;
      const connector: ConnectorKind =
        Math.abs(forkX - anchorX) < 1 ? "vertical-dashed" : "sub-bezier";

      nodes.push(
        createProposalNode({
          id: forkId,
          parentId,
          side,
          depth,
          x: forkX,
          y: forkY,
          parentX: anchorX,
          parentY: anchorYPos,
          connectorKind: connector,
          maxWeight,
          proposal: item.proposal,
          subject,
          categoryId,
          categoryTitle: catInfo.title,
          requiredVotes,
          leadingId: leader?.docIdHex ?? null,
          myPubHex,
          proposalById: byId,
          childrenByParent,
        }),
      );
      cursorY += metrics.rowStep;

      for (const grandChild of item.children) {
        placeFork(grandChild, Math.min(2, depth + 1), forkId, forkX, forkY);
      }
    };

    for (const child of rootItem.children) {
      placeFork(child, 1, rootNodeId, rootX, branchY);
    }

    const nextY = cursorY + metrics.groupGap;
    if (side === "left") {
      cursors.leftY = nextY;
    } else {
      cursors.rightY = nextY;
    }
  });

  const genesisY =
    Math.max(cursors.leftY, cursors.rightY, cursors.lastSpineY + 42) + 20;
  spineNodes.push({
    id: "spine-genesis",
    y: genesisY,
    label: "Abertura do Assunto",
    subLabel: formatShortDate(subject.timestampMs),
    labelSide: "right",
    status: "genesis",
    entity: null,
  });

  const totalPicks = allProps.reduce((acc, p) => acc + p.pickCount, 0);
  const consensusCount = allProps.filter(
    (p) => p.pickCount >= requiredVotes,
  ).length;

  const tree: GraphTreeLayout = {
    id: `tree-subj-${subject.scope}`,
    x: 0,
    y: 0,
    width: SINGLE_TREE_WIDTH,
    height: genesisY + BOTTOM_PADDING,
    spineX,
    spineTopY: SPINE_TOP_Y,
    spineBottomY: genesisY,
    topPill: {
      label: leaderHeat.quorumReached
        ? "Consenso Atingido"
        : allProps.length > 0
          ? "Em Evolução (Ativa)"
          : "Aguardando Propostas",
      subLabel: leader
        ? `${leader.pickCount}/${requiredVotes} apoios · Quórum ${subject.quorumPct}%`
        : `Quórum ${subject.quorumPct}% (${requiredVotes} apoios)`,
      tone: leaderHeat.quorumReached ? "consensus" : "primary",
      focusTarget: {
        kind: "subject",
        categoryId,
        subjectScope,
      },
    },
    spineNodes,
    nodes,
  };

  return {
    width: tree.width,
    height: tree.height,
    trees: [tree],
    stats: {
      categoriesCount: 1,
      subjectsCount: 1,
      proposalsCount: allProps.length,
      forksCount: allProps.filter((p) => p.parentHashHex !== null).length,
      totalPicks,
      consensusCount,
      leaderPct: leaderHeat.quorumProgressPct,
    },
  };
}

export function buildSankeyGraph(options: BuildGraphOptions): SankeyGraphLayout {
  switch (options.focus.kind) {
    case "community":
      return buildCommunityForest(options);
    case "category":
      return buildCategoryFocusedGraph(options, options.focus.categoryId);
    case "subject":
      return buildSubjectEvolutionGraph(
        options,
        options.focus.categoryId,
        options.focus.subjectScope,
      );
  }
}

export { TOP_PILL_Y };
