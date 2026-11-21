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
  buildGraphScene,
  CollapsedCategoryNode,
  getBranchCurvePath,
  GraphFocus,
  ProposalBranchNode,
  SpineSubjectNode,
} from "../utils/sankey-graph.js";
import { MaterialIcon } from "./MaterialIcon.js";
import { SupportersCollapsible } from "./SupportersCollapsible.js";

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

function collectBranchLineage(
  targetId: string | null,
  branches: readonly ProposalBranchNode[],
): ReadonlySet<string> {
  if (!targetId) {
    return new Set();
  }
  const byId = new Map<string, ProposalBranchNode>();
  const childrenMap = new Map<string, string[]>();
  for (const b of branches) {
    byId.set(b.id, b);
    const list = childrenMap.get(b.parentNodeId);
    if (list) {
      list.push(b.id);
    } else {
      childrenMap.set(b.parentNodeId, [b.id]);
    }
  }

  const result = new Set<string>();
  let curr = byId.get(targetId);
  while (curr) {
    result.add(curr.id);
    curr = byId.get(curr.parentNodeId);
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
  const [expandedSubjectScopes, setExpandedSubjectScopes] = useState<
    ReadonlySet<string>
  >(() =>
    focus.kind === "subject" ? new Set([focus.subjectScope]) : new Set(),
  );
  const [expandedProposalIds, setExpandedProposalIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [nodeSpacing, setNodeSpacing] = useState<number>(16);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ readonly x: number; readonly y: number }>({
    x: 0,
    y: 0,
  });
  const [isDragging, setIsDragging] = useState(false);

  const [hoveredBranchId, setHoveredBranchId] = useState<string | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    null,
  );

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
    setSelectedProposalId(null);
    setHoveredBranchId(null);
    if (focus.kind === "subject") {
      setExpandedSubjectScopes(new Set([focus.subjectScope]));
      const subjectForkParents = (projection?.proposals ?? [])
        .filter((p) => p.scope === focus.subjectScope && p.parentHashHex)
        .map((p) => p.parentHashHex!);
      setExpandedProposalIds(new Set(subjectForkParents));
    } else {
      setExpandedSubjectScopes(new Set());
      setExpandedProposalIds(new Set());
    }
  }, [projection?.communityId, focus]);

  useEffect(() => {
    if (projection) {
      setSearchQuery("");
    }
  }, [projection?.communityId]);

  const scene = useMemo(() => {
    if (!projection) {
      return null;
    }
    return buildGraphScene({
      projection,
      myPubHex,
      focus,
      expandedSubjectScopes,
      expandedProposalIds,
      nodeSpacing,
      searchQuery,
    });
  }, [
    projection,
    myPubHex,
    focus,
    expandedSubjectScopes,
    expandedProposalIds,
    nodeSpacing,
    searchQuery,
  ]);

  const handleFitFocus = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !scene) {
      return;
    }
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    if (vw <= 0 || vh <= 0) {
      return;
    }
    const padX = 48;
    const padY = 92;
    const fitScale = clampZoom(
      Math.min(1, (vw - padX) / scene.width, (vh - padY) / scene.height),
    );
    const nextX = Math.round((vw - scene.width * fitScale) / 2);
    const nextY = Math.round(
      Math.max(20, (vh - scene.height * fitScale - 36) / 2),
    );
    setZoom(fitScale);
    setPan({ x: nextX, y: nextY });
  }, [scene]);

  const focusKey =
    focus.kind === "community"
      ? "community"
      : focus.kind === "category"
        ? `cat:${focus.categoryId}`
        : `subj:${focus.categoryId}:${focus.subjectScope}`;

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
        setSelectedProposalId(null);
      }
    }
    dragStateRef.current = null;
    setIsDragging(false);
  };

  const categoryOptions = useMemo(() => {
    if (!projection) {
      return [];
    }
    const counts = new Map<string, number>();
    const knownIds = new Set(projection.categories.map((c) => c.docIdHex));
    for (const s of projection.subjects) {
      const cid =
        s.categoryHashHex && knownIds.has(s.categoryHashHex)
          ? s.categoryHashHex
          : GENERAL_CATEGORY_ID;
      counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }

    const list: Array<{ id: string; title: string; subjectCount: number }> =
      projection.categories.map((c) => ({
        id: c.docIdHex,
        title: c.title,
        subjectCount: counts.get(c.docIdHex) ?? 0,
      }));
    if (counts.has(GENERAL_CATEGORY_ID) || list.length === 0) {
      list.unshift({
        id: GENERAL_CATEGORY_ID,
        title: "Geral",
        subjectCount: counts.get(GENERAL_CATEGORY_ID) ?? 0,
      });
    }
    return list;
  }, [projection]);

  const activeCategoryId =
    focus.kind === "community" ? null : focus.categoryId;
  const activeCategoryTitle =
    activeCategoryId !== null
      ? (categoryOptions.find((c) => c.id === activeCategoryId)?.title ?? "Geral")
      : null;

  const activeHighlightBranchId =
    hoveredBranchId ?? (selectedProposalId ? `prop-${selectedProposalId}` : null);

  const highlightedBranchIds = useMemo(() => {
    if (!scene || scene.kind !== "category-tree") {
      return new Set<string>();
    }
    return collectBranchLineage(activeHighlightBranchId, scene.branches);
  }, [scene, activeHighlightBranchId]);

  const selectedBranch: ProposalBranchNode | null = useMemo(() => {
    if (!scene || scene.kind !== "category-tree" || !selectedProposalId) {
      return null;
    }
    return (
      scene.branches.find((b) => b.proposal.docIdHex === selectedProposalId) ??
      null
    );
  }, [scene, selectedProposalId]);

  const toggleSubjectExpand = (scope: string) => {
    setExpandedSubjectScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) {
        next.delete(scope);
      } else {
        next.add(scope);
      }
      return next;
    });
  };

  const toggleProposalExpand = (docIdHex: string) => {
    setExpandedProposalIds((prev) => {
      const next = new Set(prev);
      if (next.has(docIdHex)) {
        next.delete(docIdHex);
      } else {
        next.add(docIdHex);
      }
      return next;
    });
  };

  const allSubjectsExpanded =
    scene?.kind === "category-tree" &&
    scene.subjects.length > 0 &&
    scene.subjects.every((s) => expandedSubjectScopes.has(s.subject.scope));

  const toggleAllSubjects = () => {
    if (scene?.kind !== "category-tree") {
      return;
    }
    if (allSubjectsExpanded) {
      setExpandedSubjectScopes(new Set());
      setExpandedProposalIds(new Set());
    } else {
      const allScopes = new Set(scene.subjects.map((s) => s.subject.scope));
      setExpandedSubjectScopes(allScopes);
      const allForkParents = (projection?.proposals ?? [])
        .filter((p) => allScopes.has(p.scope) && p.parentHashHex)
        .map((p) => p.parentHashHex!);
      setExpandedProposalIds(new Set(allForkParents));
    }
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

      {activeCategoryTitle && (
        <>
          <span className="graph-crumb-sep" aria-hidden="true">
            /
          </span>
          <span className="graph-crumb graph-crumb--active">
            <MaterialIcon name="category" />
            <span>{activeCategoryTitle}</span>
          </span>
        </>
      )}
    </nav>
  );

  const renderInspectorDrawer = () => {
    if (!selectedBranch || !projection) {
      return null;
    }
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
    } = selectedBranch;

    const authorLabel = resolveMemberLabel(
      proposal.authorPubHex,
      myPubHex,
      projection.members,
    );

    return (
      <>
        <div
          className="graph-inspector-backdrop"
          onClick={() => setSelectedProposalId(null)}
          aria-hidden="true"
        />
        <aside className="graph-inspector" aria-label="Detalhes da proposta">
          <div className="graph-inspector__header">
            <div className="graph-inspector__type">
              <span className="chip chip--stze">
                {proposal.parentHashHex ? "Ramificação / Síntese" : "Proposta"}
              </span>
              {quorumReached && <span className="chip chip--memb">Consenso</span>}
            </div>
            <button
              type="button"
              className="icon-btn icon-btn--xs"
              onClick={() => setSelectedProposalId(null)}
              aria-label="Fechar detalhes"
            >
              <MaterialIcon name="close" />
            </button>
          </div>

          <div className="graph-inspector__title-block">
            <h2 className="md-title-medium">{proposal.title}</h2>
            <p className="md-label-medium">
              {categoryTitle} · #{subject.title}
            </p>
          </div>

          <div className="graph-inspector__quorum">
            <div className="graph-inspector__quorum-head gov-tabular">
              <strong>
                {proposal.quorumPct === null
                  ? `Assunto aberto · ${proposal.pickCount} apoio(s)`
                  : quorumReached
                    ? `Consenso atingido (${proposal.pickCount} apoios)`
                    : `${proposal.pickCount} de ${requiredVotes} apoios (${quorumProgressPct}%)`}
              </strong>
            </div>
            {proposal.quorumPct !== null && (
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
            )}
            {proposal.deadlineUnixSeconds !== null && (
              <p className="md-label-medium" style={{ marginTop: 6 }}>
                {proposal.isVotingOpen
                  ? `Prazo até ${formatDateMs(proposal.deadlineUnixSeconds * 1000)}`
                  : `Prazo encerrado em ${formatDateMs(proposal.deadlineUnixSeconds * 1000)} (${proposal.status === "APPROVED" ? "Aprovada" : "Expirada"})`}
              </p>
            )}
          </div>

          {parentProposal && (
            <button
              type="button"
              className="graph-inspector__lineage-btn"
              onClick={() => setSelectedProposalId(parentProposal.docIdHex)}
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

          <SupportersCollapsible
            supporterPubs={proposal.supporterPubs}
            members={projection.members}
            myPubHex={myPubHex}
          />

          {childForks.length > 0 && (
            <div className="graph-inspector__forks">
              <span className="md-label-medium">
                Ramificações derivadas ({childForks.length})
              </span>
              <div className="graph-inspector__fork-list">
                {childForks.map((child) => (
                  <button
                    key={child.docIdHex}
                    type="button"
                    className="graph-inspector__fork-chip"
                    onClick={() => setSelectedProposalId(child.docIdHex)}
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
                disabled={busy || !proposal.isVotingOpen}
                onClick={() =>
                  void onPickProposal(proposal.scope, proposal.docIdHex)
                }
                title={
                  proposal.isVotingOpen
                    ? "Apoiar esta proposta"
                    : "Prazo de votação encerrado"
                }
              >
                <MaterialIcon name="how_to_vote" />
                <span className="gov-tabular">
                  {proposal.isVotingOpen ? "Apoiar" : "Encerrada"} · {proposal.pickCount}
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
  };

  const renderCollapsedCategoryNode = (cat: CollapsedCategoryNode) => (
    <button
      key={cat.id}
      type="button"
      className={`graph-cat-node graph-cat-node--${cat.tone}`}
      style={{ left: cat.x, top: cat.y }}
      onClick={() =>
        onChangeFocus({ kind: "category", categoryId: cat.categoryId })
      }
      title={`Abrir grafo da categoria ${cat.title}`}
    >
      <div className="graph-cat-node__top">
        <span
          className={`graph-cat-node__dot graph-cat-node__dot--${cat.tone}`}
          aria-hidden="true"
        />
        <span className="graph-cat-node__title">{cat.title}</span>
        <span className="graph-cat-node__count gov-tabular">
          {cat.subjectCount}
        </span>
      </div>
      <div className="graph-cat-node__meta gov-tabular">
        <span>
          {cat.subjectCount}{" "}
          {cat.subjectCount === 1 ? "assunto" : "assuntos"}
        </span>
        {cat.proposalCount > 0 && <span>· {cat.proposalCount} prop.</span>}
        {cat.consensusCount > 0 && (
          <span className="graph-cat-node__consensus">
            · {cat.consensusCount} ✓
          </span>
        )}
      </div>
    </button>
  );

  const renderSpineSubject = (subjNode: SpineSubjectNode) => {
    const labelStyle =
      subjNode.labelSide === "left"
        ? {
            right:
              (scene?.kind === "category-tree" ? scene.width - scene.spineX : 0) +
              16,
            top: subjNode.y,
          }
        : {
            left:
              (scene?.kind === "category-tree" ? scene.spineX : 0) + 16,
            top: subjNode.y,
          };

    return (
      <div key={subjNode.id}>
        <button
          type="button"
          className={[
            "graph-spine-subject",
            `graph-spine-subject--${subjNode.tone}`,
            subjNode.expanded ? "graph-spine-subject--expanded" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            left: scene?.kind === "category-tree" ? scene.spineX : 0,
            top: subjNode.y,
          }}
          onClick={() => toggleSubjectExpand(subjNode.subject.scope)}
          title={
            subjNode.expanded
              ? "Clique para recolher propostas"
              : "Clique para abrir ramificação de propostas"
          }
          aria-expanded={subjNode.expanded}
          aria-label={`${subjNode.subject.title} (${subjNode.proposalCount} propostas)`}
        />

        <button
          type="button"
          className={[
            "graph-spine-subj-label",
            `graph-spine-subj-label--${subjNode.labelSide}`,
            subjNode.expanded ? "graph-spine-subj-label--expanded" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={labelStyle}
          onClick={() => toggleSubjectExpand(subjNode.subject.scope)}
          onDoubleClick={() =>
            onOpenSubjectInWorkspace(
              subjNode.categoryId,
              subjNode.subject.scope,
            )
          }
          title={
            subjNode.proposalCount > 0
              ? `${subjNode.subject.title} — clique para ${subjNode.expanded ? "recolher" : "abrir"} propostas`
              : `${subjNode.subject.title} — sem propostas ainda`
          }
        >
          <span className="graph-spine-subj-label__line">
            <span className="graph-spine-subj-label__title">
              {subjNode.subject.title}
            </span>
            <span className="graph-spine-subj-label__count gov-tabular">
              ({subjNode.proposalCount})
            </span>
            {subjNode.quorumReached && (
              <span className="graph-arm__check" title="Consenso atingido">
                ✓
              </span>
            )}
          </span>
          <span className="graph-spine-subj-label__date gov-tabular">
            {subjNode.dateLabel}
          </span>
        </button>
      </div>
    );
  };

  const renderBranchNode = (branch: ProposalBranchNode) => {
    const isHighlighted =
      highlightedBranchIds.size === 0 || highlightedBranchIds.has(branch.id);
    const isSelected = selectedProposalId === branch.proposal.docIdHex;

    const positionStyle =
      branch.side === "right"
        ? { left: branch.x - 7, top: branch.y }
        : {
            right:
              (scene?.kind === "category-tree" ? scene.width - branch.x : 0) - 7,
            top: branch.y,
          };

    const dotElement = (
      <span
        className={[
          "graph-arm__dot",
          `graph-arm__dot--${branch.tone}`,
          branch.isMyPick ? "graph-arm__dot--mypick" : "",
          isSelected ? "graph-arm__dot--selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      />
    );

    const textBlock = (
      <span
        className={`graph-branch__text graph-branch__text--${branch.side}`}
      >
        <span className="graph-branch__title-row">
          <span className="graph-branch__title">{branch.title}</span>
          {branch.quorumReached && (
            <span className="graph-arm__check" title="Consenso atingido">
              ✓
            </span>
          )}
        </span>
        <span className="graph-branch__supports gov-tabular">
          {branch.pickCount} {branch.pickCount === 1 ? "apoio" : "apoios"}
          {branch.isMyPick ? " · Você" : ""}
        </span>
      </span>
    );

    const forkToggle =
      branch.childCount > 0 ? (
        <span
          role="button"
          tabIndex={0}
          className={
            branch.expanded
              ? "graph-branch__fork-toggle graph-branch__fork-toggle--open gov-tabular"
              : "graph-branch__fork-toggle gov-tabular"
          }
          onClick={(e) => {
            e.stopPropagation();
            toggleProposalExpand(branch.proposal.docIdHex);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              toggleProposalExpand(branch.proposal.docIdHex);
            }
          }}
          title={
            branch.expanded
              ? "Esconder ramificações"
              : `Abrir ${branch.childCount} ramificação(ões)`
          }
          aria-expanded={branch.expanded}
        >
          <span>{branch.childCount}</span>
        </span>
      ) : null;

    return (
      <button
        key={branch.id}
        type="button"
        className={[
          "graph-branch",
          `graph-branch--${branch.side}`,
          `graph-branch--${branch.tone}`,
          branch.childCount > 0 ? "graph-branch--has-children" : "",
          isSelected ? "graph-branch--selected" : "",
          !isHighlighted ? "graph-arm--dimmed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={positionStyle}
        onMouseEnter={() => setHoveredBranchId(branch.id)}
        onMouseLeave={() => setHoveredBranchId(null)}
        onClick={() =>
          setSelectedProposalId((prev) =>
            prev === branch.proposal.docIdHex ? null : branch.proposal.docIdHex,
          )
        }
        title={`${branch.title} — clique para abrir detalhes`}
      >
        {branch.side === "right" ? (
          <>
            <span className="graph-branch__main">
              {dotElement}
              {textBlock}
            </span>
            {forkToggle}
          </>
        ) : (
          <>
            {forkToggle}
            <span className="graph-branch__main">
              {textBlock}
              {dotElement}
            </span>
          </>
        )}
      </button>
    );
  };

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
          {activeCategoryId !== null && (
            <button
              type="button"
              className="btn btn--outlined btn--sm"
              onClick={() => onOpenCategoryInWorkspace(activeCategoryId)}
            >
              <MaterialIcon name="open_in_new" />
              <span>Abrir no Workspace</span>
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
              placeholder={
                focus.kind === "community"
                  ? "Buscar categoria..."
                  : "Buscar assunto ou proposta..."
              }
              aria-label="Filtrar no grafo"
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

          {categoryOptions.length > 0 && (
            <label className="feed-select-wrap">
              <MaterialIcon name="category" />
              <select
                className="feed-select"
                value={activeCategoryId ?? ""}
                onChange={(e) => {
                  const catId = e.target.value;
                  if (!catId) {
                    onChangeFocus({ kind: "community" });
                  } else {
                    onChangeFocus({ kind: "category", categoryId: catId });
                  }
                }}
                aria-label="Escolher categoria do grafo"
              >
                <option value="">Todas as categorias (mapa)</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.title} ({cat.subjectCount})
                  </option>
                ))}
              </select>
            </label>
          )}

          {focus.kind !== "community" && (
            <button
              type="button"
              className="btn btn--outlined btn--sm"
              onClick={() => onChangeFocus({ kind: "community" })}
            >
              <MaterialIcon name="arrow_back" />
              <span>Ver categorias</span>
            </button>
          )}
        </div>

        {scene && (
          <div className="graph-toolbar__meta">
            <div className="graph-stats gov-tabular">
              {scene.kind === "community-map" ? (
                <>
                  <span>{scene.stats.categoriesCount} categoria(s)</span>
                  <span>· {scene.stats.subjectsCount} assunto(s)</span>
                  <span>· {scene.stats.proposalsCount} proposta(s)</span>
                </>
              ) : (
                <>
                  <span>{scene.stats.subjectsCount} assunto(s)</span>
                  <span>· {scene.stats.proposalsCount} proposta(s)</span>
                  <span>· {scene.stats.totalPicks} apoio(s)</span>
                  <span>· {scene.stats.consensusCount} consenso(s)</span>
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
          {!scene ? (
            <div className="empty-state">
              <MaterialIcon name="sync" />
              <p className="md-body-medium">Carregando grafo da comunidade...</p>
            </div>
          ) : (
            <>
              <div
                className="graph-stage-transform"
                style={{
                  width: scene.width,
                  height: scene.height,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                {scene.kind === "community-map" ? (
                  <>
                    {scene.categories.map(renderCollapsedCategoryNode)}
                    {scene.categories.length === 0 && (
                      <div className="graph-empty-overlay" style={{ top: 140 }}>
                        <p className="md-body-medium">
                          Nenhuma categoria encontrada com esse filtro.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    className="graph-tree"
                    style={{
                      left: 0,
                      top: 0,
                      width: scene.width,
                      height: scene.height,
                    }}
                  >
                    <svg
                      className="graph-svg"
                      width={scene.width}
                      height={scene.height}
                      viewBox={`0 0 ${scene.width} ${scene.height}`}
                      aria-hidden="true"
                    >
                      {/* Tronco vertical da categoria */}
                      <line
                        x1={scene.spineX}
                        y1={scene.spineTopY}
                        x2={scene.spineX}
                        y2={scene.spineBottomY}
                        stroke="#2563eb"
                        strokeWidth={10}
                        strokeOpacity={0.09}
                        strokeLinecap="round"
                      />
                      <line
                        x1={scene.spineX}
                        y1={scene.spineTopY}
                        x2={scene.spineX}
                        y2={scene.spineBottomY}
                        stroke="#2563eb"
                        strokeWidth={3.5}
                        strokeLinecap="round"
                      />

                      {/* Ramificações de propostas e sínteses */}
                      {scene.branches.map((branch) => {
                        const pathD = getBranchCurvePath(branch);
                        const strokeColor = TONE_COLOR[branch.tone];
                        const isHighlighted =
                          highlightedBranchIds.size === 0 ||
                          highlightedBranchIds.has(branch.id);
                        const isFocused = highlightedBranchIds.has(branch.id);
                        const opacity = isHighlighted ? 1 : 0.24;

                        return (
                          <g
                            key={branch.id}
                            style={{
                              opacity,
                              transition: "opacity 140ms ease",
                            }}
                          >
                            <path
                              d={pathD}
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth={
                                branch.strokeWidth + (isFocused ? 8 : 5)
                              }
                              strokeOpacity={isFocused ? 0.18 : 0.07}
                              strokeLinecap="round"
                            />
                            <path
                              d={pathD}
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth={branch.strokeWidth}
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      })}
                    </svg>

                    {/* Assuntos ao longo do tronco */}
                    {scene.subjects.map(renderSpineSubject)}

                    {/* Nó base: criação [categoria] */}
                    <div
                      className="graph-spine-creation"
                      style={{
                        left: scene.spineX,
                        top: scene.spineBottomY,
                      }}
                    >
                      <span
                        className="graph-spine-creation__dot"
                        aria-hidden="true"
                      />
                      <div className="graph-spine-creation__text">
                        <span className="graph-spine-creation__title">
                          {scene.creationLabel}
                        </span>
                        <span className="graph-spine-creation__date gov-tabular">
                          {scene.creationDateLabel}
                        </span>
                      </div>
                    </div>

                    {/* Nós de propostas e ramificações */}
                    {scene.branches.map(renderBranchNode)}

                    {scene.subjects.length === 0 && (
                      <div
                        className="graph-empty-overlay"
                        style={{ top: scene.spineTopY + 12 }}
                      >
                        <p className="md-body-medium">
                          {searchQuery
                            ? "Nenhum assunto corresponde à busca."
                            : "Nenhum assunto criado nesta categoria ainda."}
                        </p>
                      </div>
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

                {scene.kind === "category-tree" && (
                  <>
                    <span
                      className="graph-controls-pill__sep"
                      aria-hidden="true"
                    />
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

                    <span
                      className="graph-controls-pill__sep"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      className="graph-ctrl-action graph-ctrl-action--primary"
                      onClick={toggleAllSubjects}
                    >
                      <MaterialIcon
                        name={
                          allSubjectsExpanded ? "unfold_less" : "unfold_more"
                        }
                      />
                      <span>
                        {allSubjectsExpanded
                          ? "Esconder todos"
                          : "Mostrar todos"}
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

        {renderInspectorDrawer()}
      </div>
    </div>
  );
}
