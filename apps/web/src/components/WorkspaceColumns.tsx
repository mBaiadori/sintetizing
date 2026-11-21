import type {
  MemberView,
  ProposalSummaryView,
  SubjectSummaryView,
} from "@sintetizing/domain";
import { useCallback, useEffect, useState } from "react";
import type {
  CreateProposalInput,
  CreateSubjectInput,
} from "../hooks/useExplorer.js";
import type { GraphFocus } from "../utils/sankey-graph.js";
import {
  computeHeatInfo,
  formatDateMs,
  GENERAL_CATEGORY_ID,
  getInitials,
  shortHex,
} from "../utils/format.js";
import { MaterialIcon } from "./MaterialIcon.js";

export interface WorkspaceColumnsProps {
  readonly myPubHex: string;
  readonly activeMembersCount: number;
  readonly members: readonly MemberView[];
  readonly categoryId: string;
  readonly categoryTitle: string;
  readonly subjects: readonly SubjectSummaryView[];
  readonly selectedSubject: SubjectSummaryView | null;
  readonly proposals: readonly ProposalSummaryView[];
  readonly selectedProposalId: string | null;
  readonly sidebarCollapsed: boolean;
  readonly showNewSubjectForm: boolean;
  readonly busy: boolean;
  readonly onToggleSidebar: () => void;
  readonly onOpenNewSubjectForm: () => void;
  readonly onCloseNewSubjectForm: () => void;
  readonly onSelectSubject: (scope: string) => void;
  readonly onSelectProposal: (docIdHex: string | null) => void;
  readonly onCreateSubject: (
    input: CreateSubjectInput,
  ) => Promise<string | null>;
  readonly onCreateProposal: (
    input: CreateProposalInput,
  ) => Promise<string | null>;
  readonly onPickProposal: (scope: string, docIdHex: string) => Promise<void>;
  readonly onShareProposal: (proposal: ProposalSummaryView) => Promise<void>;
  readonly onOpenGraph: (focus: GraphFocus) => void;
}

type DrawerMode = "closed" | "new-proposal" | "fork";

export function WorkspaceColumns({
  myPubHex,
  activeMembersCount,
  members,
  categoryId,
  categoryTitle,
  subjects,
  selectedSubject,
  proposals,
  selectedProposalId,
  sidebarCollapsed,
  showNewSubjectForm,
  busy,
  onToggleSidebar,
  onOpenNewSubjectForm,
  onCloseNewSubjectForm,
  onSelectSubject,
  onSelectProposal,
  onCreateSubject,
  onCreateProposal,
  onPickProposal,
  onShareProposal,
  onOpenGraph,
}: WorkspaceColumnsProps) {
  const [subjTitle, setSubjTitle] = useState("");
  const [subjBody, setSubjBody] = useState("");
  const [subjQuorum, setSubjQuorum] = useState(51);

  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [forkTargetId, setForkTargetId] = useState<string | null>(null);

  const [propTitle, setPropTitle] = useState("");
  const [propBody, setPropBody] = useState("");

  const [forkTitle, setForkTitle] = useState("");
  const [forkBody, setForkBody] = useState("");

  useEffect(() => {
    setDrawerMode("closed");
    setForkTargetId(null);
  }, [selectedSubject?.scope]);

  const subjectProposals = selectedSubject
    ? proposals
        .filter((p) => p.scope === selectedSubject.scope)
        .sort(
          (a, b) => b.pickCount - a.pickCount || b.timestampMs - a.timestampMs,
        )
    : [];

  const activeProposal = selectedProposalId
    ? (subjectProposals.find((p) => p.docIdHex === selectedProposalId) ?? null)
    : null;

  const requiredVotes = selectedSubject
    ? Math.max(
        1,
        Math.ceil((activeMembersCount * selectedSubject.quorumPct) / 100),
      )
    : 1;

  const activeHeat = activeProposal
    ? computeHeatInfo(activeProposal.pickCount, requiredVotes)
    : null;
  const activeIsMyPick = activeProposal
    ? activeProposal.supporterPubs.includes(myPubHex)
    : false;
  const activeParent = activeProposal?.parentHashHex
    ? (subjectProposals.find(
        (p) => p.docIdHex === activeProposal.parentHashHex,
      ) ?? null)
    : null;
  const childForks = activeProposal
    ? subjectProposals.filter(
        (p) => p.parentHashHex === activeProposal.docIdHex,
      )
    : [];

  const isOverlayOpen =
    selectedSubject !== null &&
    (activeProposal !== null || drawerMode === "new-proposal");

  const closeComposerOnly = useCallback(() => {
    setDrawerMode("closed");
    setForkTargetId(null);
  }, []);

  const closeAllOverlay = useCallback(() => {
    closeComposerOnly();
    onSelectProposal(null);
  }, [closeComposerOnly, onSelectProposal]);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAllOverlay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeAllOverlay, isOverlayOpen]);

  const openNewProposalDrawer = () => {
    if (drawerMode === "new-proposal") {
      closeComposerOnly();
      return;
    }
    onSelectProposal(null);
    setForkTargetId(null);
    setDrawerMode("new-proposal");
  };

  const toggleForkSplit = (prop: ProposalSummaryView) => {
    if (drawerMode === "fork" && forkTargetId === prop.docIdHex) {
      closeComposerOnly();
      return;
    }
    setForkTargetId(prop.docIdHex);
    setForkTitle(prop.title);
    setForkBody(prop.body);
    setDrawerMode("fork");
    onSelectProposal(prop.docIdHex);
  };

  const resolveSupporterLabel = (pubHex: string): string => {
    const member = members.find((m) => m.pubHex === pubHex);
    if (pubHex === myPubHex) {
      return member?.displayName ? `${member.displayName} (você)` : "Você";
    }
    return member?.displayName ?? shortHex(pubHex);
  };

  const isForkSplitActive =
    drawerMode === "fork" &&
    activeProposal !== null &&
    forkTargetId === activeProposal.docIdHex;

  return (
    <div className="channel-workspace">
      {/* Barra superior do assunto/categoria ativa */}
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

          {selectedSubject ? (
            <div className="channel-heading">
              <div className="channel-title-wrap">
                <h1 className="channel-title">{selectedSubject.title}</h1>
              </div>
              {selectedSubject.body && (
                <>
                  <span
                    className="channel-topbar__divider"
                    aria-hidden="true"
                  />
                  <p
                    className="channel-topbar__topic"
                    title={selectedSubject.body}
                  >
                    {selectedSubject.body}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="channel-heading">
              <div className="channel-title-wrap">
                <MaterialIcon name="category" />
                <h1 className="channel-title">{categoryTitle}</h1>
              </div>
            </div>
          )}
        </div>

        <div className="channel-topbar__actions">
          {selectedSubject ? (
            <>
              <span className="chip gov-tabular channel-quorum-chip">
                Quórum {selectedSubject.quorumPct}% · Mín. {requiredVotes}
              </span>
              <button
                type="button"
                className="btn btn--outlined btn--sm"
                onClick={() =>
                  onOpenGraph({
                    kind: "subject",
                    categoryId,
                    subjectScope: selectedSubject.scope,
                  })
                }
                title="Ver evolução do assunto no grafo"
              >
                <MaterialIcon name="hub" />
                <span>Grafo</span>
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={openNewProposalDrawer}
                disabled={busy}
              >
                <MaterialIcon name="add" />
                <span>Nova proposta</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--outlined btn--sm"
                onClick={() =>
                  onOpenGraph({
                    kind: "category",
                    categoryId,
                  })
                }
                title="Ver categoria no grafo"
              >
                <MaterialIcon name="hub" />
                <span>Grafo</span>
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={
                  showNewSubjectForm
                    ? onCloseNewSubjectForm
                    : onOpenNewSubjectForm
                }
                disabled={busy}
              >
                <MaterialIcon name={showNewSubjectForm ? "close" : "add"} />
                <span>{showNewSubjectForm ? "Cancelar" : "Novo assunto"}</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Palco em largura total com listas densas de assuntos ou propostas */}
      <div className="channel-stage">
        <div className="channel-feed">
          <div className="channel-feed__inner">
            {showNewSubjectForm && (
              <form
                className="composer-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  void (async () => {
                    const input: CreateSubjectInput =
                      categoryId !== GENERAL_CATEGORY_ID
                        ? {
                            title: subjTitle,
                            body: subjBody,
                            quorumPct: subjQuorum,
                            categoryHashHex: categoryId,
                          }
                        : {
                            title: subjTitle,
                            body: subjBody,
                            quorumPct: subjQuorum,
                          };
                    const createdScope = await onCreateSubject(input);
                    if (createdScope) {
                      setSubjTitle("");
                      setSubjBody("");
                      onCloseNewSubjectForm();
                      onSelectSubject(createdScope);
                    }
                  })();
                }}
              >
                <div className="composer-card__header">
                  <div>
                    <h2 className="md-title-medium">
                      Novo assunto em {categoryTitle}
                    </h2>
                    <p className="md-body-medium">
                      Crie um assunto para reunir propostas e construir
                      consenso.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={onCloseNewSubjectForm}
                    aria-label="Cancelar novo assunto"
                  >
                    <MaterialIcon name="close" />
                  </button>
                </div>

                <div className="row-2">
                  <div className="field">
                    <label htmlFor="ws-subj-title">
                      Título do assunto (mín. 5)
                    </label>
                    <input
                      id="ws-subj-title"
                      className="input"
                      minLength={5}
                      required
                      value={subjTitle}
                      onChange={(e) => setSubjTitle(e.target.value)}
                      placeholder="Ex.: Iluminação da praça"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ws-subj-quorum">Quórum (%)</label>
                    <input
                      id="ws-subj-quorum"
                      className="input"
                      type="number"
                      min={1}
                      max={100}
                      value={subjQuorum}
                      onChange={(e) => setSubjQuorum(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="ws-subj-body">Contexto / Descrição</label>
                  <textarea
                    id="ws-subj-body"
                    className="textarea"
                    value={subjBody}
                    onChange={(e) => setSubjBody(e.target.value)}
                    placeholder="Explique o problema ou objetivo deste debate"
                  />
                </div>

                <div className="btn-row">
                  <button
                    type="submit"
                    className="btn btn--primary btn--sm"
                    disabled={busy}
                  >
                    <MaterialIcon name="send" />
                    <span>Publicar assunto</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn--outlined btn--sm"
                    onClick={onCloseNewSubjectForm}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {!selectedSubject ? (
              subjects.length === 0 ? (
                <div className="empty-state">
                  <MaterialIcon name="forum" />
                  <h2 className="md-title-medium">
                    Nenhum assunto em {categoryTitle}
                  </h2>
                  <p className="md-body-medium">
                    Abra o primeiro assunto desta categoria para começar a
                    enviar e apoiar propostas.
                  </p>
                  {!showNewSubjectForm && (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={onOpenNewSubjectForm}
                      disabled={busy}
                    >
                      <MaterialIcon name="add" />
                      <span>Criar primeiro assunto</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="entity-list" role="list">
                  {subjects.map((subj) => (
                    <button
                      key={subj.docIdHex}
                      type="button"
                      className="subject-list-row"
                      role="listitem"
                      onClick={() => onSelectSubject(subj.scope)}
                    >
                      <div className="subject-list-row__main">
                        <span className="subject-list-row__title">
                          {subj.title}
                        </span>
                        {subj.body && (
                          <span className="subject-list-row__body">
                            {subj.body}
                          </span>
                        )}
                      </div>

                      <div className="subject-list-row__meta gov-tabular">
                        <span>
                          Quórum {subj.quorumPct}% · {subj.proposalCount}{" "}
                          proposta(s)
                        </span>
                        <MaterialIcon name="chevron_right" />
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : subjectProposals.length === 0 ? (
              <div className="empty-state">
                <MaterialIcon name="description" />
                <h2 className="md-title-medium">
                  Nenhuma proposta em {selectedSubject.title}
                </h2>
                <p className="md-body-medium">
                  {selectedSubject.body ||
                    "Publique a primeira proposta para iniciar o debate e a contagem de apoios."}
                </p>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={openNewProposalDrawer}
                >
                  <MaterialIcon name="add" />
                  <span>Criar primeira proposta</span>
                </button>
              </div>
            ) : (
              <div className="entity-list" role="list">
                {subjectProposals.map((prop) => {
                  const isMyPick = prop.supporterPubs.includes(myPubHex);
                  const isSelected = prop.docIdHex === selectedProposalId;
                  const heat = computeHeatInfo(prop.pickCount, requiredVotes);
                  const authorLabel = prop.authorName || "Membro";

                  const rowClass = [
                    "proposal-list-row",
                    isMyPick ? "proposal-list-row--picked" : "",
                    isSelected ? "proposal-list-row--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <article
                      key={prop.docIdHex}
                      data-proposal-id={prop.docIdHex}
                      className={rowClass}
                      role="listitem"
                    >
                      <button
                        type="button"
                        className="proposal-list-row__main"
                        onClick={() => {
                          closeComposerOnly();
                          onSelectProposal(prop.docIdHex);
                        }}
                      >
                        <div className="proposal-list-row__head">
                          <span className="proposal-list-row__title">
                            {prop.title}
                          </span>
                          {prop.parentHashHex && (
                            <span className="chip chip--stze">Fork</span>
                          )}
                          {heat.quorumReached && (
                            <span className="chip chip--memb">Consenso</span>
                          )}
                        </div>

                        <div className="proposal-list-row__sub">
                          {prop.body && (
                            <span className="proposal-list-row__preview">
                              {prop.body}
                            </span>
                          )}
                          <span className="proposal-list-row__meta">
                            {authorLabel} · {formatDateMs(prop.timestampMs)}
                          </span>
                        </div>
                      </button>

                      <div className="proposal-list-row__actions">
                        {isMyPick ? (
                          <button
                            type="button"
                            className="vote-pill vote-pill--active"
                            disabled
                          >
                            <MaterialIcon name="check_circle" filled />
                            <span className="gov-tabular">
                              Apoiado · {prop.pickCount}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="vote-pill"
                            disabled={busy}
                            onClick={() =>
                              void onPickProposal(prop.scope, prop.docIdHex)
                            }
                          >
                            <MaterialIcon name="how_to_vote" />
                            <span className="gov-tabular">
                              Apoiar · {prop.pickCount}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => {
                            closeComposerOnly();
                            onSelectProposal(prop.docIdHex);
                          }}
                          title="Abrir detalhes da proposta"
                          aria-label={`Abrir proposta ${prop.title}`}
                        >
                          <MaterialIcon name="chevron_right" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drawer amplo quase de tela inteira (Detalhes da Proposta, Fork lado a lado ou Nova Proposta) */}
      {isOverlayOpen && (
        <div
          className="detail-drawer-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeAllOverlay();
            }
          }}
        >
          <aside
            className="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={
              activeProposal
                ? activeProposal.title
                : `Nova proposta em ${selectedSubject.title}`
            }
          >
            {drawerMode === "new-proposal" && !activeProposal ? (
              <>
                <header className="detail-drawer__header">
                  <div className="detail-drawer__context">
                    <MaterialIcon name="edit" />
                    <span className="detail-drawer__subject">
                      Nova proposta em {selectedSubject.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={closeAllOverlay}
                    title="Fechar (Esc)"
                    aria-label="Fechar"
                  >
                    <MaterialIcon name="close" />
                  </button>
                </header>

                <div className="detail-drawer__body">
                  <form
                    className="detail-drawer__reading stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void (async () => {
                        const createdId = await onCreateProposal({
                          subjectScope: selectedSubject.scope,
                          title: propTitle,
                          body: propBody,
                        });
                        if (createdId) {
                          setPropTitle("");
                          setPropBody("");
                          closeComposerOnly();
                          onSelectProposal(createdId);
                        }
                      })();
                    }}
                  >
                    <div className="field">
                      <label htmlFor="ws-prop-title">
                        Título da proposta (mín. 5 caracteres)
                      </label>
                      <input
                        id="ws-prop-title"
                        className="input"
                        minLength={5}
                        required
                        autoFocus
                        value={propTitle}
                        onChange={(e) => setPropTitle(e.target.value)}
                        placeholder="Ex.: Instalar 12 luminárias LED"
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="ws-prop-body">
                        Descrição / Justificativa
                      </label>
                      <textarea
                        id="ws-prop-body"
                        className="textarea textarea--tall"
                        required
                        value={propBody}
                        onChange={(e) => setPropBody(e.target.value)}
                        placeholder="Detalhe o que será feito, custos, prazos ou garantias"
                      />
                    </div>

                    <div className="btn-row">
                      <button
                        type="submit"
                        className="btn btn--primary"
                        disabled={busy}
                      >
                        <MaterialIcon name="send" />
                        <span>Publicar proposta</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--outlined"
                        onClick={closeAllOverlay}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              activeProposal &&
              activeHeat !== null && (
                <>
                  <header className="detail-drawer__header">
                    <div className="detail-drawer__context">
                      <span className="detail-drawer__subject">
                        {selectedSubject.title}
                      </span>
                    </div>

                    <div className="detail-drawer__header-actions">
                      {activeIsMyPick ? (
                        <button
                          type="button"
                          className="vote-pill vote-pill--active"
                          disabled
                        >
                          <MaterialIcon name="check_circle" filled />
                          <span className="gov-tabular">
                            Apoiado · {activeProposal.pickCount}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="vote-pill"
                          disabled={busy}
                          onClick={() =>
                            void onPickProposal(
                              activeProposal.scope,
                              activeProposal.docIdHex,
                            )
                          }
                        >
                          <MaterialIcon name="how_to_vote" />
                          <span className="gov-tabular">
                            Apoiar · {activeProposal.pickCount}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        className={
                          isForkSplitActive
                            ? "btn btn--primary btn--sm"
                            : "btn btn--outlined btn--sm"
                        }
                        disabled={busy}
                        onClick={() => toggleForkSplit(activeProposal)}
                      >
                        <MaterialIcon name="fork_right" />
                        <span>
                          {isForkSplitActive ? "Fechar Síntese" : "Síntese"}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="btn btn--tonal btn--sm"
                        onClick={() => void onShareProposal(activeProposal)}
                      >
                        <MaterialIcon name="share" />
                        <span>Compartilhar</span>
                      </button>

                      <button
                        type="button"
                        className="icon-btn"
                        onClick={closeAllOverlay}
                        title="Fechar (Esc)"
                        aria-label="Fechar detalhes da proposta"
                      >
                        <MaterialIcon name="close" />
                      </button>
                    </div>
                  </header>

                  <div className="detail-drawer__body">
                    <div
                      className={
                        isForkSplitActive
                          ? "detail-drawer__split"
                          : "detail-drawer__reading"
                      }
                    >
                      <div className="detail-drawer__pane">
                        {/* Barra Única Integrada de Consenso e Apoiadores */}
                        <section className="consensus-bar">
                          <div className="consensus-bar__header gov-tabular">
                            <strong className="consensus-bar__status">
                              {activeHeat.quorumReached
                                ? `Consenso atingido · ${activeProposal.pickCount} apoios`
                                : `${activeProposal.pickCount} de ${requiredVotes} apoios necessários`}
                            </strong>
                            <span className="consensus-bar__meta">
                              Quórum de {selectedSubject.quorumPct}% (
                              {activeMembersCount} membros ativos)
                            </span>
                          </div>

                          <div className="progress-track" aria-hidden="true">
                            <div
                              className={
                                activeHeat.quorumReached
                                  ? "progress-fill progress-fill--consensus"
                                  : "progress-fill"
                              }
                              style={{
                                width: `${activeHeat.quorumProgressPct}%`,
                              }}
                            />
                          </div>

                          {activeProposal.supporterPubs.length > 0 && (
                            <div className="supporter-list">
                              {activeProposal.supporterPubs.map((pubHex) => (
                                <span
                                  key={pubHex}
                                  className={
                                    pubHex === myPubHex
                                      ? "supporter-chip supporter-chip--me"
                                      : "supporter-chip"
                                  }
                                >
                                  {resolveSupporterLabel(pubHex)}
                                </span>
                              ))}
                            </div>
                          )}
                        </section>

                        {activeProposal.parentHashHex && (
                          <button
                            type="button"
                            className="proposal-detail__lineage"
                            onClick={() => {
                              closeComposerOnly();
                              onSelectProposal(activeProposal.parentHashHex);
                            }}
                          >
                            <MaterialIcon name="fork_right" />
                            <span>
                              Fork baseada em:{" "}
                              <strong>
                                {activeParent
                                  ? activeParent.title
                                  : shortHex(activeProposal.parentHashHex)}
                              </strong>
                            </span>
                          </button>
                        )}

                        <h1 className="detail-drawer__title">
                          {activeProposal.title}
                        </h1>

                        <div className="proposal-detail__meta">
                          <span
                            className="author-avatar author-avatar--sm"
                            aria-hidden="true"
                          >
                            {getInitials(
                              activeProposal.authorName || "Membro",
                              "M",
                            )}
                          </span>
                          <div className="proposal-detail__author-line">
                            <strong>
                              {activeProposal.authorName || "Membro"}
                            </strong>
                            <span className="proposal-card__date">
                              · {formatDateMs(activeProposal.timestampMs)} · ID{" "}
                              <span className="mono">
                                {shortHex(activeProposal.docIdHex)}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="proposal-detail__body">
                          {activeProposal.body}
                        </div>

                        {childForks.length > 0 && (
                          <section className="fork-children-section">
                            <h2 className="md-title-medium">
                              Forks / Sínteses derivados ({childForks.length})
                            </h2>
                            <div className="entity-list">
                              {childForks.map((child) => (
                                <button
                                  key={child.docIdHex}
                                  type="button"
                                  className="fork-child-row"
                                  onClick={() => {
                                    closeComposerOnly();
                                    onSelectProposal(child.docIdHex);
                                  }}
                                >
                                  <div className="fork-child-item__main">
                                    <span className="fork-child-item__title">
                                      {child.title}
                                    </span>
                                    <span className="md-label-medium">
                                      {child.authorName || "Membro"} ·{" "}
                                      {formatDateMs(child.timestampMs)}
                                    </span>
                                  </div>
                                  <span className="chip gov-tabular">
                                    {child.pickCount} apoio(s)
                                  </span>
                                </button>
                              ))}
                            </div>
                          </section>
                        )}
                      </div>

                      {isForkSplitActive && (
                        <form
                          className="detail-drawer__pane detail-drawer__pane--editor stack"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void (async () => {
                              const createdId = await onCreateProposal({
                                subjectScope: activeProposal.scope,
                                title: forkTitle,
                                body: forkBody,
                                parentHashHex: activeProposal.docIdHex,
                              });
                              if (createdId) {
                                closeComposerOnly();
                                onSelectProposal(createdId);
                              }
                            })();
                          }}
                        >
                          <div className="composer-card__header">
                            <div className="btn-row">
                              <MaterialIcon name="fork_right" />
                              <h2 className="md-title-medium">
                                Nova Síntese / Fork
                              </h2>
                            </div>
                          </div>

                          <div className="field">
                            <label htmlFor="fork-title">
                              Título do fork (mín. 5 caracteres)
                            </label>
                            <input
                              id="fork-title"
                              className="input"
                              minLength={5}
                              required
                              autoFocus
                              value={forkTitle}
                              onChange={(e) => setForkTitle(e.target.value)}
                            />
                          </div>

                          <div className="field">
                            <label htmlFor="fork-body">
                              Nova redação / Síntese
                            </label>
                            <textarea
                              id="fork-body"
                              className="textarea textarea--tall"
                              required
                              value={forkBody}
                              onChange={(e) => setForkBody(e.target.value)}
                            />
                          </div>

                          <div className="btn-row">
                            <button
                              type="submit"
                              className="btn btn--primary"
                              disabled={busy}
                            >
                              <MaterialIcon name="fork_right" />
                              <span>Publicar fork</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn--outlined"
                              onClick={closeComposerOnly}
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </>
              )
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
