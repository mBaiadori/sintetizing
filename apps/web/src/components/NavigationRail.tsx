import type { CategorySummaryView, SubjectSummaryView } from "@sintetizing/domain";
import type { CommunityRecord } from "@sintetizing/storage";
import { useState } from "react";
import { GENERAL_CATEGORY_ID, getInitials } from "../utils/format.js";
import { MaterialIcon } from "./MaterialIcon.js";

export type AppViewMode = "feed" | "graph" | "workspace" | "communities" | "profile";

export interface NavigationRailProps {
  readonly activeView: AppViewMode;
  readonly isAddingCommunity: boolean;
  readonly communities: readonly CommunityRecord[];
  readonly selectedCommunityId: string | null;
  readonly selectedCommunityTitle: string | null;
  readonly identityName: string;
  readonly syncState: "idle" | "syncing" | "live";
  readonly categories: readonly CategorySummaryView[];
  readonly subjects: readonly SubjectSummaryView[];
  readonly selectedCategoryId: string;
  readonly selectedSubjectScope: string | null;
  readonly pendingSupportCount: number;
  readonly hasCommunity: boolean;
  readonly collapsed: boolean;
  readonly busy: boolean;
  readonly onToggleCollapse: () => void;
  readonly onResync: () => void;
  readonly onSelectCommunity: (communityId: string) => void;
  readonly onOpenFeed: () => void;
  readonly onOpenGraph: () => void;
  readonly onOpenAddCommunity: () => void;
  readonly onOpenCommunitySettings: () => void;
  readonly onSelectCategory: (categoryId: string) => void;
  readonly onSelectSubject: (categoryId: string, scope: string) => void;
  readonly onRequestNewCategory: () => void;
  readonly onRequestNewSubject: (categoryId: string) => void;
  readonly onOpenProfile: () => void;
}

interface CategoryGroup {
  readonly id: string;
  readonly title: string;
  readonly items: readonly SubjectSummaryView[];
}

export function NavigationRail({
  activeView,
  isAddingCommunity,
  communities,
  selectedCommunityId,
  selectedCommunityTitle,
  identityName,
  syncState,
  categories,
  subjects,
  selectedCategoryId,
  selectedSubjectScope,
  pendingSupportCount,
  hasCommunity,
  collapsed,
  busy,
  onToggleCollapse,
  onResync,
  onSelectCommunity,
  onOpenFeed,
  onOpenGraph,
  onOpenAddCommunity,
  onOpenCommunitySettings,
  onSelectCategory,
  onSelectSubject,
  onRequestNewCategory,
  onRequestNewSubject,
  onOpenProfile,
}: NavigationRailProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<
    Readonly<Record<string, boolean>>
  >({});

  if (collapsed) {
    return null;
  }

  const knownCategoryIds = new Set(categories.map((c) => c.docIdHex));
  const generalSubjects = subjects.filter(
    (s) => !s.categoryHashHex || !knownCategoryIds.has(s.categoryHashHex)
  );

  const groups: CategoryGroup[] = [
    {
      id: GENERAL_CATEGORY_ID,
      title: "Geral",
      items: generalSubjects,
    },
    ...categories.map((cat) => ({
      id: cat.docIdHex,
      title: cat.title,
      items: subjects.filter((s) => s.categoryHashHex === cat.docIdHex),
    })),
  ];

  const toggleCategoryCollapse = (categoryId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const syncLabel =
    syncState === "live"
      ? "Conectado"
      : syncState === "syncing"
        ? "Sincronizando..."
        : "Offline";

  return (
    <>
      <div
        className="sidebar-backdrop"
        onClick={onToggleCollapse}
        aria-hidden="true"
      />

      <div className="discord-nav" aria-label="Navegação principal">
        {/* Coluna 1: Server Rail (Comunidades estilo Discord) */}
        <nav className="server-rail" aria-label="Comunidades">
          {communities.map((comm) => {
            const isActive =
              comm.communityId === selectedCommunityId && !isAddingCommunity;
            return (
              <div
                key={comm.communityId}
                className={
                  isActive ? "server-item server-item--active" : "server-item"
                }
              >
                <span className="server-item__pill" aria-hidden="true" />
                <button
                  type="button"
                  className={
                    isActive ? "server-icon server-icon--active" : "server-icon"
                  }
                  onClick={() => onSelectCommunity(comm.communityId)}
                  title={comm.title}
                  aria-label={`Comunidade ${comm.title}`}
                  aria-current={isActive ? "true" : undefined}
                >
                  {getInitials(comm.title)}
                </button>
              </div>
            );
          })}

          {communities.length > 0 && (
            <div className="server-rail__divider" aria-hidden="true" />
          )}

          <div
            className={
              isAddingCommunity ? "server-item server-item--active" : "server-item"
            }
          >
            <span className="server-item__pill" aria-hidden="true" />
            <button
              type="button"
              className={
                isAddingCommunity
                  ? "server-icon server-icon--action server-icon--active"
                  : "server-icon server-icon--action"
              }
              onClick={onOpenAddCommunity}
              title="Criar ou entrar em comunidade"
              aria-label="Criar ou entrar em comunidade"
            >
              <MaterialIcon name="add" />
            </button>
          </div>
        </nav>

        {/* Coluna 2: Sidebar de Assuntos da Comunidade Ativa */}
        <aside className="channel-sidebar" aria-label="Assuntos da comunidade">
          {/* Topo: Nome da comunidade + Configurações do servidor + Recolher */}
          <div className="sidebar-header">
            <button
              type="button"
              className="sidebar-community-btn"
              onClick={onOpenCommunitySettings}
              disabled={!hasCommunity}
              title={
                hasCommunity
                  ? "Regras, membros e sincronização da comunidade"
                  : "Selecione ou adicione uma comunidade"
              }
            >
              <span className="sidebar-community-title">
                {selectedCommunityTitle ?? "Sintetize"}
              </span>
            </button>

            <div className="sidebar-header__actions">
              {hasCommunity && (
                <button
                  type="button"
                  className={
                    activeView === "communities" && !isAddingCommunity
                      ? "icon-btn icon-btn--active"
                      : "icon-btn"
                  }
                  onClick={onOpenCommunitySettings}
                  title="Configurações, regras e membros"
                  aria-label="Configurações da comunidade"
                >
                  <MaterialIcon name="tune" />
                </button>
              )}

              <button
                type="button"
                className="icon-btn"
                onClick={onToggleCollapse}
                title="Recolher barra lateral"
                aria-label="Recolher barra lateral"
              >
                <MaterialIcon name="menu_open" />
              </button>
            </div>
          </div>

          {/* Árvore de Categorias e Assuntos */}
          <div className="sidebar-tree" aria-label="Categorias e assuntos">
            {hasCommunity ? (
              <>
                <button
                  type="button"
                  className={
                    activeView === "feed"
                      ? "sidebar-feed-btn sidebar-feed-btn--active"
                      : "sidebar-feed-btn"
                  }
                  onClick={onOpenFeed}
                  aria-current={activeView === "feed" ? "page" : undefined}
                >
                  <MaterialIcon
                    name="dynamic_feed"
                    filled={activeView === "feed"}
                  />
                  <span className="tree-channel__title">Home</span>
                  {pendingSupportCount > 0 && (
                    <span
                      className="tree-badge gov-tabular"
                      title={`${pendingSupportCount} assunto(s) aguardando seu apoio`}
                    >
                      {pendingSupportCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className={
                    activeView === "graph"
                      ? "sidebar-feed-btn sidebar-feed-btn--active"
                      : "sidebar-feed-btn"
                  }
                  onClick={onOpenGraph}
                  aria-current={activeView === "graph" ? "page" : undefined}
                >
                  <MaterialIcon
                    name="hub"
                    filled={activeView === "graph"}
                  />
                  <span className="tree-channel__title">Grafo</span>
                </button>

                <div className="sidebar-section-header">
                  <span className="sidebar-section-title">Assuntos</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn--xs"
                    onClick={onRequestNewCategory}
                    disabled={busy}
                    title="Nova categoria"
                    aria-label="Criar nova categoria"
                  >
                    <MaterialIcon name="add" />
                  </button>
                </div>

                <div className="tree-list">
                  {groups.map((group) => {
                    const isCatCollapsed = Boolean(collapsedCategories[group.id]);
                    const isCatSelected =
                      activeView === "workspace" &&
                      selectedCategoryId === group.id &&
                      selectedSubjectScope === null;

                    return (
                      <div key={group.id} className="tree-group">
                        <div className="tree-category-row">
                          <button
                            type="button"
                            className="tree-category-chevron"
                            onClick={() => toggleCategoryCollapse(group.id)}
                            aria-expanded={!isCatCollapsed}
                            aria-label={
                              isCatCollapsed
                                ? `Expandir categoria ${group.title}`
                                : `Recolher categoria ${group.title}`
                            }
                          >
                            <MaterialIcon
                              name={isCatCollapsed ? "chevron_right" : "expand_more"}
                            />
                          </button>

                          <button
                            type="button"
                            className={
                              isCatSelected
                                ? "tree-category-label tree-category-label--active"
                                : "tree-category-label"
                            }
                            onClick={() => onSelectCategory(group.id)}
                            title={`Ver assuntos de ${group.title}`}
                          >
                            <span className="tree-category-name">{group.title}</span>
                            {isCatCollapsed && group.items.length > 0 && (
                              <span className="tree-badge">{group.items.length}</span>
                            )}
                          </button>

                          <button
                            type="button"
                            className="icon-btn icon-btn--xs tree-category-add"
                            onClick={() => onRequestNewSubject(group.id)}
                            disabled={busy}
                            title={`Novo assunto em ${group.title}`}
                            aria-label={`Novo assunto em ${group.title}`}
                          >
                            <MaterialIcon name="add" />
                          </button>
                        </div>

                        {!isCatCollapsed && (
                          <div className="tree-channels">
                            {group.items.length === 0 ? (
                              <button
                                type="button"
                                className="tree-empty-btn"
                                onClick={() => onRequestNewSubject(group.id)}
                                disabled={busy}
                              >
                                <MaterialIcon name="add" />
                                <span>Criar assunto</span>
                              </button>
                            ) : (
                              group.items.map((subj) => {
                                const isSelected =
                                  activeView === "workspace" &&
                                  selectedSubjectScope === subj.scope;
                                return (
                                  <button
                                    key={subj.docIdHex}
                                    type="button"
                                    className={
                                      isSelected
                                        ? "tree-channel tree-channel--active"
                                        : "tree-channel"
                                    }
                                    onClick={() => onSelectSubject(group.id, subj.scope)}
                                    aria-current={isSelected ? "page" : undefined}
                                  >
                                    <span className="tree-channel__title">
                                      {subj.title}
                                    </span>
                                    <span className="tree-badge gov-tabular">
                                      {subj.proposalCount}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="sidebar-empty-hint">
                <p className="md-body-medium">
                  Clique em <strong>+</strong> na barra à esquerda para criar uma
                  comunidade ou entrar por convite.
                </p>
              </div>
            )}
          </div>

          {/* Rodapé estilo Discord User Panel */}
          <div className="sidebar-footer">
            <button
              type="button"
              className={
                activeView === "profile"
                  ? "sidebar-user sidebar-user--active"
                  : "sidebar-user"
              }
              onClick={onOpenProfile}
              title="Meu perfil e histórico de apoios"
              aria-current={activeView === "profile" ? "page" : undefined}
            >
              <span className="sidebar-user__avatar">
                {getInitials(identityName, "EU")}
              </span>
              <span className="sidebar-user__info">
                <span className="sidebar-user__name">{identityName}</span>
                <span className="sidebar-user__status">
                  <span
                    className={`sync-dot sync-dot--${syncState}`}
                    aria-hidden="true"
                  />
                  <span>{syncLabel}</span>
                </span>
              </span>
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={onResync}
              disabled={!hasCommunity || busy}
              title="Sincronizar agora"
              aria-label="Sincronizar agora"
            >
              <MaterialIcon name="refresh" />
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
