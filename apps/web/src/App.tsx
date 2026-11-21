import type { ProposalSummaryView } from "@sintetizing/domain";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AppLink } from "./components/AppLink.js";
import { CommunitiesTab, CommunitiesView } from "./components/CommunitiesView.js";
import { CommunityFeedView } from "./components/CommunityFeedView.js";
import { CommunityGraphView } from "./components/CommunityGraphView.js";
import { LocalStorageView } from "./components/LocalStorageView.js";
import { MaterialIcon } from "./components/MaterialIcon.js";
import { AppViewMode, NavigationRail } from "./components/NavigationRail.js";
import { ProfileView } from "./components/ProfileView.js";
import { WorkspaceColumns } from "./components/WorkspaceColumns.js";
import { NavigateOptions, useAppRouter } from "./hooks/useAppRouter.js";
import { buildProposalShareUrl, useExplorer } from "./hooks/useExplorer.js";
import { GENERAL_CATEGORY_ID } from "./utils/format.js";
import {
  AppRoute,
  graphFocusToRoute,
  routeToGraphFocus,
} from "./utils/router.js";
import type { GraphFocus } from "./utils/sankey-graph.js";

function isCompactViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 900;
}

export function App() {
  const explorer = useExplorer();
  const { route, navigate } = useAppRouter();

  const [displayNameInput, setDisplayNameInput] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => isCompactViewport());

  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [confirmNewCategory, setConfirmNewCategory] = useState(false);
  const [newCatError, setNewCatError] = useState<string | null>(null);
  const [newCatTitle, setNewCatTitle] = useState("");
  const [newCatBody, setNewCatBody] = useState("");

  const routeCommunityId = "communityId" in route ? route.communityId : null;
  const prevSelectedCommunityIdRef = useRef<string | null>(explorer.selectedCommunityId);

  const closeSidebarOnMobile = () => {
    if (isCompactViewport()) {
      setSidebarCollapsed(true);
    }
  };

  const navigateAndClose = (nextRoute: AppRoute, options?: NavigateOptions) => {
    navigate(nextRoute, options);
    closeSidebarOnMobile();
  };

  // Sincroniza a comunidade selecionada no explorer quando a rota especifica uma comunidade
  useEffect(() => {
    if (!routeCommunityId || explorer.loading) {
      return;
    }
    const exists = explorer.communities.some((c) => c.communityId === routeCommunityId);
    if (exists && explorer.selectedCommunityId !== routeCommunityId) {
      explorer.setSelectedCommunityId(routeCommunityId);
    }
  }, [
    explorer.communities,
    explorer.loading,
    explorer.selectedCommunityId,
    explorer.setSelectedCommunityId,
    routeCommunityId,
  ]);

  // Redireciona rota raiz e canonicaliza URLs legadas (/?c=...)
  useEffect(() => {
    if (explorer.loading || !explorer.identity) {
      return;
    }
    if (route.kind === "root") {
      if (explorer.communities.length > 0) {
        const targetId =
          explorer.selectedCommunityId ?? explorer.communities[0]!.communityId;
        navigate({ kind: "feed", communityId: targetId }, { replace: true });
      } else {
        navigate({ kind: "add-community" }, { replace: true });
      }
      return;
    }
    if (typeof window !== "undefined" && window.location.pathname === "/") {
      navigate(route, { replace: true });
    }
  }, [
    explorer.communities,
    explorer.identity,
    explorer.loading,
    explorer.selectedCommunityId,
    navigate,
    route,
  ]);

  // Ao criar/entrar em uma comunidade a partir de /communities/add, abre o feed dela
  useEffect(() => {
    const prevId = prevSelectedCommunityIdRef.current;
    prevSelectedCommunityIdRef.current = explorer.selectedCommunityId;
    if (
      route.kind === "add-community" &&
      explorer.selectedCommunityId &&
      explorer.selectedCommunityId !== prevId
    ) {
      navigate({ kind: "feed", communityId: explorer.selectedCommunityId });
    }
  }, [explorer.selectedCommunityId, navigate, route.kind]);

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

  const activeView: AppViewMode =
    route.kind === "graph"
      ? "graph"
      : route.kind === "workspace"
        ? "workspace"
        : route.kind === "community-settings" || route.kind === "add-community"
          ? "communities"
          : route.kind === "profile"
            ? "profile"
            : route.kind === "storage"
              ? "storage"
              : "feed";

  const communitiesTab: CommunitiesTab =
    route.kind === "add-community"
      ? "add"
      : route.kind === "community-settings"
        ? route.tab ?? "overview"
        : "overview";
  const selectedCategoryId =
    route.kind === "workspace" ? route.categoryId : GENERAL_CATEGORY_ID;
  const selectedSubjectScope =
    route.kind === "workspace" ? route.subjectScope : null;
  const selectedProposalId =
    route.kind === "workspace" ? route.proposalId : null;
  const showNewSubjectForm =
    route.kind === "workspace" ? route.newSubject : false;
  const graphFocus: GraphFocus =
    route.kind === "graph" ? routeToGraphFocus(route) : { kind: "community" };

  const projection = explorer.projection;
  const communityTitle = explorer.selectedCommunity
    ? projection?.activeConfig?.title ?? explorer.selectedCommunity.title
    : null;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const commSuffix = communityTitle ? ` · ${communityTitle}` : "";
    switch (route.kind) {
      case "profile":
        document.title = "Meu Perfil — Sintetize";
        break;
      case "storage":
        document.title = "Dados Locais (Nó) — Sintetize";
        break;
      case "add-community":
        document.title = "Adicionar Comunidade — Sintetize";
        break;
      case "community-settings":
        document.title = `Configurações${commSuffix} — Sintetize`;
        break;
      case "graph":
        document.title = `Grafo${commSuffix} — Sintetize`;
        break;
      case "workspace":
        document.title = `Assuntos${commSuffix} — Sintetize`;
        break;
      default:
        document.title = communityTitle
          ? `Home${commSuffix} — Sintetize`
          : "Sintetize — Decisão Coletiva";
        break;
    }
  }, [communityTitle, route.kind]);

  // Normaliza categoryId na URL caso um deep-link tenha omitido a categoria real do assunto
  useEffect(() => {
    if (
      route.kind !== "workspace" ||
      !route.subjectScope ||
      !projection ||
      projection.communityId !== route.communityId
    ) {
      return;
    }
    const subject = projection.subjects.find((s) => s.scope === route.subjectScope);
    if (!subject) {
      return;
    }
    const knownCats = new Set(projection.categories.map((c) => c.docIdHex));
    const resolvedCategoryId =
      subject.categoryHashHex && knownCats.has(subject.categoryHashHex)
        ? subject.categoryHashHex
        : GENERAL_CATEGORY_ID;
    if (resolvedCategoryId !== route.categoryId) {
      navigate({ ...route, categoryId: resolvedCategoryId }, { replace: true });
    }
  }, [navigate, projection, route]);

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
          {explorer.errorMessage && (
            <div className="banner banner--error" role="alert" style={{ marginBottom: 14 }}>
              <MaterialIcon name="close" />
              <span>{explorer.errorMessage}</span>
            </div>
          )}
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
  const categories = projection?.categories ?? [];
  const members = projection?.members ?? [];
  const allSubjects = projection?.subjects ?? [];
  const allProposals = projection?.proposals ?? [];
  const activeMembersCount = projection?.activeMemberCount ?? 0;

  const pendingSupportCount = allSubjects.filter((subj) => {
    if (explorer.hiddenDocIds.has(subj.docIdHex)) {
      return false;
    }
    const subjProps = allProposals.filter(
      (p) =>
        p.scope === subj.scope &&
        !explorer.hiddenDocIds.has(p.docIdHex) &&
        p.supersededByDocIdHex === null
    );
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

  const activeCommunityId =
    routeCommunityId ?? explorer.selectedCommunityId ?? null;

  const routeCommunityMissing =
    routeCommunityId !== null &&
    !explorer.communities.some((c) => c.communityId === routeCommunityId);

  const handleSelectCategory = (categoryId: string) => {
    if (!activeCommunityId) {
      return;
    }
    navigateAndClose({
      kind: "workspace",
      communityId: activeCommunityId,
      categoryId,
      subjectScope: null,
      proposalId: null,
      newSubject: false,
    });
  };

  const handleSelectSubjectFromTree = (categoryId: string, scope: string) => {
    if (!activeCommunityId) {
      return;
    }
    navigateAndClose({
      kind: "workspace",
      communityId: activeCommunityId,
      categoryId,
      subjectScope: scope,
      proposalId: null,
      newSubject: false,
    });
  };

  const handleOpenGraph = (focus?: GraphFocus) => {
    if (!activeCommunityId) {
      return;
    }
    navigateAndClose(
      focus
        ? graphFocusToRoute(activeCommunityId, focus)
        : {
            kind: "graph",
            communityId: activeCommunityId,
            categoryId: null,
            subjectScope: null,
          }
    );
  };

  const handleOpenProposalFromFeed = (
    categoryId: string,
    scope: string,
    proposalId: string
  ) => {
    if (!activeCommunityId) {
      return;
    }
    navigateAndClose({
      kind: "workspace",
      communityId: activeCommunityId,
      categoryId,
      subjectScope: scope,
      proposalId,
      newSubject: false,
    });
  };

  const handleSelectSubjectFromStage = (scope: string) => {
    if (!activeCommunityId) {
      return;
    }
    navigate({
      kind: "workspace",
      communityId: activeCommunityId,
      categoryId: selectedCategoryId,
      subjectScope: scope,
      proposalId: null,
      newSubject: false,
    });
  };

  const handleRequestNewSubject = (categoryId: string) => {
    if (!activeCommunityId) {
      return;
    }
    navigateAndClose({
      kind: "workspace",
      communityId: activeCommunityId,
      categoryId,
      subjectScope: null,
      proposalId: null,
      newSubject: true,
    });
  };

  const handleCreateCategorySubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = newCatTitle.trim();
    if (trimmedTitle.length < 5) {
      setNewCatError("O nome da categoria deve ter pelo menos 5 caracteres.");
      return;
    }
    const duplicate = categories.some(
      (cat) => cat.title.trim().toLowerCase() === trimmedTitle.toLowerCase(),
    );
    if (duplicate) {
      setNewCatError("Já existe uma categoria com esse nome nesta comunidade.");
      return;
    }
    setNewCatError(null);
    if (!confirmNewCategory) {
      setConfirmNewCategory(true);
      return;
    }
    const createdId = await explorer.createCategory({
      title: trimmedTitle,
      body: newCatBody.trim(),
    });
    if (createdId) {
      setNewCatTitle("");
      setNewCatBody("");
      setConfirmNewCategory(false);
      setNewCatError(null);
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
    if (!explorer.selectedCommunityId) {
      return;
    }
    const subj = allSubjects.find((s) => s.scope === scope);
    const categoryId =
      subj?.categoryHashHex && knownCategoryIds.has(subj.categoryHashHex)
        ? subj.categoryHashHex
        : GENERAL_CATEGORY_ID;
    navigateAndClose({
      kind: "workspace",
      communityId: explorer.selectedCommunityId,
      categoryId,
      subjectScope: scope,
      proposalId: targetHashHex,
      newSubject: false,
    });
  };

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
          onNavigate={navigateAndClose}
          onRequestNewCategory={() => {
            setShowNewCategoryForm(true);
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
                    onChangeTab={(nextTab) => {
                      if (nextTab === "add") {
                        navigate({ kind: "add-community" });
                      } else if (explorer.selectedCommunityId) {
                        navigate({
                          kind: "community-settings",
                          communityId: explorer.selectedCommunityId,
                          tab: nextTab,
                        });
                      }
                    }}
                    onGoToWorkspace={() => {
                      if (explorer.selectedCommunityId) {
                        navigate({
                          kind: "workspace",
                          communityId: explorer.selectedCommunityId,
                          categoryId: GENERAL_CATEGORY_ID,
                          subjectScope: null,
                          proposalId: null,
                          newSubject: false,
                        });
                      }
                    }}
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
                      navigate({ kind: "root" }, { replace: true });
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeView === "storage" && (
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
                    <MaterialIcon name="dataset" />
                    <h1 className="channel-title">Dados Locais deste Nó</h1>
                  </div>
                </div>
              </header>
              <div className="subview-scroll">
                <div className="subview-container">
                  <LocalStorageView
                    identity={explorer.identity}
                    communities={explorer.communities}
                    loadAllPackets={explorer.listAllStoredPackets}
                    loadAllChatFiles={explorer.listAllChatFiles}
                  />
                </div>
              </div>
            </div>
          )}

          {(activeView === "feed" || activeView === "graph" || activeView === "workspace") &&
            (!explorer.selectedCommunity || routeCommunityMissing) && (
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
                    <h2 className="md-title-medium">
                      {routeCommunityMissing
                        ? "Comunidade não encontrada localmente"
                        : "Nenhuma comunidade ainda"}
                    </h2>
                    <p className="md-body-medium">
                      {routeCommunityMissing
                        ? "Você ainda não entrou nesta comunidade neste dispositivo. Use um código de convite ou selecione outra comunidade."
                        : "Crie sua primeira comunidade ou entre usando um código de convite para começar a debater."}
                    </p>
                    <AppLink
                      to={{ kind: "add-community" }}
                      onNavigate={navigateAndClose}
                      className="btn btn--primary"
                    >
                      <MaterialIcon name="add" />
                      <span>Criar ou entrar em comunidade</span>
                    </AppLink>
                  </div>
                </div>
              </div>
            )}

          {activeView === "feed" &&
            explorer.selectedCommunity &&
            !routeCommunityMissing && (
              <CommunityFeedView
                myPubHex={myPubHex}
                communityTitle={communityTitle ?? explorer.selectedCommunity.title}
                projection={projection}
                hiddenDocIds={explorer.hiddenDocIds}
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
                  if (explorer.selectedCommunityId) {
                    navigateAndClose({
                      kind: "community-settings",
                      communityId: explorer.selectedCommunityId,
                    });
                  }
                }}
              />
            )}

          {activeView === "graph" &&
            explorer.selectedCommunity &&
            !routeCommunityMissing && (
              <CommunityGraphView
                myPubHex={myPubHex}
                communityTitle={communityTitle ?? explorer.selectedCommunity.title}
                projection={projection}
                focus={graphFocus}
                sidebarCollapsed={sidebarCollapsed}
                busy={explorer.busy}
                onChangeFocus={(nextFocus) => {
                  if (explorer.selectedCommunityId) {
                    navigate(
                      graphFocusToRoute(explorer.selectedCommunityId, nextFocus)
                    );
                  }
                }}
                onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
                onOpenCategoryInWorkspace={handleSelectCategory}
                onOpenSubjectInWorkspace={handleSelectSubjectFromTree}
                onOpenProposalInWorkspace={handleOpenProposalFromFeed}
                onPickProposal={explorer.pickProposal}
                onShareProposal={handleShareProposal}
              />
            )}

          {activeView === "workspace" &&
            explorer.selectedCommunity &&
            !routeCommunityMissing && (
              <WorkspaceColumns
                myPubHex={myPubHex}
                activeQuorumPct={projection?.activeConfig?.quorumPct ?? 51}
                activeMembersCount={activeMembersCount}
                members={members}
                categoryId={selectedCategoryId}
                categoryTitle={activeCategoryTitle}
                subjects={filteredSubjects}
                selectedSubject={selectedSubject}
                proposals={allProposals}
                selectedProposalId={selectedProposalId}
                drafts={explorer.drafts}
                hiddenDocIds={explorer.hiddenDocIds}
                workshop={
                  selectedSubject
                    ? (explorer.workshopsByScope[selectedSubject.scope] ?? null)
                    : null
                }
                chatFileRecord={
                  selectedSubject
                    ? (explorer.chatFiles.find(
                        (f) => f.subjectScope === selectedSubject.scope
                      ) ?? null)
                    : null
                }
                sidebarCollapsed={sidebarCollapsed}
                showNewSubjectForm={showNewSubjectForm}
                busy={explorer.busy}
                onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
                onOpenNewSubjectForm={() => {
                  if (explorer.selectedCommunityId) {
                    navigate({
                      kind: "workspace",
                      communityId: explorer.selectedCommunityId,
                      categoryId: selectedCategoryId,
                      subjectScope: null,
                      proposalId: null,
                      newSubject: true,
                    });
                  }
                }}
                onCloseNewSubjectForm={() => {
                  if (explorer.selectedCommunityId) {
                    navigate({
                      kind: "workspace",
                      communityId: explorer.selectedCommunityId,
                      categoryId: selectedCategoryId,
                      subjectScope: null,
                      proposalId: null,
                      newSubject: false,
                    });
                  }
                }}
                onSelectSubject={handleSelectSubjectFromStage}
                onSelectProposal={(docIdHex) => {
                  if (explorer.selectedCommunityId) {
                    navigate({
                      kind: "workspace",
                      communityId: explorer.selectedCommunityId,
                      categoryId: selectedCategoryId,
                      subjectScope: selectedSubjectScope,
                      proposalId: docIdHex,
                      newSubject: false,
                    });
                  }
                }}
                onCreateSubject={explorer.createSubject}
                onCreateProposal={explorer.createProposal}
                onSendChatMessage={explorer.sendChatMessage}
                onPublishSharedDraft={explorer.publishSharedDraft}
                onDeleteSharedDraft={explorer.deleteSharedDraft}
                onPromoteSharedDraft={explorer.promoteSharedDraftToProposal}
                onSaveDraft={explorer.saveDraft}
                onDeleteDraft={explorer.deleteDraft}
                onHideDocument={explorer.hideDocument}
                onUnhideDocument={explorer.unhideDocument}
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
                onClick={() => {
                  setConfirmNewCategory(false);
                  setNewCatError(null);
                  setShowNewCategoryForm(false);
                }}
                aria-label="Fechar modal"
              >
                <MaterialIcon name="close" />
              </button>
            </div>
            {newCatError && (
              <p className="md-body-small" style={{ color: "var(--md-sys-color-error)" }}>
                {newCatError}
              </p>
            )}
            {!confirmNewCategory ? (
              <>
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
                    onChange={(e) => {
                      setNewCatTitle(e.target.value);
                      if (newCatError) setNewCatError(null);
                    }}
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
                    <MaterialIcon name="visibility" />
                    <span>Revisar categoria</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--outlined"
                    onClick={() => {
                      setConfirmNewCategory(false);
                      setNewCatError(null);
                      setShowNewCategoryForm(false);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div className="confirm-publish-box">
                <h3 className="md-title-small">Confirmar publicação da categoria</h3>
                <p className="md-body-small">
                  Depois de publicada na rede, a categoria não pode ser apagada.
                </p>
                <ul className="confirm-publish-list">
                  <li>
                    <strong>Nome:</strong> {newCatTitle.trim()}
                  </li>
                  {newCatBody.trim() && (
                    <li>
                      <strong>Descrição:</strong> {newCatBody.trim()}
                    </li>
                  )}
                </ul>
                <div className="btn-row">
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={explorer.busy}
                  >
                    <MaterialIcon name="send" />
                    <span>Confirmar e publicar</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--outlined"
                    onClick={() => setConfirmNewCategory(false)}
                  >
                    Voltar para editar
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
