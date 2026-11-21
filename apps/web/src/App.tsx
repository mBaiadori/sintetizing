import type { ProposalSummaryView } from "@sintetizing/domain";
import { FormEvent, useEffect, useRef, useState } from "react";
import { CommunitiesTab, CommunitiesView } from "./components/CommunitiesView.js";
import { CommunityFeedView } from "./components/CommunityFeedView.js";
import { CommunityGraphView } from "./components/CommunityGraphView.js";
import { MaterialIcon } from "./components/MaterialIcon.js";
import { AppViewMode, NavigationRail } from "./components/NavigationRail.js";
import { ProfileView } from "./components/ProfileView.js";
import { WorkspaceColumns } from "./components/WorkspaceColumns.js";
import { buildProposalShareUrl, useExplorer } from "./hooks/useExplorer.js";
import { GENERAL_CATEGORY_ID } from "./utils/format.js";
import type { GraphFocus } from "./utils/sankey-graph.js";

function isCompactViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 900;
}

export function App() {
  const explorer = useExplorer();

  const [displayNameInput, setDisplayNameInput] = useState("");
  const [activeView, setActiveView] = useState<AppViewMode>("feed");
  const [communitiesTab, setCommunitiesTab] = useState<CommunitiesTab>("overview");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    () => explorer.initialSelection.categoryId ?? GENERAL_CATEGORY_ID
  );
  const [selectedSubjectScope, setSelectedSubjectScope] = useState<string | null>(
    () => explorer.initialSelection.subjectScope
  );
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    () => explorer.initialSelection.proposalId
  );
  const [graphFocus, setGraphFocus] = useState<GraphFocus>({ kind: "community" });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => isCompactViewport());

  const [showNewSubjectForm, setShowNewSubjectForm] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCatTitle, setNewCatTitle] = useState("");
  const [newCatBody, setNewCatBody] = useState("");

  const [deepLinkPending, setDeepLinkPending] = useState<boolean>(() =>
    Boolean(
      explorer.initialSelection.categoryId ||
        explorer.initialSelection.subjectScope ||
        explorer.initialSelection.proposalId
    )
  );
  const prevCommunityIdRef = useRef<string | null>(null);
  const communitiesTabRef = useRef<CommunitiesTab>(communitiesTab);
  communitiesTabRef.current = communitiesTab;

  // Reset navigation only when switching between loaded communities
  useEffect(() => {
    const prevCommunityId = prevCommunityIdRef.current;
    prevCommunityIdRef.current = explorer.selectedCommunityId;

    if (prevCommunityId !== null && prevCommunityId !== explorer.selectedCommunityId) {
      setSelectedCategoryId(GENERAL_CATEGORY_ID);
      setSelectedSubjectScope(null);
      setSelectedProposalId(null);
      setGraphFocus({ kind: "community" });
      setShowNewSubjectForm(false);
      setShowNewCategoryForm(false);
      setDeepLinkPending(false);
    }

    if (
      explorer.selectedCommunityId &&
      explorer.selectedCommunityId !== prevCommunityId &&
      communitiesTabRef.current === "add"
    ) {
      setCommunitiesTab("overview");
      setActiveView("feed");
    }
  }, [explorer.selectedCommunityId]);

  // Apply deep-link parameters once projection has loaded
  useEffect(() => {
    const proj = explorer.projection;
    if (
      !deepLinkPending ||
      !proj ||
      proj.communityId !== explorer.selectedCommunityId
    ) {
      return;
    }

    const { communityId, categoryId, subjectScope, proposalId } = explorer.initialSelection;
    if (communityId && proj.communityId !== communityId) {
      const targetJoined = explorer.communities.some((c) => c.communityId === communityId);
      if (!targetJoined && !explorer.loading) {
        setDeepLinkPending(false);
      }
      return;
    }

    const knownCats = new Set(proj.categories.map((c) => c.docIdHex));

    if (proposalId) {
      const prop = proj.proposals.find((p) => p.docIdHex === proposalId);
      setActiveView("workspace");
      if (prop) {
        const subj = proj.subjects.find((s) => s.scope === prop.scope);
        setSelectedCategoryId(
          subj?.categoryHashHex && knownCats.has(subj.categoryHashHex)
            ? subj.categoryHashHex
            : GENERAL_CATEGORY_ID
        );
        setSelectedSubjectScope(prop.scope);
        setSelectedProposalId(prop.docIdHex);
        setDeepLinkPending(false);
      }
      return;
    }

    if (categoryId && knownCats.has(categoryId)) {
      setSelectedCategoryId(categoryId);
    }
    if (subjectScope) {
      const subj = proj.subjects.find((s) => s.scope === subjectScope);
      if (subj) {
        if (!categoryId) {
          setSelectedCategoryId(
            subj.categoryHashHex && knownCats.has(subj.categoryHashHex)
              ? subj.categoryHashHex
              : GENERAL_CATEGORY_ID
          );
        }
        setSelectedSubjectScope(subj.scope);
        setDeepLinkPending(false);
      }
      return;
    }

    setActiveView("workspace");
    setDeepLinkPending(false);
  }, [
    deepLinkPending,
    explorer.communities,
    explorer.initialSelection,
    explorer.loading,
    explorer.projection,
    explorer.selectedCommunityId,
  ]);

  // Synchronize URL query parameters with active navigation state for direct sharing
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      explorer.loading ||
      !explorer.selectedCommunityId ||
      deepLinkPending
    ) {
      return;
    }

    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("c", explorer.selectedCommunityId);
    if (activeView === "workspace" && selectedSubjectScope) {
      if (selectedCategoryId !== GENERAL_CATEGORY_ID) {
        url.searchParams.set("cat", selectedCategoryId);
      }
      url.searchParams.set("s", selectedSubjectScope);
      if (selectedProposalId) {
        url.searchParams.set("p", selectedProposalId);
      }
    }

    const nextRelativeUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextRelativeUrl !== currentRelativeUrl) {
      window.history.replaceState(null, "", nextRelativeUrl);
    }
  }, [
    explorer.loading,
    explorer.selectedCommunityId,
    deepLinkPending,
    activeView,
    selectedCategoryId,
    selectedSubjectScope,
    selectedProposalId,
  ]);

  // Close category modal on Escape
  useEffect(() => {
    if (!showNewCategoryForm) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowNewCategoryForm(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showNewCategoryForm]);

  if (explorer.loading) {
    return (
      <div className="explorer-shell">
        <div className="card onboarding-card">
          <p className="md-body-medium">Carregando armazenamento local IndexedDB...</p>
        </div>
      </div>
    );
  }

  if (!explorer.identity) {
    const handleOnboard = (e: FormEvent) => {
      e.preventDefault();
      if (!displayNameInput.trim()) {
        return;
      }
      void explorer.createIdentity(displayNameInput);
    };

    return (
      <div className="explorer-shell">
        <form className="card onboarding-card" onSubmit={handleOnboard}>
          <div className="card__header">
            <div className="topbar__brand">
              <MaterialIcon name="key" filled />
              <h1 className="md-headline-small">Sintetize</h1>
            </div>
          </div>
          <p className="md-body-medium" style={{ marginBottom: 16 }}>
            Crie sua identidade para participar de comunidades, publicar propostas e
            registrar seus apoios.
          </p>
          <div className="field">
            <label htmlFor="identity-name">Seu nome de exibição</label>
            <input
              id="identity-name"
              className="input"
              placeholder="Ex.: Ana Silva"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              required
            />
          </div>
          <div className="btn-row" style={{ flexWrap: "wrap", gap: 10 }}>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={explorer.busy}
            >
              <MaterialIcon name="verified_user" />
              <span>Gerar identidade local</span>
            </button>
            <button
              type="button"
              className="btn btn--tonal"
              disabled={explorer.busy}
              onClick={() =>
                void explorer.seedLargeDataset(
                  "large",
                  displayNameInput.trim() || undefined
                )
              }
            >
              <MaterialIcon name="dataset" />
              <span>
                {explorer.busy && explorer.seedProgress
                  ? "Gerando seed..."
                  : "Popular Seed de Grande Porte"}
              </span>
            </button>
          </div>
          {explorer.seedProgress && (
            <p className="md-body-medium" style={{ marginTop: 12 }}>
              {explorer.seedProgress}
            </p>
          )}
        </form>
      </div>
    );
  }

  const myPubHex = explorer.identity.publicKeyHex;
  const projection = explorer.projection;
  const categories = projection?.categories ?? [];
  const members = projection?.members ?? [];
  const allSubjects = projection?.subjects ?? [];
  const allProposals = projection?.proposals ?? [];
  const activeMembersCount = projection?.activeMemberCount ?? 0;

  const pendingSupportCount = allSubjects.filter((subj) => {
    const subjProps = allProposals.filter((p) => p.scope === subj.scope);
    return (
      subjProps.length > 0 &&
      !subjProps.some((p) => p.supporterPubs.includes(myPubHex))
    );
  }).length;

  const knownCategoryIds = new Set(categories.map((c) => c.docIdHex));
  const selectedCategoryObj =
    selectedCategoryId === GENERAL_CATEGORY_ID
      ? null
      : categories.find((c) => c.docIdHex === selectedCategoryId) ?? null;

  const activeCategoryTitle = selectedCategoryObj ? selectedCategoryObj.title : "Geral";

  const filteredSubjects =
    selectedCategoryId === GENERAL_CATEGORY_ID
      ? allSubjects.filter(
          (s) => !s.categoryHashHex || !knownCategoryIds.has(s.categoryHashHex)
        )
      : allSubjects.filter((s) => s.categoryHashHex === selectedCategoryId);

  const selectedSubject =
    allSubjects.find((s) => s.scope === selectedSubjectScope) ?? null;

  const closeSidebarOnMobile = () => {
    if (isCompactViewport()) {
      setSidebarCollapsed(true);
    }
  };

  const handleSelectCategory = (categoryId: string) => {
    setDeepLinkPending(false);
    setSelectedCategoryId(categoryId);
    setSelectedSubjectScope(null);
    setSelectedProposalId(null);
    setShowNewSubjectForm(false);
    setActiveView("workspace");
    closeSidebarOnMobile();
  };

  const handleSelectSubjectFromTree = (categoryId: string, scope: string) => {
    setDeepLinkPending(false);
    setSelectedCategoryId(categoryId);
    setSelectedSubjectScope(scope);
    setSelectedProposalId(null);
    setShowNewSubjectForm(false);
    setActiveView("workspace");
    closeSidebarOnMobile();
  };

  const handleOpenFeed = () => {
    setDeepLinkPending(false);
    setSelectedSubjectScope(null);
    setSelectedProposalId(null);
    setShowNewSubjectForm(false);
    setActiveView("feed");
    closeSidebarOnMobile();
  };

  const handleOpenGraph = (focus?: GraphFocus) => {
    setDeepLinkPending(false);
    if (focus) {
      setGraphFocus(focus);
    }
    setActiveView("graph");
    closeSidebarOnMobile();
  };

  const handleOpenProposalFromFeed = (
    categoryId: string,
    scope: string,
    proposalId: string
  ) => {
    setDeepLinkPending(false);
    setSelectedCategoryId(categoryId);
    setSelectedSubjectScope(scope);
    setSelectedProposalId(proposalId);
    setShowNewSubjectForm(false);
    setActiveView("workspace");
    closeSidebarOnMobile();
  };

  const handleSelectSubjectFromStage = (scope: string) => {
    setDeepLinkPending(false);
    setSelectedSubjectScope(scope);
    setSelectedProposalId(null);
    setShowNewSubjectForm(false);
  };

  const handleRequestNewSubject = (categoryId: string) => {
    setDeepLinkPending(false);
    setSelectedCategoryId(categoryId);
    setSelectedSubjectScope(null);
    setSelectedProposalId(null);
    setShowNewSubjectForm(true);
    setActiveView("workspace");
    closeSidebarOnMobile();
  };

  const handleCreateCategorySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newCatTitle.trim().length < 5) {
      return;
    }
    const createdId = await explorer.createCategory({
      title: newCatTitle,
      body: newCatBody,
    });
    if (createdId) {
      setNewCatTitle("");
      setNewCatBody("");
      setShowNewCategoryForm(false);
      handleSelectCategory(createdId);
    }
  };

  const handleShareProposal = async (proposal: ProposalSummaryView) => {
    if (!explorer.selectedCommunity) {
      return;
    }
    const subj = allSubjects.find((s) => s.scope === proposal.scope);
    const resolvedCategoryId =
      subj?.categoryHashHex && knownCategoryIds.has(subj.categoryHashHex)
        ? subj.categoryHashHex
        : null;
    const url = buildProposalShareUrl({
      communityId: explorer.selectedCommunity.communityId,
      categoryId: resolvedCategoryId,
      subjectScope: proposal.scope,
      proposalId: proposal.docIdHex,
    });
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      explorer.notifyStatus("Link da proposta copiado para a área de transferência.");
    }
  };

  const handleJumpToProposalFromProfile = (scope: string, targetHashHex: string) => {
    setDeepLinkPending(false);
    const subj = allSubjects.find((s) => s.scope === scope);
    setSelectedCategoryId(
      subj?.categoryHashHex && knownCategoryIds.has(subj.categoryHashHex)
        ? subj.categoryHashHex
        : GENERAL_CATEGORY_ID
    );
    setSelectedSubjectScope(scope);
    setSelectedProposalId(targetHashHex);
    setShowNewSubjectForm(false);
    setActiveView("workspace");
    closeSidebarOnMobile();
  };

  const communityTitle = explorer.selectedCommunity
    ? projection?.activeConfig?.title ?? explorer.selectedCommunity.title
    : null;

  return (
    <div className="explorer-shell">
      <div className="app-shell">
        <NavigationRail
          activeView={activeView}
          isAddingCommunity={
            activeView === "communities" && communitiesTab === "add"
          }
          communities={explorer.communities}
          selectedCommunityId={explorer.selectedCommunityId}
          selectedCommunityTitle={communityTitle}
          identityName={explorer.identity.displayName}
          syncState={explorer.syncState}
          categories={categories}
          subjects={allSubjects}
          selectedCategoryId={selectedCategoryId}
          selectedSubjectScope={selectedSubjectScope}
          pendingSupportCount={pendingSupportCount}
          hasCommunity={explorer.selectedCommunity !== null}
          collapsed={sidebarCollapsed}
          busy={explorer.busy}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onResync={explorer.resync}
          onSelectCommunity={(communityId) => {
            setDeepLinkPending(false);
            explorer.setSelectedCommunityId(communityId);
            setCommunitiesTab("overview");
            setSelectedSubjectScope(null);
            setSelectedProposalId(null);
            setGraphFocus({ kind: "community" });
            setActiveView("feed");
          }}
          onOpenFeed={handleOpenFeed}
          onOpenGraph={() => handleOpenGraph()}
          onOpenAddCommunity={() => {
            setDeepLinkPending(false);
            setCommunitiesTab("add");
            setActiveView("communities");
            closeSidebarOnMobile();
          }}
          onOpenCommunitySettings={() => {
            setDeepLinkPending(false);
            setCommunitiesTab("overview");
            setActiveView("communities");
            closeSidebarOnMobile();
          }}
          onSelectCategory={handleSelectCategory}
          onSelectSubject={handleSelectSubjectFromTree}
          onRequestNewCategory={() => {
            setShowNewCategoryForm(true);
            closeSidebarOnMobile();
          }}
          onRequestNewSubject={handleRequestNewSubject}
          onOpenProfile={() => {
            setDeepLinkPending(false);
            setActiveView("profile");
            closeSidebarOnMobile();
          }}
        />

        <main className="app-content">
          {(explorer.statusMessage || explorer.errorMessage) && (
            <div className="app-banners">
              {explorer.statusMessage && (
                <div className="banner banner--info" role="status">
                  <MaterialIcon name="info" />
                  <span>{explorer.statusMessage}</span>
                </div>
              )}

              {explorer.errorMessage && (
                <div className="banner banner--error" role="alert">
                  <MaterialIcon name="close" />
                  <span>{explorer.errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {activeView === "communities" && (
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
                    onClick={() => setSidebarCollapsed((prev) => !prev)}
                    title="Mostrar barra lateral"
                    aria-label="Mostrar barra lateral"
                  >
                    <MaterialIcon name="menu" />
                  </button>
                  <div className="channel-title-wrap">
                    <MaterialIcon
                      name={communitiesTab === "add" ? "add" : "tune"}
                    />
                    <h1 className="channel-title">
                      {communitiesTab === "add" || !explorer.selectedCommunity
                        ? "Adicionar Comunidade"
                        : `Configurações · ${communityTitle ?? "Comunidade"}`}
                    </h1>
                  </div>
                </div>
              </header>
              <div className="subview-scroll">
                <div className="subview-container">
                  <CommunitiesView
                    myPubHex={myPubHex}
                    selectedCommunity={explorer.selectedCommunity}
                    projection={projection}
                    generatedInviteCode={explorer.generatedInviteCode}
                    activeTab={communitiesTab}
                    busy={explorer.busy}
                    seedProgress={explorer.seedProgress}
                    onChangeTab={setCommunitiesTab}
                    onGoToWorkspace={() => setActiveView("workspace")}
                    onCreateCommunity={explorer.createCommunity}
                    onJoinWithInvite={explorer.joinWithInvite}
                    onUpdateRelays={explorer.updateRelays}
                    onProposeConfigVersion={explorer.proposeConfigVersion}
                    onSupportConfigVersion={explorer.supportConfigVersion}
                    onGenerateInvite={() => explorer.generateInvite()}
                    onLeaveCommunity={explorer.leaveCommunity}
                    onSeedDataset={(scale) => explorer.seedLargeDataset(scale)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeView === "profile" && (
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
                    onClick={() => setSidebarCollapsed((prev) => !prev)}
                    title="Mostrar barra lateral"
                    aria-label="Mostrar barra lateral"
                  >
                    <MaterialIcon name="menu" />
                  </button>
                  <div className="channel-title-wrap">
                    <MaterialIcon name="person" />
                    <h1 className="channel-title">Meu Perfil e Apoios</h1>
                  </div>
                </div>
              </header>
              <div className="subview-scroll">
                <div className="subview-container">
                  <ProfileView
                    identity={explorer.identity}
                    selectedCommunityTitle={communityTitle}
                    projection={projection}
                    busy={explorer.busy}
                    seedProgress={explorer.seedProgress}
                    onOpenProposal={handleJumpToProposalFromProfile}
                    onSeedDataset={(scale) => explorer.seedLargeDataset(scale)}
                    onResetAllData={async () => {
                      await explorer.resetAllData();
                      setActiveView("feed");
                      setCommunitiesTab("overview");
                      setSelectedCategoryId(GENERAL_CATEGORY_ID);
                      setSelectedSubjectScope(null);
                      setSelectedProposalId(null);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {(activeView === "feed" || activeView === "graph" || activeView === "workspace") &&
            !explorer.selectedCommunity && (
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
                      onClick={() => setSidebarCollapsed((prev) => !prev)}
                      title="Mostrar barra lateral"
                      aria-label="Mostrar barra lateral"
                    >
                      <MaterialIcon name="menu" />
                    </button>
                    <div className="channel-title-wrap">
                      <MaterialIcon name="hub" />
                      <h1 className="channel-title">Sintetize</h1>
                    </div>
                  </div>
                </header>
                <div className="subview-scroll">
                  <div className="empty-state">
                    <MaterialIcon name="groups" />
                    <h2 className="md-title-medium">Nenhuma comunidade ainda</h2>
                    <p className="md-body-medium">
                      Crie sua primeira comunidade ou entre usando um código de
                      convite para começar a debater.
                    </p>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => {
                        setCommunitiesTab("add");
                        setActiveView("communities");
                      }}
                    >
                      <MaterialIcon name="add" />
                      <span>Criar ou entrar em comunidade</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          {activeView === "feed" && explorer.selectedCommunity && (
            <CommunityFeedView
              myPubHex={myPubHex}
              communityTitle={communityTitle ?? explorer.selectedCommunity.title}
              projection={projection}
              sidebarCollapsed={sidebarCollapsed}
              busy={explorer.busy}
              onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
              onOpenSubject={handleSelectSubjectFromTree}
              onOpenProposal={handleOpenProposalFromFeed}
              onRequestNewSubject={handleRequestNewSubject}
              onPickProposal={explorer.pickProposal}
              onShareProposal={handleShareProposal}
              onSupportConfigVersion={explorer.supportConfigVersion}
              onOpenCommunitySettings={() => {
                setDeepLinkPending(false);
                setCommunitiesTab("overview");
                setActiveView("communities");
                closeSidebarOnMobile();
              }}
            />
          )}

          {activeView === "graph" && explorer.selectedCommunity && (
            <CommunityGraphView
              myPubHex={myPubHex}
              communityTitle={communityTitle ?? explorer.selectedCommunity.title}
              projection={projection}
              focus={graphFocus}
              sidebarCollapsed={sidebarCollapsed}
              busy={explorer.busy}
              onChangeFocus={setGraphFocus}
              onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
              onOpenCategoryInWorkspace={handleSelectCategory}
              onOpenSubjectInWorkspace={handleSelectSubjectFromTree}
              onOpenProposalInWorkspace={handleOpenProposalFromFeed}
              onPickProposal={explorer.pickProposal}
              onShareProposal={handleShareProposal}
            />
          )}

          {activeView === "workspace" && explorer.selectedCommunity && (
            <WorkspaceColumns
              myPubHex={myPubHex}
              activeMembersCount={activeMembersCount}
              members={members}
              categoryId={selectedCategoryId}
              categoryTitle={activeCategoryTitle}
              subjects={filteredSubjects}
              selectedSubject={selectedSubject}
              proposals={allProposals}
              selectedProposalId={selectedProposalId}
              sidebarCollapsed={sidebarCollapsed}
              showNewSubjectForm={showNewSubjectForm}
              busy={explorer.busy}
              onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
              onOpenNewSubjectForm={() => {
                setSelectedSubjectScope(null);
                setShowNewSubjectForm(true);
              }}
              onCloseNewSubjectForm={() => setShowNewSubjectForm(false)}
              onSelectSubject={handleSelectSubjectFromStage}
              onSelectProposal={(docIdHex) => {
                setDeepLinkPending(false);
                setSelectedProposalId(docIdHex);
              }}
              onCreateSubject={explorer.createSubject}
              onCreateProposal={explorer.createProposal}
              onPickProposal={explorer.pickProposal}
              onShareProposal={handleShareProposal}
              onOpenGraph={(focus) => handleOpenGraph(focus)}
            />
          )}
        </main>
      </div>

      {/* Modal limpo para criação de nova categoria */}
      {showNewCategoryForm && explorer.selectedCommunity && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-cat-heading"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewCategoryForm(false);
            }
          }}
        >
          <form
            className="modal-card"
            onSubmit={(e) => void handleCreateCategorySubmit(e)}
          >
            <div className="composer-card__header">
              <h2 id="new-cat-heading" className="md-title-large">
                Nova Categoria
              </h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowNewCategoryForm(false)}
                aria-label="Fechar modal"
              >
                <MaterialIcon name="close" />
              </button>
            </div>
            <div className="field">
              <label htmlFor="new-cat-title">
                Nome da categoria (mín. 5 caracteres)
              </label>
              <input
                id="new-cat-title"
                className="input"
                minLength={5}
                required
                autoFocus
                value={newCatTitle}
                onChange={(e) => setNewCatTitle(e.target.value)}
                placeholder="Ex.: Infraestrutura"
              />
            </div>
            <div className="field">
              <label htmlFor="new-cat-body">Descrição (opcional)</label>
              <input
                id="new-cat-body"
                className="input"
                value={newCatBody}
                onChange={(e) => setNewCatBody(e.target.value)}
                placeholder="Ex.: Obras, iluminação e manutenção"
              />
            </div>
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={explorer.busy}
              >
                <MaterialIcon name="send" />
                <span>Criar categoria</span>
              </button>
              <button
                type="button"
                className="btn btn--outlined"
                onClick={() => setShowNewCategoryForm(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
