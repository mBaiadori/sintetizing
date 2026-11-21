import type {
  CategorySummaryView,
  CommunityConfigVersion,
  CommunityProjection,
  ProposalSummaryView,
  SubjectSummaryView,
} from "@sintetizing/domain";
import { useEffect, useMemo, useState } from "react";
import {
  computeHeatInfo,
  formatDeadlineShort,
  GENERAL_CATEGORY_ID,
  HeatInfo,
  shortHex,
} from "../utils/format.js";
import { MaterialIcon } from "./MaterialIcon.js";

export interface CommunityFeedViewProps {
  readonly myPubHex: string;
  readonly communityTitle: string;
  readonly projection: CommunityProjection | null;
  readonly hiddenDocIds?: ReadonlySet<string> | undefined;
  readonly sidebarCollapsed: boolean;
  readonly busy: boolean;
  readonly onToggleSidebar: () => void;
  readonly onOpenSubject: (categoryId: string, scope: string) => void;
  readonly onOpenProposal: (
    categoryId: string,
    scope: string,
    proposalId: string
  ) => void;
  readonly onRequestNewSubject: (categoryId: string) => void;
  readonly onPickProposal: (scope: string, docIdHex: string) => Promise<void>;
  readonly onShareProposal: (proposal: ProposalSummaryView) => Promise<void>;
  readonly onSupportConfigVersion: (targetDocIdHex: string) => Promise<void>;
  readonly onOpenCommunitySettings: () => void;
}

type FeedMode = "subjects" | "proposals";
type StatusFilter = "all" | "needs-my-pick" | "near-quorum" | "reached" | "my-picks";
type SortBy = "quorum" | "activity" | "recent" | "picks";

const ALL_CATEGORIES_FILTER = "__all__";

interface SubjectFeedItem {
  readonly subject: SubjectSummaryView;
  readonly categoryId: string;
  readonly categoryTitle: string;
  readonly requiredVotes: number;
  readonly proposals: readonly ProposalSummaryView[];
  readonly leadingProposal: ProposalSummaryView | null;
  readonly myPickedProposal: ProposalSummaryView | null;
  readonly heat: HeatInfo;
  readonly lastActivityMs: number;
}

interface ProposalFeedItem {
  readonly proposal: ProposalSummaryView;
  readonly subject: SubjectSummaryView | null;
  readonly categoryId: string;
  readonly categoryTitle: string;
  readonly authorLabel: string;
  readonly requiredVotes: number;
  readonly heat: HeatInfo;
  readonly isMyPick: boolean;
  readonly isFork: boolean;
  readonly lastActivityMs: number;
}

function matchesStatusFilter(
  filter: StatusFilter,
  heat: HeatInfo,
  hasMyPick: boolean,
  hasProposals: boolean
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "needs-my-pick":
      return hasProposals && !hasMyPick;
    case "near-quorum":
      return !heat.quorumReached && heat.quorumProgressPct >= 50;
    case "reached":
      return heat.quorumReached;
    case "my-picks":
      return hasMyPick;
  }
}

function compareBySort(
  sortBy: SortBy,
  aHeat: HeatInfo,
  bHeat: HeatInfo,
  aPicks: number,
  bPicks: number,
  aCreatedMs: number,
  bCreatedMs: number,
  aActivityMs: number,
  bActivityMs: number
): number {
  switch (sortBy) {
    case "quorum":
      return (
        bHeat.quorumProgressPct - aHeat.quorumProgressPct ||
        bPicks - aPicks ||
        bActivityMs - aActivityMs
      );
    case "activity":
      return bActivityMs - aActivityMs || bPicks - aPicks;
    case "recent":
      return bCreatedMs - aCreatedMs;
    case "picks":
      return bPicks - aPicks || bActivityMs - aActivityMs;
  }
}

export function CommunityFeedView({
  myPubHex,
  communityTitle,
  projection,
  hiddenDocIds,
  sidebarCollapsed,
  busy,
  onToggleSidebar,
  onOpenSubject,
  onOpenProposal,
  onRequestNewSubject,
  onPickProposal: _onPickProposal,
  onShareProposal: _onShareProposal,
  onSupportConfigVersion,
  onOpenCommunitySettings,
}: CommunityFeedViewProps) {
  const [feedMode, setFeedMode] = useState<FeedMode>("subjects");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES_FILTER);
  const [sortBy, setSortBy] = useState<SortBy>("quorum");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setStatusFilter("all");
    setCategoryFilter(ALL_CATEGORIES_FILTER);
    setSearchQuery("");
  }, [projection?.communityId]);

  useEffect(() => {
    if (
      categoryFilter !== ALL_CATEGORIES_FILTER &&
      categoryFilter !== GENERAL_CATEGORY_ID &&
      projection &&
      !projection.categories.some((c) => c.docIdHex === categoryFilter)
    ) {
      setCategoryFilter(ALL_CATEGORIES_FILTER);
    }
  }, [categoryFilter, projection]);

  const { subjectItems, proposalItems, pendingConfigs } =
    useMemo(() => {
      if (!projection) {
        return {
          subjectItems: [] as SubjectFeedItem[],
          proposalItems: [] as ProposalFeedItem[],
          pendingConfigs: [] as CommunityConfigVersion[],
        };
      }

      const categoryMap = new Map<string, CategorySummaryView>();
      for (const cat of projection.categories) {
        categoryMap.set(cat.docIdHex, cat);
      }

      const resolveCategory = (
        categoryHashHex: string | null
      ): { id: string; title: string } => {
        if (categoryHashHex) {
          const matched = categoryMap.get(categoryHashHex);
          if (matched) {
            return { id: matched.docIdHex, title: matched.title };
          }
        }
        return { id: GENERAL_CATEGORY_ID, title: "Geral" };
      };

      const memberNameMap = new Map<string, string>();
      for (const m of projection.members) {
        if (m.displayName) {
          memberNameMap.set(m.pubHex, m.displayName);
        }
      }

      const visibleSubjectRecords = projection.subjects.filter(
        (s) => !hiddenDocIds?.has(s.docIdHex)
      );
      const visibleProposalRecords = projection.proposals.filter(
        (p) => !hiddenDocIds?.has(p.docIdHex) && p.supersededByDocIdHex === null
      );

      const subjectByScope = new Map<string, SubjectSummaryView>();
      const lastActivityByScope = new Map<string, number>();
      for (const subj of visibleSubjectRecords) {
        subjectByScope.set(subj.scope, subj);
        lastActivityByScope.set(subj.scope, subj.timestampMs);
      }

      const lastActivityByProposal = new Map<string, number>();
      const proposalsByScope = new Map<string, ProposalSummaryView[]>();
      for (const prop of visibleProposalRecords) {
        lastActivityByProposal.set(prop.docIdHex, prop.timestampMs);

        const prevScopeTs = lastActivityByScope.get(prop.scope) ?? 0;
        if (prop.timestampMs > prevScopeTs) {
          lastActivityByScope.set(prop.scope, prop.timestampMs);
        }

        const list = proposalsByScope.get(prop.scope);
        if (list) {
          list.push(prop);
        } else {
          proposalsByScope.set(prop.scope, [prop]);
        }
      }

      for (const entry of projection.pickHistory) {
        if (entry.kind !== "PROPOSAL") {
          continue;
        }
        const prevScopeTs = lastActivityByScope.get(entry.scope) ?? 0;
        if (entry.timestampMs > prevScopeTs) {
          lastActivityByScope.set(entry.scope, entry.timestampMs);
        }
        const prevPropTs = lastActivityByProposal.get(entry.targetHashHex) ?? 0;
        if (entry.timestampMs > prevPropTs) {
          lastActivityByProposal.set(entry.targetHashHex, entry.timestampMs);
        }
      }

      const builtSubjects: SubjectFeedItem[] = visibleSubjectRecords.map((subject) => {
        const cat = resolveCategory(subject.categoryHashHex);
        const requiredVotes = subject.requiredVotes;
        const sortedProposals = [...(proposalsByScope.get(subject.scope) ?? [])].sort(
          (a, b) => b.pickCount - a.pickCount || b.timestampMs - a.timestampMs
        );
        const leadingProposal = sortedProposals[0] ?? null;
        const myPickedProposal =
          sortedProposals.find((p) => p.supporterPubs.includes(myPubHex)) ?? null;
        const heat =
          subject.quorumPct === null
            ? { quorumProgressPct: 0, quorumReached: false }
            : computeHeatInfo(leadingProposal?.pickCount ?? 0, requiredVotes);
        const lastActivityMs =
          lastActivityByScope.get(subject.scope) ?? subject.timestampMs;

        return {
          subject,
          categoryId: cat.id,
          categoryTitle: cat.title,
          requiredVotes,
          proposals: sortedProposals,
          leadingProposal,
          myPickedProposal,
          heat,
          lastActivityMs,
        };
      });

      const builtProposals: ProposalFeedItem[] = visibleProposalRecords.map((proposal) => {
        const subject = subjectByScope.get(proposal.scope) ?? null;
        const cat = resolveCategory(subject?.categoryHashHex ?? null);
        const requiredVotes = proposal.requiredVotes;
        const heat =
          proposal.quorumPct === null
            ? { quorumProgressPct: 0, quorumReached: false }
            : computeHeatInfo(proposal.pickCount, requiredVotes);
        const authorLabel =
          proposal.authorName ??
          memberNameMap.get(proposal.authorPubHex) ??
          shortHex(proposal.authorPubHex);
        const lastActivityMs =
          lastActivityByProposal.get(proposal.docIdHex) ?? proposal.timestampMs;

        return {
          proposal,
          subject,
          categoryId: cat.id,
          categoryTitle: cat.title,
          authorLabel,
          requiredVotes,
          heat,
          isMyPick: proposal.supporterPubs.includes(myPubHex),
          isFork: proposal.parentHashHex !== null,
          lastActivityMs,
        };
      });

      return {
        subjectItems: builtSubjects,
        proposalItems: builtProposals,
        pendingConfigs: projection.configVersions.filter((v) => v.status === "PENDING"),
      };
    }, [projection, myPubHex, hiddenDocIds]);

  const categories = projection?.categories ?? [];

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const statusCounts = useMemo(() => {
    if (feedMode === "subjects") {
      return {
        all: subjectItems.length,
        needsMyPick: subjectItems.filter(
          (i) => i.proposals.length > 0 && i.myPickedProposal === null
        ).length,
        nearQuorum: subjectItems.filter(
          (i) => !i.heat.quorumReached && i.heat.quorumProgressPct >= 50
        ).length,
        reached: subjectItems.filter((i) => i.heat.quorumReached).length,
        myPicks: subjectItems.filter((i) => i.myPickedProposal !== null).length,
      };
    }

    return {
      all: proposalItems.length,
      needsMyPick: proposalItems.filter((i) => !i.isMyPick).length,
      nearQuorum: proposalItems.filter(
        (i) => !i.heat.quorumReached && i.heat.quorumProgressPct >= 50
      ).length,
      reached: proposalItems.filter((i) => i.heat.quorumReached).length,
      myPicks: proposalItems.filter((i) => i.isMyPick).length,
    };
  }, [feedMode, subjectItems, proposalItems]);

  const visibleSubjects = useMemo(() => {
    const filtered = subjectItems.filter((item) => {
      if (
        !matchesStatusFilter(
          statusFilter,
          item.heat,
          item.myPickedProposal !== null,
          item.proposals.length > 0
        )
      ) {
        return false;
      }
      if (
        categoryFilter !== ALL_CATEGORIES_FILTER &&
        item.categoryId !== categoryFilter
      ) {
        return false;
      }
      if (normalizedQuery) {
        const haystack = [
          item.subject.title,
          item.subject.body,
          item.categoryTitle,
          item.leadingProposal?.title ?? "",
          item.leadingProposal?.body ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }
      return true;
    });

    return [...filtered].sort((a, b) =>
      compareBySort(
        sortBy,
        a.heat,
        b.heat,
        a.leadingProposal?.pickCount ?? 0,
        b.leadingProposal?.pickCount ?? 0,
        a.subject.timestampMs,
        b.subject.timestampMs,
        a.lastActivityMs,
        b.lastActivityMs
      )
    );
  }, [subjectItems, statusFilter, categoryFilter, normalizedQuery, sortBy]);

  const visibleProposals = useMemo(() => {
    const filtered = proposalItems.filter((item) => {
      if (!matchesStatusFilter(statusFilter, item.heat, item.isMyPick, true)) {
        return false;
      }
      if (
        categoryFilter !== ALL_CATEGORIES_FILTER &&
        item.categoryId !== categoryFilter
      ) {
        return false;
      }
      if (normalizedQuery) {
        const haystack = [
          item.proposal.title,
          item.proposal.body,
          item.authorLabel,
          item.categoryTitle,
          item.subject?.title ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }
      return true;
    });

    return [...filtered].sort((a, b) =>
      compareBySort(
        sortBy,
        a.heat,
        b.heat,
        a.proposal.pickCount,
        b.proposal.pickCount,
        a.proposal.timestampMs,
        b.proposal.timestampMs,
        a.lastActivityMs,
        b.lastActivityMs
      )
    );
  }, [proposalItems, statusFilter, categoryFilter, normalizedQuery, sortBy]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    categoryFilter !== ALL_CATEGORIES_FILTER ||
    normalizedQuery.length > 0;

  const clearFilters = () => {
    setStatusFilter("all");
    setCategoryFilter(ALL_CATEGORIES_FILTER);
    setSearchQuery("");
  };

  const targetNewSubjectCategory =
    categoryFilter !== ALL_CATEGORIES_FILTER ? categoryFilter : GENERAL_CATEGORY_ID;

  const totalItemsInMode =
    feedMode === "subjects" ? subjectItems.length : proposalItems.length;
  const visibleItemsCount =
    feedMode === "subjects" ? visibleSubjects.length : visibleProposals.length;

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

          <div className="channel-heading">
            <div className="channel-title-wrap">
              <MaterialIcon name="dynamic_feed" />
              <h1 className="channel-title">{communityTitle}</h1>
            </div>
            <span className="channel-topbar__divider" aria-hidden="true" />
            <p className="channel-topbar__topic">Home</p>
          </div>
        </div>

        <div className="channel-topbar__actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={busy}
            onClick={() => onRequestNewSubject(targetNewSubjectCategory)}
          >
            <MaterialIcon name="add" />
            <span>Novo assunto</span>
          </button>
        </div>
      </header>

      <div className="subview-scroll">
        <div className="subview-container feed-container">
          {/* Alerta de governança para alterações de estatuto pendentes */}
          {pendingConfigs.length > 0 && (
            <section
              className="feed-governance-card"
              aria-label="Alterações de estatuto pendentes"
            >
              <div className="feed-governance-card__header">
                <div className="channel-title-wrap">
                  <MaterialIcon name="gavel" />
                  <h2 className="md-title-medium">
                    Alteração de estatuto pendente de quórum
                  </h2>
                </div>
                <button
                  type="button"
                  className="btn btn--sm btn--outlined"
                  onClick={onOpenCommunitySettings}
                >
                  <MaterialIcon name="tune" />
                  <span>Ver regras</span>
                </button>
              </div>

              <div className="feed-governance-card__list">
                {pendingConfigs.map((ver) => {
                  const supportedByMe = ver.supporterPubs.includes(myPubHex);
                  return (
                    <div key={ver.docIdHex} className="feed-governance-row">
                      <div className="feed-governance-row__info">
                        <strong className="md-title-medium">{ver.title}</strong>
                        <p className="md-body-medium">
                          Quórum {ver.quorumPct}% · Inatividade {ver.inactivityDays} dias
                          {ver.body ? ` — ${ver.body}` : ""}
                        </p>
                      </div>

                      {supportedByMe ? (
                        <button
                          type="button"
                          className="btn btn--sm btn--consensus"
                          disabled
                        >
                          <MaterialIcon name="check_circle" filled />
                          <span className="gov-tabular">
                            Apoiado ({ver.supportCount}/{ver.requiredSupports})
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          disabled={busy}
                          onClick={() => void onSupportConfigVersion(ver.docIdHex)}
                        >
                          <MaterialIcon name="how_to_vote" />
                          <span className="gov-tabular">
                            Apoiar ({ver.supportCount}/{ver.requiredSupports})
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Barra compacta de modo, acesso rápido, busca e ordenação */}
          <section className="feed-toolbar" aria-label="Controles da home">
            <div className="feed-toolbar__row">
              <div
                className="segmented-tabs feed-mode-tabs"
                role="tablist"
                aria-label="Visualização da home"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={feedMode === "subjects"}
                  className={
                    feedMode === "subjects"
                      ? "segmented-tab segmented-tab--active"
                      : "segmented-tab"
                  }
                  onClick={() => setFeedMode("subjects")}
                >
                  <MaterialIcon name="forum" />
                  <span className="gov-tabular">
                    Assuntos ({subjectItems.length})
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={feedMode === "proposals"}
                  className={
                    feedMode === "proposals"
                      ? "segmented-tab segmented-tab--active"
                      : "segmented-tab"
                  }
                  onClick={() => setFeedMode("proposals")}
                >
                  <MaterialIcon name="ballot" />
                  <span className="gov-tabular">
                    Propostas ({proposalItems.length})
                  </span>
                </button>
              </div>

              <div
                className="feed-quick-filters"
                role="group"
                aria-label="Filtros rápidos de situação"
              >
                {(
                  [
                    {
                      id: "all",
                      label: "Tudo",
                      icon: "list",
                      count: statusCounts.all,
                    },
                    {
                      id: "needs-my-pick",
                      label: "Sem meu apoio",
                      icon: "how_to_vote",
                      count: statusCounts.needsMyPick,
                    },
                    {
                      id: "near-quorum",
                      label: "Perto do quórum",
                      icon: "local_fire_department",
                      count: statusCounts.nearQuorum,
                    },
                    {
                      id: "reached",
                      label: "Quórum atingido",
                      icon: "check_circle",
                      count: statusCounts.reached,
                    },
                    {
                      id: "my-picks",
                      label: "Meus apoios",
                      icon: "verified_user",
                      count: statusCounts.myPicks,
                    },
                  ] as const
                ).map((item) => {
                  const active = statusFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        active
                          ? "feed-quick-btn feed-quick-btn--active"
                          : "feed-quick-btn"
                      }
                      aria-pressed={active}
                      aria-label={`${item.label} (${item.count})`}
                      title={`${item.label} (${item.count})`}
                      onClick={() => setStatusFilter(item.id)}
                    >
                      <MaterialIcon
                        name={item.icon}
                        filled={active && item.id === "reached"}
                      />
                      <span className="gov-tabular feed-quick-btn__count">
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="feed-toolbar__row">
              <div className="feed-search">
                <MaterialIcon name="search" />
                <input
                  type="search"
                  className="feed-search__input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar..."
                  aria-label="Buscar na home"
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

              {categories.length > 0 && (
                <label className="feed-select-wrap">
                  <MaterialIcon name="category" />
                  <select
                    className="feed-select"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label="Filtrar por categoria"
                  >
                    <option value={ALL_CATEGORIES_FILTER}>Todas categorias</option>
                    <option value={GENERAL_CATEGORY_ID}>Geral</option>
                    {categories.map((cat) => (
                      <option key={cat.docIdHex} value={cat.docIdHex}>
                        {cat.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="feed-select-wrap">
                <MaterialIcon name="sort" />
                <select
                  className="feed-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  aria-label="Ordenar home"
                >
                  <option value="quorum">Mais perto do quórum</option>
                  <option value="activity">Atividade recente</option>
                  <option value="recent">Mais recentes</option>
                  <option value="picks">Mais apoiadas</option>
                </select>
              </label>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn--sm btn--outlined"
                  onClick={clearFilters}
                  title="Limpar filtros"
                >
                  <MaterialIcon name="close" />
                  <span>Limpar</span>
                </button>
              )}
            </div>
          </section>

          {/* Lista densa da Home */}
          {!projection ? (
            <div className="empty-state">
              <MaterialIcon name="sync" />
              <p className="md-body-medium">Carregando home da comunidade...</p>
            </div>
          ) : totalItemsInMode === 0 ? (
            <div className="empty-state">
              <MaterialIcon name="forum" />
              <h2 className="md-title-medium">
                {feedMode === "subjects"
                  ? "Nenhum assunto nesta comunidade ainda"
                  : "Nenhuma proposta publicada ainda"}
              </h2>
              <p className="md-body-medium">
                Abra o primeiro assunto para iniciar as deliberações e colher apoios da
                comunidade.
              </p>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => onRequestNewSubject(targetNewSubjectCategory)}
              >
                <MaterialIcon name="add" />
                <span>Criar primeiro assunto</span>
              </button>
            </div>
          ) : visibleItemsCount === 0 ? (
            <div className="empty-state">
              <MaterialIcon name="search" />
              <h2 className="md-title-medium">Nenhum item com esses filtros</h2>
              <p className="md-body-medium">
                Ajuste a busca ou limpe os filtros para ver todo o movimento da
                comunidade.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn--outlined"
                  onClick={clearFilters}
                >
                  <MaterialIcon name="close" />
                  <span>Limpar filtros</span>
                </button>
              )}
            </div>
          ) : (
            <div className="feed-table">
              <div className="feed-table__header">
                <span className="md-label-medium gov-tabular">
                  {hasActiveFilters
                    ? `${visibleItemsCount} de ${totalItemsInMode}`
                    : `${visibleItemsCount}`}{" "}
                  {feedMode === "subjects" ? "assunto(s)" : "proposta(s)"}
                </span>
                <span className="md-label-medium feed-table__header-right">
                  Quórum
                </span>
              </div>

              {feedMode === "subjects"
                ? visibleSubjects.map((item) => {
                    const { subject, leadingProposal, myPickedProposal, heat } = item;
                    const needsMyPick =
                      item.proposals.length > 0 && myPickedProposal === null;

                    return (
                      <article
                        key={subject.docIdHex}
                        className="feed-row"
                        onClick={() =>
                          onOpenSubject(item.categoryId, subject.scope)
                        }
                      >
                        <div className="feed-row__main">
                          <div className="feed-row__title-line">
                            <button
                              type="button"
                              className="feed-row__title"
                              onClick={() =>
                                onOpenSubject(item.categoryId, subject.scope)
                              }
                            >
                              <span>{subject.title}</span>
                            </button>

                            <button
                              type="button"
                              className="feed-row__cat"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCategoryFilter(item.categoryId);
                              }}
                              title={`Filtrar por ${item.categoryTitle}`}
                            >
                              {item.categoryTitle}
                            </button>

                            {heat.quorumReached && (
                              <span className="feed-status feed-status--consensus">
                                Quórum atingido
                              </span>
                            )}
                            {!heat.quorumReached && needsMyPick && (
                              <span className="feed-status feed-status--pending">
                                Sem seu apoio
                              </span>
                            )}
                          </div>

                          <div className="feed-row__subline">
                            {leadingProposal ? (
                              <>
                                <span className="feed-row__label">Líder:</span>
                                <button
                                  type="button"
                                  className="feed-row__link"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenProposal(
                                      item.categoryId,
                                      subject.scope,
                                      leadingProposal.docIdHex
                                    );
                                  }}
                                >
                                  {leadingProposal.title}
                                </button>
                                {leadingProposal.parentHashHex && (
                                  <span className="feed-row__muted">· Fork</span>
                                )}
                                <span className="feed-row__muted gov-tabular">
                                  · {item.proposals.length} proposta(s)
                                </span>
                                {myPickedProposal &&
                                  myPickedProposal.docIdHex !==
                                    leadingProposal.docIdHex && (
                                    <span className="feed-row__my-pick">
                                      · Seu apoio: {myPickedProposal.title}
                                    </span>
                                  )}
                              </>
                            ) : (
                              <span className="feed-row__muted">
                                {subject.body || "Nenhuma proposta enviada ainda"}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="feed-row__quorum">
                          {subject.quorumPct === null ? (
                            <span className="md-label-medium gov-tabular">
                              Aberto · {leadingProposal?.pickCount ?? 0} apoio(s)
                            </span>
                          ) : (
                            <div className="feed-row__progress">
                              <div className="progress-track">
                                <div
                                  className={
                                    heat.quorumReached
                                      ? "progress-fill progress-fill--consensus"
                                      : "progress-fill"
                                  }
                                  style={{ width: `${heat.quorumProgressPct}%` }}
                                />
                              </div>
                              <span className="md-label-medium gov-tabular">
                                {leadingProposal?.pickCount ?? 0}/{item.requiredVotes} (
                                {heat.quorumProgressPct}%)
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="icon-btn feed-row__arrow"
                          onClick={() =>
                            onOpenSubject(item.categoryId, subject.scope)
                          }
                          title={`Abrir ${subject.title}`}
                          aria-label={`Abrir ${subject.title}`}
                        >
                          <MaterialIcon name="chevron_right" />
                        </button>
                      </article>
                    );
                  })
                : visibleProposals.map((item) => {
                    const { proposal, subject, heat, isMyPick, isFork } = item;
                    return (
                      <article
                        key={proposal.docIdHex}
                        className="feed-row"
                        onClick={() =>
                          onOpenProposal(
                            item.categoryId,
                            proposal.scope,
                            proposal.docIdHex
                          )
                        }
                      >
                        <div className="feed-row__main">
                          <div className="feed-row__title-line">
                            <button
                              type="button"
                              className="feed-row__title"
                              onClick={() =>
                                onOpenProposal(
                                  item.categoryId,
                                  proposal.scope,
                                  proposal.docIdHex
                                )
                              }
                            >
                              <span>{proposal.title}</span>
                            </button>

                            {subject && (
                              <button
                                type="button"
                                className="feed-row__link feed-row__link--muted"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenSubject(item.categoryId, subject.scope);
                                }}
                              >
                                em #{subject.title}
                              </button>
                            )}

                            <button
                              type="button"
                              className="feed-row__cat"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCategoryFilter(item.categoryId);
                              }}
                            >
                              {item.categoryTitle}
                            </button>

                            {isFork && <span className="feed-row__muted">Fork</span>}

                            {proposal.status === "APPROVED" ? (
                              <span className="feed-status feed-status--consensus">
                                Aprovada no prazo
                              </span>
                            ) : proposal.status === "EXPIRED" ? (
                              <span className="feed-row__muted">Prazo encerrado</span>
                            ) : heat.quorumReached ? (
                              <span className="feed-status feed-status--consensus">
                                Quórum atingido
                              </span>
                            ) : proposal.deadlineUnixSeconds !== null ? (
                              <span className="feed-row__muted">
                                Até {formatDeadlineShort(proposal.deadlineUnixSeconds)}
                              </span>
                            ) : null}
                          </div>

                          <div className="feed-row__subline">
                            <span className="feed-row__muted">
                              Por {item.authorLabel}
                              {proposal.body ? ` · ${proposal.body}` : ""}
                            </span>
                          </div>
                        </div>

                        <div className="feed-row__quorum">
                          {proposal.quorumPct === null ? (
                            <span className="md-label-medium gov-tabular">
                              Aberto · {proposal.pickCount} apoio(s)
                            </span>
                          ) : (
                            <div className="feed-row__progress">
                              <div className="progress-track">
                                <div
                                  className={
                                    heat.quorumReached
                                      ? "progress-fill progress-fill--consensus"
                                      : "progress-fill"
                                  }
                                  style={{ width: `${heat.quorumProgressPct}%` }}
                                />
                              </div>
                              <span className="md-label-medium gov-tabular">
                                {proposal.pickCount}/{item.requiredVotes} (
                                {heat.quorumProgressPct}%)
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="icon-btn feed-row__arrow"
                          onClick={() =>
                            onOpenProposal(
                              item.categoryId,
                              proposal.scope,
                              proposal.docIdHex
                            )
                          }
                          title={`Abrir ${proposal.title}`}
                          aria-label={`Abrir ${proposal.title}`}
                        >
                          <MaterialIcon name="chevron_right" />
                        </button>
                      </article>
                    );
                  })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
