import type {
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

export interface CollapsedCategoryNode {
  readonly id: string;
  readonly categoryId: string;
  readonly title: string;
  readonly body: string;
  readonly subjectCount: number;
  readonly proposalCount: number;
  readonly consensusCount: number;
  readonly totalPicks: number;
  readonly tone: ArmTone;
  readonly x: number;
  readonly y: number;
}

export interface ProposalBranchNode {
  readonly id: string;
  readonly parentNodeId: string;
  readonly subjectScope: string;
  readonly side: ArmSide;
  readonly depth: number;
  readonly x: number;
  readonly y: number;
  readonly parentX: number;
  readonly parentY: number;
  readonly expanded: boolean;
  readonly strokeWidth: number;
  readonly tone: ArmTone;
  readonly title: string;
  readonly childCount: number;
  readonly pickCount: number;
  readonly requiredVotes: number;
  readonly quorumProgressPct: number;
  readonly quorumReached: boolean;
  readonly isMyPick: boolean;
  readonly isLeader: boolean;
  readonly isFork: boolean;
  readonly proposal: ProposalSummaryView;
  readonly subject: SubjectSummaryView;
  readonly categoryId: string;
  readonly categoryTitle: string;
  readonly parentProposal: ProposalSummaryView | null;
  readonly childForks: readonly ProposalSummaryView[];
}

export interface SpineSubjectNode {
  readonly id: string;
  readonly subject: SubjectSummaryView;
  readonly categoryId: string;
  readonly categoryTitle: string;
  readonly y: number;
  readonly labelSide: ArmSide;
  readonly branchSide: ArmSide;
  readonly expanded: boolean;
  readonly proposalCount: number;
  readonly totalPicks: number;
  readonly quorumReached: boolean;
  readonly tone: ArmTone;
  readonly dateLabel: string;
}

export interface CategoryTreeScene {
  readonly kind: "category-tree";
  readonly width: number;
  readonly height: number;
  readonly spineX: number;
  readonly spineTopY: number;
  readonly spineBottomY: number;
  readonly categoryId: string;
  readonly categoryTitle: string;
  readonly creationLabel: string;
  readonly creationDateLabel: string;
  readonly subjects: readonly SpineSubjectNode[];
  readonly branches: readonly ProposalBranchNode[];
  readonly stats: GraphSummaryStats;
}

export interface CommunityMapScene {
  readonly kind: "community-map";
  readonly width: number;
  readonly height: number;
  readonly categories: readonly CollapsedCategoryNode[];
  readonly stats: GraphSummaryStats;
}

export type GraphScene = CommunityMapScene | CategoryTreeScene;

export interface GraphSummaryStats {
  readonly categoriesCount: number;
  readonly subjectsCount: number;
  readonly proposalsCount: number;
  readonly forksCount: number;
  readonly totalPicks: number;
  readonly consensusCount: number;
}

export interface BuildGraphSceneOptions {
  readonly projection: CommunityProjection;
  readonly myPubHex: string;
  readonly focus: GraphFocus;
  readonly expandedSubjectScopes: ReadonlySet<string>;
  readonly expandedProposalIds: ReadonlySet<string>;
  readonly nodeSpacing: number;
  readonly searchQuery: string;
}

interface ProposalTreeItem {
  readonly proposal: ProposalSummaryView;
  readonly children: readonly ProposalTreeItem[];
  readonly leafCount: number;
  readonly subtreePicks: number;
}

const MAP_CARD_W = 240;
const MAP_CARD_H = 92;
const MAP_GAP_X = 72;
const MAP_GAP_Y = 58;
const MAP_PAD = 56;

const TREE_BASE_SPINE_X = 480;
const TREE_FIRST_COL_OFFSET = 195;
const TREE_COL_STEP = 270;
const TREE_OUTGOING_OFFSET = 196;
const TREE_SIDE_MARGIN = 260;
const TREE_TOP_PAD = 72;
const TREE_BOTTOM_PAD = 96;

function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
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

function resolveCategoryLookup(projection: CommunityProjection) {
  const map = new Map<
    string,
    { id: string; title: string; body: string; timestampMs: number | null }
  >();
  for (const cat of projection.categories) {
    map.set(cat.docIdHex, {
      id: cat.docIdHex,
      title: cat.title,
      body: cat.body,
      timestampMs: cat.timestampMs,
    });
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
      timestampMs: null,
    };
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

function buildProposalForest(
  proposals: readonly ProposalSummaryView[],
  expandedProposalIds: ReadonlySet<string>,
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

  const sortOrder = (a: ProposalSummaryView, b: ProposalSummaryView) =>
    b.pickCount - a.pickCount || a.timestampMs - b.timestampMs;

  const visited = new Set<string>();
  const buildItem = (prop: ProposalSummaryView): ProposalTreeItem => {
    visited.add(prop.docIdHex);
    const rawChildren = [...(childrenMap.get(prop.docIdHex) ?? [])].sort(sortOrder);
    const isExpanded = expandedProposalIds.has(prop.docIdHex);
    const children: ProposalTreeItem[] = [];
    if (isExpanded) {
      for (const child of rawChildren) {
        if (!visited.has(child.docIdHex)) {
          children.push(buildItem(child));
        }
      }
    }
    const leafCount =
      children.length === 0
        ? 1
        : children.reduce((sum, c) => sum + c.leafCount, 0);
    const subtreePicks =
      prop.pickCount + children.reduce((sum, c) => sum + c.subtreePicks, 0);
    return { proposal: prop, children, leafCount, subtreePicks };
  };

  return [...roots].sort(sortOrder).map(buildItem);
}

function computeBranchWidth(weight: number, maxWeight: number, depth: number): number {
  const ratio = weight > 0 ? Math.min(1, weight / Math.max(1, maxWeight)) : 0;
  if (depth === 1) {
    return Number((2.4 + ratio * 4.0).toFixed(2));
  }
  return Number((2.0 + ratio * 2.6).toFixed(2));
}

export function getBranchCurvePath(node: ProposalBranchNode): string {
  const { parentX: x1, parentY: y1, x: x2, y: y2 } = node;
  if (Math.abs(y2 - y1) < 2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const dx = x2 - x1;
  const cx1 = x1 + dx * 0.55;
  const cx2 = x1 + dx * 0.45;
  return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
}

function buildCommunityMapScene(
  options: BuildGraphSceneOptions,
): CommunityMapScene {
  const { projection, searchQuery } = options;
  const query = searchQuery.trim().toLowerCase();
  const resolveCategory = resolveCategoryLookup(projection);
  const { byScope } = indexProposals(projection.proposals);

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

  const rawCategories: Array<{
    id: string;
    title: string;
    body: string;
  }> = projection.categories.map((c) => ({
    id: c.docIdHex,
    title: c.title,
    body: c.body,
  }));

  if (subjectsByCategory.has(GENERAL_CATEGORY_ID) || rawCategories.length === 0) {
    rawCategories.unshift({
      id: GENERAL_CATEGORY_ID,
      title: "Geral",
      body: "Assuntos gerais da comunidade.",
    });
  }

  const filteredCategories = rawCategories.filter((cat) => {
    if (!query) {
      return true;
    }
    const catSubjects = subjectsByCategory.get(cat.id) ?? [];
    return (
      matchesQuery(query, cat.title, cat.body) ||
      catSubjects.some((s) => matchesQuery(query, s.title, s.body))
    );
  });

  const cols = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(filteredCategories.length))));
  const categories: CollapsedCategoryNode[] = [];

  let totalSubjects = 0;
  let totalProposals = 0;
  let totalForks = 0;
  let totalPicks = 0;
  let totalConsensus = 0;

  filteredCategories.forEach((cat, idx) => {
    const catSubjects = subjectsByCategory.get(cat.id) ?? [];
    let propCount = 0;
    let catPicks = 0;
    let catConsensus = 0;

    for (const subj of catSubjects) {
      const props = byScope.get(subj.scope) ?? [];
      propCount += props.length;
      catPicks += props.reduce((acc, p) => acc + p.pickCount, 0);
      totalForks += props.filter((p) => p.parentHashHex !== null).length;
      if (
        subj.quorumPct !== null &&
        props.some((p) => p.status === "CONSENSUS" || p.status === "APPROVED")
      ) {
        catConsensus += 1;
      }
    }

    totalSubjects += catSubjects.length;
    totalProposals += propCount;
    totalPicks += catPicks;
    totalConsensus += catConsensus;

    const col = idx % cols;
    const row = Math.floor(idx / cols);
    // Gentle vertical stagger between columns so nodes feel dispersed across the map
    const staggerY = col % 2 === 1 ? 34 : 0;
    const x = MAP_PAD + col * (MAP_CARD_W + MAP_GAP_X) + MAP_CARD_W / 2;
    const y = MAP_PAD + row * (MAP_CARD_H + MAP_GAP_Y) + staggerY + MAP_CARD_H / 2;

    const tone: ArmTone =
      catConsensus > 0
        ? "consensus"
        : catSubjects.length > 0
          ? "primary"
          : "muted";

    categories.push({
      id: `map-cat-${cat.id}`,
      categoryId: cat.id,
      title: cat.title,
      body: cat.body,
      subjectCount: catSubjects.length,
      proposalCount: propCount,
      consensusCount: catConsensus,
      totalPicks: catPicks,
      tone,
      x,
      y,
    });
  });

  const rows = Math.max(1, Math.ceil(filteredCategories.length / cols));
  const width = Math.max(
    520,
    MAP_PAD * 2 + cols * MAP_CARD_W + Math.max(0, cols - 1) * MAP_GAP_X,
  );
  const height = Math.max(
    340,
    MAP_PAD * 2 + rows * MAP_CARD_H + Math.max(0, rows - 1) * MAP_GAP_Y + 40,
  );

  return {
    kind: "community-map",
    width,
    height,
    categories,
    stats: {
      categoriesCount: filteredCategories.length,
      subjectsCount: totalSubjects,
      proposalsCount: totalProposals,
      forksCount: totalForks,
      totalPicks,
      consensusCount: totalConsensus,
    },
  };
}

function buildCategoryTreeScene(
  options: BuildGraphSceneOptions,
  categoryId: string,
): CategoryTreeScene {
  const {
    projection,
    myPubHex,
    expandedSubjectScopes,
    expandedProposalIds,
    nodeSpacing,
    searchQuery,
  } = options;
  const query = searchQuery.trim().toLowerCase();
  const resolveCategory = resolveCategoryLookup(projection);
  const { byScope, byId, childrenByParent } = indexProposals(projection.proposals);

  const catObj =
    categoryId === GENERAL_CATEGORY_ID
      ? null
      : (projection.categories.find((c) => c.docIdHex === categoryId) ?? null);
  const categoryTitle = catObj ? catObj.title : "Geral";

  const rowStep = 40 + Math.max(6, Math.min(40, nodeSpacing));
  const collapsedGap = Math.max(54, rowStep + 14);
  const expandedGroupGap = Math.max(28, Math.round(nodeSpacing * 1.4));

  const catSubjects = projection.subjects
    .filter((s) => resolveCategory(s.categoryHashHex).id === categoryId)
    .filter((s) => {
      if (!query) {
        return true;
      }
      const props = byScope.get(s.scope) ?? [];
      return (
        matchesQuery(query, s.title, s.body) ||
        props.some((p) => matchesQuery(query, p.title, p.body, p.authorName))
      );
    })
    // Newest subjects near the top, oldest near "criação [categoria]" at bottom
    .sort((a, b) => b.timestampMs - a.timestampMs);

  const maxDepthBySide: { left: number; right: number } = { left: 0, right: 0 };
  const precomputedForests = new Map<string, readonly ProposalTreeItem[]>();

  const measureMaxDepth = (item: ProposalTreeItem, depth: number, side: ArmSide) => {
    if (depth > maxDepthBySide[side]) {
      maxDepthBySide[side] = depth;
    }
    for (const child of item.children) {
      measureMaxDepth(child, depth + 1, side);
    }
  };

  catSubjects.forEach((subj, idx) => {
    if (!expandedSubjectScopes.has(subj.scope)) {
      return;
    }
    const subjProps = byScope.get(subj.scope) ?? [];
    const forest = buildProposalForest(subjProps, expandedProposalIds);
    precomputedForests.set(subj.scope, forest);
    const branchSide: ArmSide = idx % 2 === 0 ? "left" : "right";
    for (const root of forest) {
      measureMaxDepth(root, 1, branchSide);
    }
  });

  const leftExtension =
    maxDepthBySide.left > 0
      ? TREE_FIRST_COL_OFFSET + (maxDepthBySide.left - 1) * TREE_COL_STEP + TREE_SIDE_MARGIN
      : TREE_BASE_SPINE_X;
  const rightExtension =
    maxDepthBySide.right > 0
      ? TREE_FIRST_COL_OFFSET + (maxDepthBySide.right - 1) * TREE_COL_STEP + TREE_SIDE_MARGIN
      : TREE_BASE_SPINE_X;

  const spineX = Math.max(TREE_BASE_SPINE_X, leftExtension);
  const width = spineX + Math.max(TREE_BASE_SPINE_X, rightExtension);

  const spineSubjects: SpineSubjectNode[] = [];
  const branches: ProposalBranchNode[] = [];

  let cursorY = TREE_TOP_PAD;
  let totalProposals = 0;
  let totalForks = 0;
  let totalPicks = 0;
  let consensusCount = 0;

  catSubjects.forEach((subj, idx) => {
    const subjProps = byScope.get(subj.scope) ?? [];
    const req = subj.requiredVotes;
    const leader = subjProps[0] ?? null;
    const heat =
      subj.quorumPct === null
        ? { quorumProgressPct: 0, quorumReached: false }
        : computeHeatInfo(leader?.pickCount ?? 0, req);
    const subjPicks = subjProps.reduce((acc, p) => acc + p.pickCount, 0);

    totalProposals += subjProps.length;
    totalForks += subjProps.filter((p) => p.parentHashHex !== null).length;
    totalPicks += subjPicks;
    if (heat.quorumReached) {
      consensusCount += 1;
    }

    // Label alternates Right / Left along the vertical trunk;
    // branches fan out to the opposite side so labels and curves never collide!
    const labelSide: ArmSide = idx % 2 === 0 ? "right" : "left";
    const branchSide: ArmSide = labelSide === "right" ? "left" : "right";
    const isExpanded = expandedSubjectScopes.has(subj.scope);
    const forest = precomputedForests.get(subj.scope) ?? [];
    const subjTone: ArmTone = heat.quorumReached
      ? "consensus"
      : subjProps.length > 0
        ? "primary"
        : "muted";

    if (!isExpanded || forest.length === 0) {
      const y = cursorY;
      spineSubjects.push({
        id: `subj-${subj.scope}`,
        subject: subj,
        categoryId,
        categoryTitle,
        y,
        labelSide,
        branchSide,
        expanded: isExpanded,
        proposalCount: subjProps.length,
        totalPicks: subjPicks,
        quorumReached: heat.quorumReached,
        tone: subjTone,
        dateLabel: formatShortDate(subj.timestampMs),
      });
      cursorY += collapsedGap;
      return;
    }

    const totalLeaves = forest.reduce((sum, r) => sum + r.leafCount, 0);
    const bandTopY = cursorY;
    const bandHeight = totalLeaves * rowStep;
    const subjY = bandTopY + (bandHeight - rowStep) / 2;

    const subjNodeId = `subj-${subj.scope}`;
    spineSubjects.push({
      id: subjNodeId,
      subject: subj,
      categoryId,
      categoryTitle,
      y: subjY,
      labelSide,
      branchSide,
      expanded: true,
      proposalCount: subjProps.length,
      totalPicks: subjPicks,
      quorumReached: heat.quorumReached,
      tone: subjTone,
      dateLabel: formatShortDate(subj.timestampMs),
    });

    const maxSubtreeWeight = Math.max(
      1,
      ...subjProps.map((p) => p.pickCount),
      ...forest.map((f) => f.subtreePicks),
    );
    const dir = branchSide === "right" ? 1 : -1;

    let leafCursorY = bandTopY;

    const placeProposalItem = (
      item: ProposalTreeItem,
      depth: number,
      parentNodeId: string,
      parentX: number,
      parentY: number,
    ): { x: number; y: number } => {
      const nodeX =
        spineX + dir * (TREE_FIRST_COL_OFFSET + (depth - 1) * TREE_COL_STEP);
      const nodeId = `prop-${item.proposal.docIdHex}`;

      let nodeY: number;
      const childCoords: Array<{ item: ProposalTreeItem; y: number }> = [];

      if (item.children.length === 0) {
        nodeY = leafCursorY;
        leafCursorY += rowStep;
      } else {
        const startBandY = leafCursorY;
        // Reserve space, place children after we know parentY (2-pass via precomputed child bands!)
        let childBandY = startBandY;
        for (const child of item.children) {
          const childMidY = childBandY + ((child.leafCount - 1) * rowStep) / 2;
          childCoords.push({ item: child, y: childMidY });
          childBandY += child.leafCount * rowStep;
        }
        nodeY =
          (childCoords[0]!.y + childCoords[childCoords.length - 1]!.y) / 2;
      }

      const propReq = item.proposal.requiredVotes;
      const propHeat =
        item.proposal.quorumPct === null
          ? { quorumProgressPct: 0, quorumReached: false }
          : computeHeatInfo(item.proposal.pickCount, propReq);
      const isReached =
        item.proposal.status === "CONSENSUS" ||
        (item.proposal.deliberationMode === "QUORUM" &&
          item.proposal.status === "APPROVED");
      const isLeader =
        leader !== null &&
        item.proposal.docIdHex === leader.docIdHex &&
        item.proposal.pickCount > 0;
      const isFork = item.proposal.parentHashHex !== null;
      const propTone: ArmTone = isReached
        ? "consensus"
        : isLeader
          ? "primary"
          : item.proposal.pickCount > 0 || isFork
            ? "warning"
            : "muted";

      const directChildren = childrenByParent.get(item.proposal.docIdHex) ?? [];
      const parentProposal = item.proposal.parentHashHex
        ? (byId.get(item.proposal.parentHashHex) ?? null)
        : null;

      branches.push({
        id: nodeId,
        parentNodeId,
        subjectScope: subj.scope,
        side: branchSide,
        depth,
        x: nodeX,
        y: nodeY,
        parentX,
        parentY,
        expanded: expandedProposalIds.has(item.proposal.docIdHex),
        strokeWidth: computeBranchWidth(
          depth === 1 ? item.subtreePicks : item.proposal.pickCount,
          maxSubtreeWeight,
          depth,
        ),
        tone: propTone,
        title: item.proposal.title,
        childCount: directChildren.length,
        pickCount: item.proposal.pickCount,
        requiredVotes: propReq,
        quorumProgressPct: propHeat.quorumProgressPct,
        quorumReached: isReached,
        isMyPick: item.proposal.supporterPubs.includes(myPubHex),
        isLeader,
        isFork,
        proposal: item.proposal,
        subject: subj,
        categoryId,
        categoryTitle,
        parentProposal,
        childForks: directChildren,
      });

      const outgoingX = nodeX + dir * TREE_OUTGOING_OFFSET;
      for (const child of item.children) {
        placeProposalItem(child, depth + 1, nodeId, outgoingX, nodeY);
      }

      return { x: nodeX, y: nodeY };
    };

    for (const root of forest) {
      placeProposalItem(root, 1, subjNodeId, spineX, subjY);
    }

    cursorY = bandTopY + bandHeight + expandedGroupGap;
  });

  const spineTopY = spineSubjects.length > 0 ? spineSubjects[0]!.y : TREE_TOP_PAD;
  const spineBottomY = Math.max(spineTopY + 60, cursorY + 18);

  const oldestSubjectTs =
    catSubjects.length > 0
      ? catSubjects[catSubjects.length - 1]!.timestampMs
      : null;
  const creationTs = catObj?.timestampMs ?? oldestSubjectTs;

  return {
    kind: "category-tree",
    width,
    height: spineBottomY + TREE_BOTTOM_PAD,
    spineX,
    spineTopY,
    spineBottomY,
    categoryId,
    categoryTitle,
    creationLabel: `criação ${categoryTitle}`,
    creationDateLabel: creationTs ? formatShortDate(creationTs) : "início",
    subjects: spineSubjects,
    branches,
    stats: {
      categoriesCount: 1,
      subjectsCount: catSubjects.length,
      proposalsCount: totalProposals,
      forksCount: totalForks,
      totalPicks,
      consensusCount,
    },
  };
}

export function buildGraphScene(options: BuildGraphSceneOptions): GraphScene {
  if (options.focus.kind === "community") {
    return buildCommunityMapScene(options);
  }
  return buildCategoryTreeScene(options, options.focus.categoryId);
}
