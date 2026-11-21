import type {
  CommunityProjection,
  MemberView,
  ProposalSummaryView,
} from "@sintetizing/domain";
import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  WheelEvent as ReactWheelEvent,
} from "react";
import { formatDateMs, GENERAL_CATEGORY_ID, shortHex } from "../utils/format.js";
import {
  ArmTone,
  buildSankeyGraph,
  getArmPath,
  GraphArmNode,
  GraphFocus,
  GraphNodeEntity,
  GraphTreeLayout,
  TOP_PILL_Y,
} from "../utils/sankey-graph.js";
import { MaterialIcon } from "./MaterialIcon.js";

export interface CommunityGraphViewProps {
  readonly myPubHex: string;
  readonly communityTitle: string;
  readonly projection: CommunityProjection | null;
  readonly focus: GraphFocus;
  readonly sidebarCollapsed: boolean;
  readonly busy: boolean;
  readonly onChangeFocus: (focus: GraphFocus) => void;
  readonly onToggleSidebar: () => void;
  readonly onOpenCategoryInWorkspace: (categoryId: string) => void;
  readonly onOpenSubjectInWorkspace: (categoryId: string, scope: string) => void;
  readonly onOpenProposalInWorkspace: (
    categoryId: string,
    scope: string,
    proposalId: string,
  ) => void;
  readonly onPickProposal: (scope: string, docIdHex: string) => Promise<void>;
  readonly onShareProposal: (proposal: ProposalSummaryView) => Promise<void>;
}

const TONE_COLOR: Readonly<Record<ArmTone, string>> = {
  consensus: "#15803d",
  primary: "#2563eb",
  warning: "#d97706",
  muted: "#94a3b8",
};

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.0;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

function collectLineageIds(
  targetId: string | null,
  trees: readonly GraphTreeLayout[],
): ReadonlySet<string> {
  if (!targetId) {
    return new Set();
  }
  const byId = new Map<string, GraphArmNode>();
  const childrenMap = new Map<string, string[]>();
  for (const tree of trees) {
    for (const n of tree.nodes) {
      byId.set(n.id, n);
      if (n.parentId) {
        const list = childrenMap.get(n.parentId);
        if (list) {
          list.push(n.id);
        } else {
          childrenMap.set(n.parentId, [n.id]);
        }
      }
    }
  }

  const result = new Set<string>();
  let curr = byId.get(targetId);
  while (curr) {
    result.add(curr.id);
    curr = curr.parentId ? byId.get(curr.parentId) : undefined;
  }
  const queue: string[] = [targetId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.add(id);
    for (const childId of childrenMap.get(id) ?? []) {
      if (!result.has(childId)) {
        queue.push(childId);
      }
    }
  }
  return result;
}

function resolveMemberLabel(
  pubHex: string,
  myPubHex: string,
  members: readonly MemberView[],
): string {
  const member = members.find((m) => m.pubHex === pubHex);
  if (pubHex === myPubHex) {
    return member?.displayName ? `${member.displayName} (você)` : "Você";
  }
  return member?.displayName ?? shortHex(pubHex);
}

export function CommunityGraphView({
  myPubHex,
  communityTitle,
  projection,
  focus,
  sidebarCollapsed,
  busy,
  onChangeFocus,
  onToggleSidebar,
  onOpenCategoryInWorkspace,
  onOpenSubjectInWorkspace,
  onOpenProposalInWorkspace,
  onPickProposal,
  onShareProposal,
}: CommunityGraphViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showProposals, setShowProposals] = useState<boolean>(
    () => (projection?.proposals.length ?? 0) <= 18,
  );
  const [nodeSpacing, setNodeSpacing] = useState<number>(16);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ readonly x: number; readonly y: number }>({
    x: 0,
    y: 0,
  });
  const [isDragging, setIsDragging] = useState(false);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setSelectedNodeId(null);
    setHoveredNodeId(null);
  }, [projection?.communityId, focus]);

  useEffect(() => {
    if (projection) {
      setShowProposals(projection.proposals.length <= 18);
      setSearchQuery("");
    }
  }, [projection?.communityId]);

  const layout = useMemo(() => {
    if (!projection) {
      return null;
    }
    return buildSankeyGraph({
      projection,
      communityTitle,
      myPubHex,
      focus,
      showProposals,
      nodeSpacing,
      searchQuery,
    });
  }, [
    projection,
    communityTitle,
    myPubHex,
    focus,
    showProposals,
    nodeSpacing,
    searchQuery,
  ]);

  const handleFitFocus = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !layout) {
      return;
    }
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    if (vw <= 0 || vh <= 0) {
      return;
    }
    const padX = 48;
    const padY = 88;
    const fitScale = clampZoom(
      Math.min(1, (vw - padX) / layout.width, (vh - padY) / layout.height),
    );
    const nextX = Math.round((vw - layout.width * fitScale) / 2);
    const nextY = Math.round(Math.max(20, (vh - layout.height * fitScale - 36) / 2));
    setZoom(fitScale);
    setPan({ x: nextX, y: nextY });
  }, [layout]);

  // Auto-fit when switching community or focus level
  const focusKey =
    focus.kind === "community"
      ? "community"
      : focus.kind === "category"
        ? `cat:${focus.categoryId}`
        : `subj:${focus.subjectScope}`;

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      handleFitFocus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [projection?.communityId, focusKey]);

  const applyZoomAtPoint = useCallback(
    (nextZoomRaw: number, clientX?: number, clientY?: number) => {
      const nextZoom = clampZoom(nextZoomRaw);
      const viewport = viewportRef.current;
      if (!viewport) {
        setZoom(nextZoom);
        return;
      }
      const rect = viewport.getBoundingClientRect();
      const pivotX = clientX !== undefined ? clientX - rect.left : rect.width / 2;
      const pivotY = clientY !== undefined ? clientY - rect.top : rect.height / 2;

      setZoom((prevZoom) => {
        if (prevZoom === nextZoom) {
          return prevZoom;
        }
        const ratio = nextZoom / prevZoom;
        setPan((prevPan) => ({
          x: Math.round(pivotX - (pivotX - prevPan.x) * ratio),
          y: Math.round(pivotY - (pivotY - prevPan.y) * ratio),
        }));
        return nextZoom;
      });
    },
    [],
  );

  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    applyZoomAtPoint(zoom * factor, e.clientX, e.clientY);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) {
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, input, select, a, .graph-controls-pill")) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originPanX: pan.x,
      originPanY: pan.y,
      moved: false,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || !drag.active || drag.pointerId !== e.pointerId) {
      return;
    }
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.moved = true;
    }
    setPan({
      x: drag.originPanX + dx,
      y: drag.originPanY + dy,
    });
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) {
      return;
    }
    if (!drag.moved) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("button, input, select, a")) {
        setSelectedNodeId(null);
      }
    }
    dragStateRef.current = null;
    setIsDragging(false);
  };

  const activeHighlightId = hoveredNodeId ?? selectedNodeId;
  const highlightedIds = useMemo(
    () =>
      layout
        ? collectLineageIds(activeHighlightId, layout.trees)
        : new Set<string>(),
    [activeHighlightId, layout],
  );

  const selectedEntity: GraphNodeEntity | null = useMemo(() => {
    if (!layout || !selectedNodeId) {
      return null;
    }
    for (const tree of layout.trees) {
      const armNode = tree.nodes.find((n) => n.id === selectedNodeId);
      if (armNode) {
        return armNode.entity;
      }
      const spineNode = tree.spineNodes.find((n) => n.id === selectedNodeId);
      if (spineNode?.entity) {
        return spineNode.entity;
      }
    }
    return null;
  }, [layout, selectedNodeId]);

  const categoryTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set(GENERAL_CATEGORY_ID, "Geral");
    for (const cat of projection?.categories ?? []) {
      map.set(cat.docIdHex, cat.title);
    }
    return map;
  }, [projection?.categories]);

  const activeCategoryLabel =
    focus.kind === "community"
      ? null
      : (categoryTitleMap.get(focus.categoryId) ?? "Geral");

  const activeSubjectObj =
    focus.kind === "subject" && projection
      ? (projection.subjects.find((s) => s.scope === focus.subjectScope) ?? null)
      : null;

  const subjectOptions = useMemo(() => {
    if (!projection) {
      return [];
    }
    return [...projection.subjects]
      .map((subj) => {
        const catId =
          subj.categoryHashHex && categoryTitleMap.has(subj.categoryHashHex)
            ? subj.categoryHashHex
            : GENERAL_CATEGORY_ID;
        const catTitle = categoryTitleMap.get(catId) ?? "Geral";
        return {
          scope: subj.scope,
          title: subj.title,
          categoryId: catId,
          categoryTitle: catTitle,
          proposalCount: subj.proposalCount,
        };
      })
      .sort(
        (a, b) =>
          b.proposalCount - a.proposalCount || a.title.localeCompare(b.title),
      );
  }, [projection, categoryTitleMap]);

  const handleArmClick = (node: GraphArmNode) => {
    const { entity } = node;
    if (entity.kind === "category") {
      onChangeFocus({ kind: "category", categoryId: entity.categoryId });
      return;
    }
    if (entity.kind === "subject" && focus.kind !== "subject") {
      onChangeFocus({
        kind: "subject",
        categoryId: entity.categoryId,
        subjectScope: entity.subject.scope,
      });
      return;
    }
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  };

  const renderBreadcrumb = () => (
    <nav className="graph-breadcrumb" aria-label="Navegação do grafo">
      <button
        type="button"
        className={
          focus.kind === "community"
            ? "graph-crumb graph-crumb--active"
            : "graph-crumb"
        }
        onClick={() => onChangeFocus({ kind: "community" })}
      >
        <MaterialIcon name="hub" />
        <span>{communityTitle}</span>
      </button>

      {focus.kind !== "community" && (
        <>
          <span className="graph-crumb-sep" aria-hidden="true">
            /
          </span>
          <button
            type="button"
            className={
              focus.kind === "category"
                ? "graph-crumb graph-crumb--active"
                : "graph-crumb"
            }
            onClick={() =>
              onChangeFocus({ kind: "category", categoryId: focus.categoryId })
            }
          >
            <MaterialIcon name="category" />
            <span>{activeCategoryLabel}</span>
          </button>
        </>
      )}

      {focus.kind === "subject" && activeSubjectObj && (
        <>
          <span className="graph-crumb-sep" aria-hidden="true">
            /
          </span>
          <span className="graph-crumb graph-crumb--active">
            <MaterialIcon name="forum" />
            <span>{activeSubjectObj.title}</span>
          </span>
        </>
      )}
    </nav>
  );

  const renderInspector = () => {
    if (!selectedEntity || !projection) {
      return null;
    }

    if (selectedEntity.kind === "config") {
      const cfg = selectedEntity.version;
      return (
        <>
          <div
            className="graph-inspector-backdrop"
            onClick={() => setSelectedNodeId(null)}
            aria-hidden="true"
          />
          <aside className="graph-inspector" aria-label="Detalhes do estatuto">
            <div className="graph-inspector__header">
              <div className="graph-inspector__type">
                <span className="chip chip--cmnt">
                  Estatuto v{cfg.versionIndex}
                </span>
                <span className="chip">{cfg.status}</span>
              </div>
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                onClick={() => setSelectedNodeId(null)}
                aria-label="Fechar painel"
              >
                <MaterialIcon name="close" />
              </button>
            </div>
            <h2 className="md-title-medium">{cfg.title}</h2>
            {cfg.body && <p className="md-body-medium">{cfg.body}</p>}
            <div className="graph-inspector__stats gov-tabular">
              <span>Quórum: {cfg.quorumPct}%</span>
              <span>Inatividade: {cfg.inactivityDays} dias</span>
              <span>
                Apoios: {cfg.supportCount}/{cfg.requiredSupports}
              </span>
            </div>
            <p className="md-label-medium">
              Registrado em {formatDateMs(cfg.timestampMs)}
            </p>
          </aside>
        </>
      );
    }

    if (selectedEntity.kind === "proposal") {
      const {
        proposal,
        subject,
        categoryId,
        categoryTitle,
        requiredVotes,
        quorumProgressPct,
        quorumReached,
        isMyPick,
        parentProposal,
        childForks,
      } = selectedEntity;
      const authorLabel = resolveMemberLabel(
        proposal.authorPubHex,
        myPubHex,
        projection.members,
      );

      return (
        <>
          <div
            className="graph-inspector-backdrop"
            onClick={() => setSelectedNodeId(null)}
            aria-hidden="true"
          />
          <aside className="graph-inspector" aria-label="Detalhes da proposta">
            <div className="graph-inspector__header">
              <div className="graph-inspector__type">
                <span className="chip chip--stze">
                  {proposal.parentHashHex ? "Síntese / Fork" : "Proposta"}
                </span>
                {quorumReached && (
                  <span className="chip chip--memb">Consenso</span>
                )}
              </div>
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                onClick={() => setSelectedNodeId(null)}
                aria-label="Fechar detalhes"
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <div className="graph-inspector__title-block">
              <h2 className="md-title-medium">{proposal.title}</h2>
              <p className="md-label-medium">
                {categoryTitle}
                {subject ? ` · #${subject.title}` : ""}
              </p>
            </div>

            <div className="graph-inspector__quorum">
              <div className="graph-inspector__quorum-head gov-tabular">
                <strong>
                  {quorumReached
                    ? `Consenso atingido (${proposal.pickCount} apoios)`
                    : `${proposal.pickCount} de ${requiredVotes} apoios (${quorumProgressPct}%)`}
                </strong>
              </div>
              <div className="progress-track" aria-hidden="true">
                <div
                  className={
                    quorumReached
                      ? "progress-fill progress-fill--consensus"
                      : "progress-fill"
                  }
                  style={{ width: `${quorumProgressPct}%` }}
                />
              </div>
            </div>

            {parentProposal && (
              <button
                type="button"
                className="graph-inspector__lineage-btn"
                onClick={() =>
                  setSelectedNodeId(`prop-${parentProposal.docIdHex}`)
                }
              >
                <MaterialIcon name="fork_right" />
                <span>Baseada em: {parentProposal.title}</span>
              </button>
            )}

            <p className="graph-inspector__body">{proposal.body}</p>

            <div className="graph-inspector__meta">
              <span>Por {authorLabel}</span>
              <span>{formatDateMs(proposal.timestampMs)}</span>
            </div>

            {proposal.supporterPubs.length > 0 && (
              <div className="supporter-list">
                {proposal.supporterPubs.map((pubHex) => (
                  <span
                    key={pubHex}
                    className={
                      pubHex === myPubHex
                        ? "supporter-chip supporter-chip--me"
                        : "supporter-chip"
                    }
                  >
                    {resolveMemberLabel(pubHex, myPubHex, projection.members)}
                  </span>
                ))}
              </div>
            )}

            {childForks.length > 0 && (
              <div className="graph-inspector__forks">
                <span className="md-label-medium">
                  Sínteses derivadas ({childForks.length})
                </span>
                <div className="graph-inspector__fork-list">
                  {childForks.map((child) => (
                    <button
                      key={child.docIdHex}
                      type="button"
                      className="graph-inspector__fork-chip"
                      onClick={() =>
                        setSelectedNodeId(`prop-${child.docIdHex}`)
                      }
                    >
                      <span className="graph-inspector__fork-title">
                        {child.title}
                      </span>
                      <span className="gov-tabular">{child.pickCount}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="graph-inspector__actions">
              {isMyPick ? (
                <button
                  type="button"
                  className="vote-pill vote-pill--active"
                  disabled
                >
                  <MaterialIcon name="check_circle" filled />
                  <span className="gov-tabular">
                    Apoiado · {proposal.pickCount}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="vote-pill"
                  disabled={busy}
                  onClick={() =>
                    void onPickProposal(proposal.scope, proposal.docIdHex)
                  }
                >
                  <MaterialIcon name="how_to_vote" />
                  <span className="gov-tabular">
                    Apoiar · {proposal.pickCount}
                  </span>
                </button>
              )}

              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() =>
                  onOpenProposalInWorkspace(
                    categoryId,
                    proposal.scope,
                    proposal.docIdHex,
                  )
                }
              >
                <MaterialIcon name="open_in_new" />
                <span>Abrir / Sintetizar</span>
              </button>

              <button
                type="button"
                className="btn btn--outlined btn--sm"
                onClick={() => void onShareProposal(proposal)}
                title="Copiar link da proposta"
              >
                <MaterialIcon name="share" />
              </button>
            </div>
          </aside>
        </>
      );
    }

    return null;
  };

  const renderTree = (tree: GraphTreeLayout) => (
    <div
      key={tree.id}
      className="graph-tree"
      style={{
        left: tree.x,
        top: tree.y,
        width: tree.width,
        height: tree.height,
      }}
    >
      <svg
        className="graph-svg"
        width={tree.width}
        height={tree.height}
        viewBox={`0 0 ${tree.width} ${tree.height}`}
        aria-hidden="true"
      >
        <line
          x1={tree.spineX}
          y1={TOP_PILL_Y + 14}
          x2={tree.spineX}
          y2={tree.spineBottomY}
          stroke={tree.topPill.tone === "consensus" ? "#15803d" : "#2563eb"}
          strokeWidth={10}
          strokeOpacity={0.1}
          strokeLinecap="round"
        />
        <line
          x1={tree.spineX}
          y1={TOP_PILL_Y + 14}
          x2={tree.spineX}
          y2={tree.spineBottomY}
          stroke={tree.topPill.tone === "consensus" ? "#15803d" : "#2563eb"}
          strokeWidth={3.2}
          strokeLinecap="round"
        />

        {tree.nodes.map((node) => {
          const pathD = getArmPath(node);
          const strokeColor = TONE_COLOR[node.tone];
          const isHighlighted =
            highlightedIds.size === 0 || highlightedIds.has(node.id);
          const isFocused = highlightedIds.has(node.id);
          const opacity = isHighlighted ? 1 : 0.25;

          return (
            <g
              key={node.id}
              style={{ opacity, transition: "opacity 140ms ease" }}
            >
              {node.connectorKind !== "vertical-dashed" && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={node.strokeWidth + (isFocused ? 8 : 5)}
                  strokeOpacity={isFocused ? 0.18 : 0.07}
                  strokeLinecap="round"
                />
              )}
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={
                  node.connectorKind === "vertical-dashed"
                    ? 1.75
                    : node.strokeWidth
                }
                strokeDasharray={
                  node.connectorKind === "vertical-dashed" ? "4 4" : undefined
                }
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </svg>

      <button
        type="button"
        className={
          tree.topPill.tone === "consensus"
            ? "graph-head-pill graph-head-pill--consensus"
            : "graph-head-pill"
        }
        style={{ left: tree.spineX, top: TOP_PILL_Y }}
        onClick={() => onChangeFocus(tree.topPill.focusTarget)}
        title={tree.topPill.subLabel}
      >
        <span className="graph-head-pill__dot" aria-hidden="true" />
        <span>{tree.topPill.label}</span>
      </button>

      {tree.spineNodes.map((milestone) => {
        const isClickable = milestone.entity !== null;
        const isSelected = selectedNodeId === milestone.id;
        const labelStyle =
          milestone.labelSide === "left"
            ? {
                right: tree.width - tree.spineX + 12,
                top: milestone.y,
              }
            : {
                left: tree.spineX + 12,
                top: milestone.y,
              };

        return (
          <div key={milestone.id}>
            <button
              type="button"
              className={[
                "graph-spine-dot",
                `graph-spine-dot--${milestone.status}`,
                isSelected ? "graph-spine-dot--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                left: tree.spineX,
                top: milestone.y,
                cursor: isClickable ? "pointer" : "default",
              }}
              disabled={!isClickable}
              onClick={() => {
                if (isClickable) {
                  setSelectedNodeId((prev) =>
                    prev === milestone.id ? null : milestone.id,
                  );
                }
              }}
              aria-label={milestone.label}
            />
            <span
              className={
                milestone.labelSide === "left"
                  ? "graph-spine-label graph-spine-label--left"
                  : "graph-spine-label graph-spine-label--right"
              }
              style={labelStyle}
            >
              <span className="graph-spine-label__title">
                {milestone.label}
              </span>
              {milestone.subLabel && (
                <span className="graph-spine-label__sub">
                  {milestone.subLabel}
                </span>
              )}
            </span>
          </div>
        );
      })}

      {tree.nodes.map((node) => {
        const isHighlighted =
          highlightedIds.size === 0 || highlightedIds.has(node.id);
        const isSelected = selectedNodeId === node.id;
        const isNavigable =
          node.entity.kind === "category" ||
          (node.entity.kind === "subject" && focus.kind !== "subject");

        const positionStyle =
          node.side === "left"
            ? {
                left: 16,
                width: Math.max(80, node.x - 16 + 7),
                top: node.y,
              }
            : {
                left: node.x - 7,
                maxWidth: Math.max(80, tree.width - (node.x - 7) - 16),
                top: node.y,
              };

        const dotElement = (
          <span
            className={[
              "graph-arm__dot",
              `graph-arm__dot--${node.tone}`,
              node.depth >= 1 ? "graph-arm__dot--sub" : "",
              node.isMyPick ? "graph-arm__dot--mypick" : "",
              isSelected ? "graph-arm__dot--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden="true"
          />
        );

        const badgeElement =
          node.countBadge !== null ? (
            <span
              className={`graph-arm__badge graph-arm__badge--${node.tone} gov-tabular`}
            >
              {node.countBadge}
            </span>
          ) : null;

        const checkElement = node.isCheckmark ? (
          <span
            className="graph-arm__check"
            title="Consenso / Quórum atingido"
          >
            ✓
          </span>
        ) : null;

        const metaElement = node.metaLabel ? (
          <span className="graph-arm__meta">{node.metaLabel}</span>
        ) : null;

        const labelElement = (
          <span className="graph-arm__label">{node.label}</span>
        );

        return (
          <button
            key={node.id}
            type="button"
            className={[
              "graph-arm",
              `graph-arm--${node.side}`,
              `graph-arm--${node.tone}`,
              node.depth >= 1 ? "graph-arm--sub" : "",
              isSelected ? "graph-arm--selected" : "",
              !isHighlighted ? "graph-arm--dimmed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={positionStyle}
            title={
              isNavigable
                ? `${node.label} — Clique para explorar`
                : `${node.label} — Clique para inspecionar`
            }
            onMouseEnter={() => setHoveredNodeId(node.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() => handleArmClick(node)}
          >
            {node.side === "left" ? (
              <>
                {metaElement}
                {checkElement}
                {labelElement}
                {badgeElement}
                {dotElement}
              </>
            ) : (
              <>
                {dotElement}
                {badgeElement}
                {labelElement}
                {checkElement}
                {metaElement}
              </>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="subview-frame">
      <header className="channel-topbar">
        <div className="channel-topbar__left">
          <button
            type="button"
            className={
              sidebarCollapsed
                ? "icon-btn"
                : "icon-btn channel-topbar__menu-mobile"
            }
            onClick={onToggleSidebar}
            title="Mostrar barra lateral"
            aria-label="Mostrar barra lateral"
          >
            <MaterialIcon name="menu" />
          </button>

          {renderBreadcrumb()}
        </div>

        <div className="channel-topbar__actions">
          {focus.kind === "category" && (
            <button
              type="button"
              className="btn btn--outlined btn--sm"
              onClick={() => onOpenCategoryInWorkspace(focus.categoryId)}
            >
              <MaterialIcon name="open_in_new" />
              <span>Abrir Categoria</span>
            </button>
          )}

          {focus.kind === "subject" && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() =>
                onOpenSubjectInWorkspace(focus.categoryId, focus.subjectScope)
              }
            >
              <MaterialIcon name="open_in_new" />
              <span>Abrir Assunto</span>
            </button>
          )}
        </div>
      </header>

      <div className="graph-toolbar">
        <div className="graph-toolbar__group">
          <div className="feed-search graph-search">
            <MaterialIcon name="search" />
            <input
              type="search"
              className="feed-search__input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar ramos no grafo..."
              aria-label="Filtrar ramos no grafo"
            />
            {searchQuery && (
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                onClick={() => setSearchQuery("")}
                aria-label="Limpar busca"
              >
                <MaterialIcon name="close" />
              </button>
            )}
          </div>

          {subjectOptions.length > 0 && (
            <label className="feed-select-wrap">
              <MaterialIcon name="account_tree" />
              <select
                className="feed-select"
                value={focus.kind === "subject" ? focus.subjectScope : ""}
                onChange={(e) => {
                  const scope = e.target.value;
                  if (!scope) {
                    onChangeFocus({ kind: "community" });
                    return;
                  }
                  const match = subjectOptions.find((s) => s.scope === scope);
                  if (match) {
                    onChangeFocus({
                      kind: "subject",
                      categoryId: match.categoryId,
                      subjectScope: match.scope,
                    });
                  }
                }}
                aria-label="Saltar para evolução de um assunto"
              >
                <option value="">Todas as categorias (árvores)</option>
                {subjectOptions.map((opt) => (
                  <option key={opt.scope} value={opt.scope}>
                    {opt.categoryTitle} › {opt.title} ({opt.proposalCount})
                  </option>
                ))}
              </select>
            </label>
          )}

          {focus.kind !== "community" && (
            <button
              type="button"
              className="btn btn--outlined btn--sm"
              onClick={() =>
                focus.kind === "subject"
                  ? onChangeFocus({
                      kind: "category",
                      categoryId: focus.categoryId,
                    })
                  : onChangeFocus({ kind: "community" })
              }
            >
              <MaterialIcon name="arrow_back" />
              <span>Subir nível</span>
            </button>
          )}
        </div>

        {layout && (
          <div className="graph-toolbar__meta">
            <div className="graph-stats gov-tabular">
              {focus.kind === "subject" ? (
                <>
                  <span>{layout.stats.proposalsCount} proposta(s)</span>
                  <span>· {layout.stats.forksCount} síntese(s)</span>
                  <span>· {layout.stats.totalPicks} apoio(s)</span>
                  <span>· Líder {layout.stats.leaderPct}%</span>
                </>
              ) : (
                <>
                  <span>{layout.stats.categoriesCount} categoria(s)</span>
                  <span>· {layout.stats.subjectsCount} assunto(s)</span>
                  <span>· {layout.stats.proposalsCount} proposta(s)</span>
                  <span>· {layout.stats.consensusCount} consenso(s)</span>
                </>
              )}
            </div>

            <div className="graph-legend" aria-label="Legenda do grafo">
              <span className="graph-legend__item">
                <span className="graph-legend__dot graph-legend__dot--primary" />
                <span>Líder / Ativo</span>
              </span>
              <span className="graph-legend__item">
                <span className="graph-legend__dot graph-legend__dot--consensus" />
                <span>Consenso</span>
              </span>
              <span className="graph-legend__item">
                <span className="graph-legend__dot graph-legend__dot--warning" />
                <span>Em síntese</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="graph-workspace">
        <div
          ref={viewportRef}
          className={
            isDragging
              ? "graph-viewport graph-viewport--dragging"
              : "graph-viewport"
          }
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {!layout ? (
            <div className="empty-state">
              <MaterialIcon name="sync" />
              <p className="md-body-medium">Carregando grafo da comunidade...</p>
            </div>
          ) : (
            <>
              <div
                className="graph-stage-transform"
                style={{
                  width: layout.width,
                  height: layout.height,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                {layout.trees.map(renderTree)}

                {layout.trees.every((t) => t.nodes.length === 0) && (
                  <div className="graph-empty-overlay" style={{ top: 180 }}>
                    <p className="md-body-medium">
                      {searchQuery
                        ? "Nenhum ramo corresponde à sua busca."
                        : focus.kind === "subject"
                          ? "Nenhuma proposta publicada neste assunto ainda."
                          : "Nenhum ramo cadastrado neste nível ainda."}
                    </p>
                    {focus.kind === "subject" && (
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() =>
                          onOpenSubjectInWorkspace(
                            focus.categoryId,
                            focus.subjectScope,
                          )
                        }
                      >
                        <MaterialIcon name="add" />
                        <span>Criar primeira proposta</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Controlador flutuante de zoom, espaçamento, expansão e foco */}
              <div
                className="graph-controls-pill"
                role="toolbar"
                aria-label="Controles do canvas do grafo"
              >
                <div className="graph-controls-pill__group">
                  <button
                    type="button"
                    className="graph-ctrl-btn"
                    onClick={() => applyZoomAtPoint(zoom + 0.15)}
                    title="Aumentar zoom"
                    aria-label="Aumentar zoom"
                  >
                    <MaterialIcon name="add" />
                  </button>
                  <button
                    type="button"
                    className="graph-ctrl-zoom-readout gov-tabular"
                    onClick={() => applyZoomAtPoint(1)}
                    title="Redefinir zoom para 100%"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    className="graph-ctrl-btn"
                    onClick={() => applyZoomAtPoint(zoom - 0.15)}
                    title="Diminuir zoom"
                    aria-label="Diminuir zoom"
                  >
                    <MaterialIcon name="remove" />
                  </button>
                </div>

                <span className="graph-controls-pill__sep" aria-hidden="true" />

                <label
                  className="graph-controls-pill__spacing"
                  title="Ajustar distância vertical entre os nós"
                >
                  <MaterialIcon name="unfold_more" />
                  <input
                    type="range"
                    className="graph-slider"
                    min={6}
                    max={40}
                    step={2}
                    value={nodeSpacing}
                    onChange={(e) => setNodeSpacing(Number(e.target.value))}
                    aria-label="Distância entre nós"
                  />
                  <span className="graph-ctrl-spacing-val gov-tabular">
                    {nodeSpacing}px
                  </span>
                </label>

                {focus.kind !== "subject" && (
                  <>
                    <span
                      className="graph-controls-pill__sep"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      className="graph-ctrl-action graph-ctrl-action--primary"
                      onClick={() => setShowProposals((prev) => !prev)}
                    >
                      <MaterialIcon
                        name={showProposals ? "unfold_less" : "unfold_more"}
                      />
                      <span>
                        {showProposals ? "Esconder todos" : "Mostrar todos"}
                      </span>
                    </button>
                  </>
                )}

                <span className="graph-controls-pill__sep" aria-hidden="true" />

                <button
                  type="button"
                  className="graph-ctrl-action"
                  onClick={handleFitFocus}
                  title="Centralizar e ajustar grafo na tela"
                >
                  <MaterialIcon name="center_focus_strong" />
                  <span>Focar</span>
                </button>
              </div>
            </>
          )}
        </div>

        {renderInspector()}
      </div>
    </div>
  );
}
