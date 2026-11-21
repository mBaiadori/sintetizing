import type {
  MemberView,
  ProposalFieldView,
  ProposalSummaryView,
  SubjectSummaryView,
} from "@sintetizing/domain";
import type { ProposalDraftRecord } from "@sintetizing/storage";
import { useCallback, useEffect, useState } from "react";
import type {
  CreateProposalInput,
  CreateSubjectInput,
  SaveDraftInput,
} from "../hooks/useExplorer.js";
import {
  computeHeatInfo,
  formatDateMs,
  formatDeadlineShort,
  GENERAL_CATEGORY_ID,
  getInitials,
  shortHex,
} from "../utils/format.js";
import type { GraphFocus } from "../utils/sankey-graph.js";
import { MaterialIcon } from "./MaterialIcon.js";
import { ProposalDiffPanel } from "./ProposalDiffPanel.js";
import {
  createDefaultField,
  localInputToUnixSeconds,
  ProposalDocumentComposer,
  ProposalFieldsRenderer,
  unixSecondsToLocalInput,
} from "./ProposalDocumentFields.js";
import { SupportersCollapsible } from "./SupportersCollapsible.js";

export interface WorkspaceColumnsProps {
  readonly myPubHex: string;
  readonly activeQuorumPct: number;
  readonly activeMembersCount: number;
  readonly members: readonly MemberView[];
  readonly categoryId: string;
  readonly categoryTitle: string;
  readonly subjects: readonly SubjectSummaryView[];
  readonly selectedSubject: SubjectSummaryView | null;
  readonly proposals: readonly ProposalSummaryView[];
  readonly selectedProposalId: string | null;
  readonly drafts: readonly ProposalDraftRecord[];
  readonly hiddenDocIds: ReadonlySet<string>;
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
  readonly onSaveDraft: (input: SaveDraftInput) => Promise<void>;
  readonly onDeleteDraft: (draftId: string) => Promise<void>;
  readonly onHideDocument: (
    docIdHex: string,
    kind: "SUBJECT" | "PROPOSAL",
  ) => Promise<void>;
  readonly onUnhideDocument: (docIdHex: string) => Promise<void>;
  readonly onPickProposal: (scope: string, docIdHex: string) => Promise<void>;
  readonly onShareProposal: (proposal: ProposalSummaryView) => Promise<void>;
  readonly onOpenGraph: (focus: GraphFocus) => void;
}

type DrawerMode = "closed" | "new-proposal" | "fork" | "diff";

function renderStatusChip(prop: ProposalSummaryView) {
  switch (prop.status) {
    case "APPROVED":
      return <span className="chip chip--memb">Aprovada no prazo</span>;
    case "CONSENSUS":
      return <span className="chip chip--memb">Consenso</span>;
    case "EXPIRED":
      return <span className="chip chip--left">Prazo encerrado</span>;
    case "OPEN":
      return null;
  }
}

export function WorkspaceColumns({
  myPubHex,
  activeQuorumPct,
  activeMembersCount,
  members,
  categoryId,
  categoryTitle,
  subjects,
  selectedSubject,
  proposals,
  selectedProposalId,
  drafts,
  hiddenDocIds,
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
  onSaveDraft,
  onDeleteDraft,
  onHideDocument,
  onUnhideDocument,
  onPickProposal,
  onShareProposal,
  onOpenGraph,
}: WorkspaceColumnsProps) {
  const [subjTitle, setSubjTitle] = useState("");
  const [confirmNewSubject, setConfirmNewSubject] = useState(false);
  const [subjError, setSubjError] = useState<string | null>(null);
  const [subjBody, setSubjBody] = useState("");
  const [subjMode, setSubjMode] = useState<"QUORUM" | "OPEN">("QUORUM");
  const [subjDeadlineInput, setSubjDeadlineInput] = useState("");

  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [forkTargetId, setForkTargetId] = useState<string | null>(null);

  const [propTitle, setPropTitle] = useState("");
  const [propDeadlineInput, setPropDeadlineInput] = useState("");
  const [propFields, setPropFields] = useState<readonly ProposalFieldView[]>(
    () => [createDefaultField("TEXT")],
  );

  const [forkTitle, setForkTitle] = useState("");
  const [forkDeadlineInput, setForkDeadlineInput] = useState("");
  const [forkFields, setForkFields] = useState<readonly ProposalFieldView[]>(
    [],
  );

  const [showHiddenSubjects, setShowHiddenSubjects] = useState(false);
  const [showHiddenProposals, setShowHiddenProposals] = useState(false);
  const [showSuperseded, setShowSuperseded] = useState(false);

  useEffect(() => {
    setDrawerMode("closed");
    setForkTargetId(null);
    setShowHiddenProposals(false);
    setShowSuperseded(false);
  }, [selectedSubject?.scope]);

  const visibleSubjects = subjects.filter((s) => !hiddenDocIds.has(s.docIdHex));
  const hiddenSubjects = subjects.filter((s) => hiddenDocIds.has(s.docIdHex));
  const displayedSubjects = showHiddenSubjects ? subjects : visibleSubjects;

  const subjectProposals = selectedSubject
    ? proposals
        .filter((p) => p.scope === selectedSubject.scope)
        .sort(
          (a, b) => b.pickCount - a.pickCount || b.timestampMs - a.timestampMs,
        )
    : [];

  const hasAnySupportedProposal = subjectProposals.some(
    (p) => !hiddenDocIds.has(p.docIdHex) && p.pickCount > 0,
  );
  const isZeroSupportHidden = (p: ProposalSummaryView) =>
    p.supersededByDocIdHex !== null ||
    (hasAnySupportedProposal && p.pickCount === 0);

  const visibleProposals = subjectProposals.filter(
    (p) => !hiddenDocIds.has(p.docIdHex) && !isZeroSupportHidden(p),
  );
  const supersededProposals = subjectProposals.filter(
    (p) => !hiddenDocIds.has(p.docIdHex) && isZeroSupportHidden(p),
  );
  const hiddenProposals = subjectProposals.filter((p) =>
    hiddenDocIds.has(p.docIdHex),
  );

  const activeProposal = selectedProposalId
    ? (subjectProposals.find((p) => p.docIdHex === selectedProposalId) ?? null)
    : null;

  const activeRequiredVotes = activeProposal
    ? activeProposal.requiredVotes
    : (selectedSubject?.requiredVotes ?? 0);

  const activeHeat =
    activeProposal && activeProposal.quorumPct !== null
      ? computeHeatInfo(activeProposal.pickCount, activeRequiredVotes)
      : { quorumProgressPct: 0, quorumReached: false };

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
    setPropTitle("");
    setPropDeadlineInput(
      unixSecondsToLocalInput(selectedSubject?.deadlineUnixSeconds ?? null),
    );
    setPropFields([createDefaultField("TEXT")]);
    setDrawerMode("new-proposal");
  };

  const toggleForkSplit = (prop: ProposalSummaryView) => {
    if (drawerMode === "fork" && forkTargetId === prop.docIdHex) {
      closeComposerOnly();
      return;
    }
    setForkTargetId(prop.docIdHex);
    setForkTitle(prop.title);
    setForkDeadlineInput(unixSecondsToLocalInput(prop.deadlineUnixSeconds));
    setForkFields(
      prop.fields.map((f) =>
        f.kind === "TABLE"
          ? {
              ...f,
              columns: [...f.columns],
              rows: f.rows.map((r) => [...r]),
            }
          : { ...f },
      ),
    );
    setDrawerMode("fork");
    onSelectProposal(prop.docIdHex);
  };

  const toggleDiffSplit = (prop: ProposalSummaryView) => {
    if (drawerMode === "diff" && forkTargetId === prop.docIdHex) {
      closeComposerOnly();
      return;
    }
    setForkTargetId(prop.docIdHex);
    setDrawerMode("diff");
    onSelectProposal(prop.docIdHex);
  };

  const isForkSplitActive =
    drawerMode === "fork" &&
    activeProposal !== null &&
    forkTargetId === activeProposal.docIdHex;

  const isDiffSplitActive =
    drawerMode === "diff" &&
    activeProposal !== null &&
    forkTargetId === activeProposal.docIdHex;

  const newProposalDraftId = selectedSubject
    ? `new:${selectedSubject.scope}`
    : "";
  const newProposalDraft =
    drafts.find((d) => d.draftId === newProposalDraftId) ?? null;

  const forkDraftId = activeProposal ? `fork:${activeProposal.docIdHex}` : "";
  const forkDraft = drafts.find((d) => d.draftId === forkDraftId) ?? null;

  const renderProposalRow = (
    prop: ProposalSummaryView,
    isHiddenRow = false,
  ) => {
    const isMyPick = prop.supporterPubs.includes(myPubHex);
    const isSelected = prop.docIdHex === selectedProposalId;
    const heat =
      prop.quorumPct === null
        ? { quorumProgressPct: 0, quorumReached: false }
        : computeHeatInfo(prop.pickCount, prop.requiredVotes);
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
            <span className="proposal-list-row__title">{prop.title}</span>
            {prop.parentHashHex && (
              <span className="chip chip--stze">Fork</span>
            )}
            {renderStatusChip(prop)}
            {prop.fields.length > 1 && (
              <span className="chip gov-tabular">
                {prop.fields.length} campos
              </span>
            )}
          </div>

          <div className="proposal-list-row__sub">
            {prop.body && (
              <span className="proposal-list-row__preview">{prop.body}</span>
            )}
            <span className="proposal-list-row__meta">
              {authorLabel} · {formatDateMs(prop.timestampMs)}
              {prop.deadlineUnixSeconds !== null
                ? ` · Prazo: ${formatDeadlineShort(prop.deadlineUnixSeconds)}`
                : ""}
              {prop.quorumPct !== null
                ? ` · ${heat.quorumProgressPct}% do quórum`
                : " · Assunto aberto"}
            </span>
          </div>
        </button>

        <div className="proposal-list-row__actions">
          {isHiddenRow && (
            <button
              type="button"
              className="btn btn--outlined btn--sm"
              onClick={() => void onUnhideDocument(prop.docIdHex)}
            >
              Reexibir
            </button>
          )}

          {isMyPick ? (
            <button
              type="button"
              className="vote-pill vote-pill--active"
              disabled
            >
              <MaterialIcon name="check_circle" filled />
              <span className="gov-tabular">Apoiado · {prop.pickCount}</span>
            </button>
          ) : (
            <button
              type="button"
              className="vote-pill"
              disabled={busy || !prop.isVotingOpen}
              onClick={() => void onPickProposal(prop.scope, prop.docIdHex)}
              title={
                prop.isVotingOpen
                  ? "Apoiar esta proposta"
                  : "Prazo de votação encerrado"
              }
            >
              <MaterialIcon name="how_to_vote" />
              <span className="gov-tabular">
                {prop.isVotingOpen ? "Apoiar" : "Encerrada"} · {prop.pickCount}
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
  };

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
                {selectedSubject.quorumPct === null
                  ? "Assunto aberto (sem quórum)"
                  : `Quórum ${selectedSubject.quorumPct}% · Mín. ${selectedSubject.requiredVotes}`}
              </span>
              {selectedSubject.deadlineUnixSeconds !== null && (
                <span
                  className={
                    selectedSubject.isExpired
                      ? "chip chip--left gov-tabular"
                      : "chip gov-tabular"
                  }
                >
                  {selectedSubject.isExpired ? "Encerrado" : "Prazo"}:{" "}
                  {formatDeadlineShort(selectedSubject.deadlineUnixSeconds)}
                </span>
              )}
              <button
                type="button"
                className="btn btn--outlined btn--sm"
                onClick={() =>
                  void (hiddenDocIds.has(selectedSubject.docIdHex)
                    ? onUnhideDocument(selectedSubject.docIdHex)
                    : onHideDocument(selectedSubject.docIdHex, "SUBJECT"))
                }
                title="Ocultar ou reexibir assunto localmente"
              >
                <MaterialIcon
                  name={
                    hiddenDocIds.has(selectedSubject.docIdHex)
                      ? "visibility"
                      : "visibility_off"
                  }
                />
                <span>
                  {hiddenDocIds.has(selectedSubject.docIdHex)
                    ? "Reexibir"
                    : "Ocultar"}
                </span>
              </button>
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
                  const trimmedTitle = subjTitle.trim();
                  if (trimmedTitle.length < 5) {
                    setSubjError(
                      "O título do assunto deve ter pelo menos 5 caracteres.",
                    );
                    return;
                  }
                  const duplicate = subjects.some(
                    (s) =>
                      s.title.trim().toLowerCase() ===
                      trimmedTitle.toLowerCase(),
                  );
                  if (duplicate) {
                    setSubjError(
                      "Já existe um assunto com esse título nesta categoria.",
                    );
                    return;
                  }
                  const deadlineUnixSeconds =
                    localInputToUnixSeconds(subjDeadlineInput);
                  if (
                    subjDeadlineInput.trim() &&
                    deadlineUnixSeconds === undefined
                  ) {
                    setSubjError("Data/hora do prazo inválida.");
                    return;
                  }
                  if (
                    deadlineUnixSeconds !== undefined &&
                    deadlineUnixSeconds * 1000 <= Date.now()
                  ) {
                    setSubjError("O prazo do assunto deve ser no futuro.");
                    return;
                  }
                  setSubjError(null);
                  if (!confirmNewSubject) {
                    setConfirmNewSubject(true);
                    return;
                  }
                  void (async () => {
                    const input: CreateSubjectInput = {
                      title: trimmedTitle,
                      body: subjBody.trim(),
                      deliberationMode: subjMode,
                      ...(deadlineUnixSeconds !== undefined
                        ? { deadlineUnixSeconds }
                        : {}),
                      ...(categoryId !== GENERAL_CATEGORY_ID
                        ? { categoryHashHex: categoryId }
                        : {}),
                    };
                    const createdScope = await onCreateSubject(input);
                    if (createdScope) {
                      setSubjTitle("");
                      setSubjBody("");
                      setSubjDeadlineInput("");
                      setSubjMode("QUORUM");
                      setConfirmNewSubject(false);
                      setSubjError(null);
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
                      O quórum de aprovação é definido pela comunidade (
                      {activeQuorumPct}%), ou você pode abrir um assunto livre
                      sem quórum.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setConfirmNewSubject(false);
                      setSubjError(null);
                      onCloseNewSubjectForm();
                    }}
                    aria-label="Cancelar novo assunto"
                  >
                    <MaterialIcon name="close" />
                  </button>
                </div>

                {subjError && (
                  <p
                    className="md-body-small"
                    style={{ color: "var(--md-sys-color-error)" }}
                  >
                    {subjError}
                  </p>
                )}

                {!confirmNewSubject ? (
                  <>
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
                          onChange={(e) => {
                            setSubjTitle(e.target.value);
                            if (subjError) setSubjError(null);
                          }}
                          placeholder="Ex.: Iluminação da praça"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="ws-subj-mode">
                          Tipo de deliberação
                        </label>
                        <select
                          id="ws-subj-mode"
                          className="input"
                          value={subjMode}
                          onChange={(e) =>
                            setSubjMode(e.target.value as "QUORUM" | "OPEN")
                          }
                        >
                          <option value="QUORUM">
                            Com quórum da comunidade ({activeQuorumPct}%)
                          </option>
                          <option value="OPEN">
                            Assunto aberto (sem meta de quórum)
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="row-2">
                      <div className="field">
                        <label htmlFor="ws-subj-body">
                          Contexto / Descrição
                        </label>
                        <textarea
                          id="ws-subj-body"
                          className="textarea"
                          value={subjBody}
                          onChange={(e) => setSubjBody(e.target.value)}
                          placeholder="Explique o problema ou objetivo deste debate"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="ws-subj-deadline">
                          Prazo padrão do assunto (opcional)
                        </label>
                        <input
                          id="ws-subj-deadline"
                          type="datetime-local"
                          className="input"
                          value={subjDeadlineInput}
                          onChange={(e) => {
                            setSubjDeadlineInput(e.target.value);
                            if (subjError) setSubjError(null);
                          }}
                        />
                      </div>
                    </div>

                    <div className="btn-row">
                      <button
                        type="submit"
                        className="btn btn--primary btn--sm"
                        disabled={busy}
                      >
                        <MaterialIcon name="visibility" />
                        <span>Revisar assunto</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--outlined btn--sm"
                        onClick={() => {
                          setConfirmNewSubject(false);
                          setSubjError(null);
                          onCloseNewSubjectForm();
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="confirm-publish-box">
                    <h3 className="md-title-small">
                      Confirmar publicação do assunto
                    </h3>
                    <p className="md-body-small">
                      Depois de publicado na rede, o assunto não pode ser
                      apagado.
                    </p>
                    <ul className="confirm-publish-list">
                      <li>
                        <strong>Categoria:</strong> {categoryTitle}
                      </li>
                      <li>
                        <strong>Título:</strong> {subjTitle.trim()}
                      </li>
                      <li>
                        <strong>Deliberação:</strong>{" "}
                        {subjMode === "OPEN"
                          ? "Assunto aberto (sem meta de quórum)"
                          : `Com quórum da comunidade (${activeQuorumPct}%)`}
                      </li>
                      {subjDeadlineInput.trim() && (
                        <li>
                          <strong>Prazo padrão:</strong>{" "}
                          {new Date(subjDeadlineInput).toLocaleString()}
                        </li>
                      )}
                      {subjBody.trim() && (
                        <li>
                          <strong>Descrição:</strong> {subjBody.trim()}
                        </li>
                      )}
                    </ul>
                    <div className="btn-row">
                      <button
                        type="submit"
                        className="btn btn--primary btn--sm"
                        disabled={busy}
                      >
                        <MaterialIcon name="send" />
                        <span>Confirmar e publicar</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--outlined btn--sm"
                        onClick={() => setConfirmNewSubject(false)}
                      >
                        Voltar para editar
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}

            {!selectedSubject ? (
              displayedSubjects.length === 0 && hiddenSubjects.length === 0 ? (
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
                <div className="stack">
                  <div className="entity-list" role="list">
                    {displayedSubjects.map((subj) => {
                      const isHidden = hiddenDocIds.has(subj.docIdHex);
                      return (
                        <div
                          key={subj.docIdHex}
                          className="subject-list-row"
                          role="listitem"
                        >
                          <button
                            type="button"
                            className="subject-list-row__main subject-list-row__btn"
                            onClick={() => onSelectSubject(subj.scope)}
                          >
                            <span className="subject-list-row__title">
                              {subj.title}
                            </span>
                            {subj.body && (
                              <span className="subject-list-row__body">
                                {subj.body}
                              </span>
                            )}
                          </button>

                          <div className="subject-list-row__meta gov-tabular">
                            <span>
                              {subj.quorumPct === null
                                ? "Assunto aberto"
                                : `Quórum ${subj.quorumPct}%`}{" "}
                              · {subj.proposalCount} proposta(s)
                              {subj.deadlineUnixSeconds !== null
                                ? ` · ${subj.isExpired ? "Encerrado" : "Prazo"} ${formatDeadlineShort(subj.deadlineUnixSeconds)}`
                                : ""}
                            </span>
                            {isHidden && (
                              <button
                                type="button"
                                className="btn btn--outlined btn--sm"
                                onClick={() =>
                                  void onUnhideDocument(subj.docIdHex)
                                }
                              >
                                Reexibir
                              </button>
                            )}
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => onSelectSubject(subj.scope)}
                              aria-label={`Abrir ${subj.title}`}
                            >
                              <MaterialIcon name="chevron_right" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {hiddenSubjects.length > 0 && (
                    <div>
                      <button
                        type="button"
                        className="btn btn--outlined btn--sm"
                        onClick={() => setShowHiddenSubjects((prev) => !prev)}
                      >
                        <MaterialIcon
                          name={
                            showHiddenSubjects ? "visibility_off" : "visibility"
                          }
                        />
                        <span>
                          {showHiddenSubjects
                            ? "Esconder ocultados localmente"
                            : `Ocultos localmente (${hiddenSubjects.length})`}
                        </span>
                      </button>
                    </div>
                  )}
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
              <div className="stack">
                <div className="entity-list" role="list">
                  {(() => {
                    const treeProposals = showSuperseded
                      ? [...visibleProposals, ...supersededProposals]
                      : visibleProposals;
                    const visibleIds = new Set(
                      treeProposals.map((p) => p.docIdHex),
                    );
                    const childrenByParent = new Map<
                      string,
                      ProposalSummaryView[]
                    >();
                    const roots: ProposalSummaryView[] = [];
                    for (const prop of treeProposals) {
                      if (prop.parentHashHex && visibleIds.has(prop.parentHashHex)) {
                        const list = childrenByParent.get(prop.parentHashHex) ?? [];
                        list.push(prop);
                        childrenByParent.set(prop.parentHashHex, list);
                      } else {
                        roots.push(prop);
                      }
                    }
                    const renderBranch = (
                      prop: ProposalSummaryView,
                    ): React.ReactNode => {
                      const children = childrenByParent.get(prop.docIdHex) ?? [];
                      return (
                        <div key={prop.docIdHex} className="fork-tree__branch">
                          {renderProposalRow(prop, false)}
                          {children.length > 0 && (
                            <div className="fork-tree__children">
                              {children.map((child) => (
                                <div
                                  key={child.docIdHex}
                                  className="fork-tree__item"
                                >
                                  {renderBranch(child)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    };
                    return roots.map((root) => renderBranch(root));
                  })()}
                </div>

                {(supersededProposals.length > 0 ||
                  hiddenProposals.length > 0) && (
                  <div className="btn-row" style={{ flexWrap: "wrap" }}>
                    {supersededProposals.length > 0 && (
                      <button
                        type="button"
                        className="btn btn--outlined btn--sm"
                        onClick={() => setShowSuperseded((prev) => !prev)}
                      >
                        <MaterialIcon name="history" />
                        <span>
                          {showSuperseded
                            ? "Recolher versões sem apoio"
                            : `Versões sem apoio (${supersededProposals.length})`}
                        </span>
                      </button>
                    )}

                    {hiddenProposals.length > 0 && (
                      <button
                        type="button"
                        className="btn btn--outlined btn--sm"
                        onClick={() => setShowHiddenProposals((prev) => !prev)}
                      >
                        <MaterialIcon
                          name={
                            showHiddenProposals
                              ? "visibility_off"
                              : "visibility"
                          }
                        />
                        <span>
                          {showHiddenProposals
                            ? "Esconder ocultas"
                            : `Ocultas localmente (${hiddenProposals.length})`}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {showHiddenProposals && hiddenProposals.length > 0 && (
                  <div className="entity-list" role="list">
                    {hiddenProposals.map((prop) =>
                      renderProposalRow(prop, true),
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drawer amplo (Detalhes, Composer modular, Fork ou Diff lado a lado) */}
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
                  <div className="detail-drawer__reading">
                    <ProposalDocumentComposer
                      modeLabel="Nova Proposta"
                      submitLabel="publicar proposta"
                      submitIcon="send"
                      deliberationMode={selectedSubject.deliberationMode}
                      quorumPct={selectedSubject.quorumPct}
                      subjectScope={selectedSubject.scope}
                      parentHashHex={null}
                      draftId={newProposalDraftId}
                      existingDrafts={drafts.filter(
                        (d) =>
                          d.subjectScope === selectedSubject.scope &&
                          d.parentHashHex === null,
                      )}
                      title={propTitle}
                      deadlineInput={propDeadlineInput}
                      fields={propFields}
                      busy={busy}
                      onChangeTitle={setPropTitle}
                      onChangeDeadlineInput={setPropDeadlineInput}
                      onChangeFields={setPropFields}
                      onSaveDraft={onSaveDraft}
                      onDeleteDraft={onDeleteDraft}
                      onLoadDraft={(draft) => {
                        setPropTitle(draft.title);
                        setPropDeadlineInput(
                          unixSecondsToLocalInput(draft.deadlineUnixSeconds),
                        );
                        setPropFields(
                          draft.fields.length > 0
                            ? draft.fields
                            : [createDefaultField("TEXT")],
                        );
                      }}
                      onSubmitPublish={async (payload) => {
                        const createdId = await onCreateProposal({
                          subjectScope: selectedSubject.scope,
                          title: payload.title,
                          body: payload.body,
                          ...(payload.deadlineUnixSeconds !== undefined
                            ? {
                                deadlineUnixSeconds:
                                  payload.deadlineUnixSeconds,
                              }
                            : {}),
                          fields: payload.fields,
                        });
                        if (createdId) {
                          setPropTitle("");
                          setPropDeadlineInput("");
                          setPropFields([createDefaultField("TEXT")]);
                          closeComposerOnly();
                          onSelectProposal(createdId);
                          return true;
                        }
                        return false;
                      }}
                      onCancel={closeAllOverlay}
                    />
                  </div>
                </div>
              </>
            ) : (
              activeProposal && (
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
                          disabled={busy || !activeProposal.isVotingOpen}
                          onClick={() =>
                            void onPickProposal(
                              activeProposal.scope,
                              activeProposal.docIdHex,
                            )
                          }
                          title={
                            activeProposal.isVotingOpen
                              ? "Apoiar esta proposta"
                              : "Prazo encerrado"
                          }
                        >
                          <MaterialIcon name="how_to_vote" />
                          <span className="gov-tabular">
                            {activeProposal.isVotingOpen
                              ? "Apoiar"
                              : "Encerrada"}{" "}
                            · {activeProposal.pickCount}
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
                        className={
                          isDiffSplitActive
                            ? "btn btn--primary btn--sm"
                            : "btn btn--outlined btn--sm"
                        }
                        onClick={() => toggleDiffSplit(activeProposal)}
                      >
                        <MaterialIcon name="compare_arrows" />
                        <span>
                          {isDiffSplitActive ? "Fechar Diff" : "Comparar"}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="btn btn--outlined btn--sm"
                        onClick={() => {
                          if (hiddenDocIds.has(activeProposal.docIdHex)) {
                            void onUnhideDocument(activeProposal.docIdHex);
                          } else {
                            void onHideDocument(
                              activeProposal.docIdHex,
                              "PROPOSAL",
                            );
                            closeAllOverlay();
                          }
                        }}
                        title="Ocultar proposta localmente neste dispositivo"
                      >
                        <MaterialIcon
                          name={
                            hiddenDocIds.has(activeProposal.docIdHex)
                              ? "visibility"
                              : "visibility_off"
                          }
                        />
                        <span>
                          {hiddenDocIds.has(activeProposal.docIdHex)
                            ? "Reexibir"
                            : "Ocultar"}
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
                        isForkSplitActive || isDiffSplitActive
                          ? "detail-drawer__split"
                          : "detail-drawer__reading"
                      }
                    >
                      <div className="detail-drawer__pane">
                        {/* Barra Única Integrada de Consenso / Estado / Prazo */}
                        <section className="consensus-bar">
                          <div className="consensus-bar__header gov-tabular">
                            <strong className="consensus-bar__status">
                              {activeProposal.quorumPct === null
                                ? activeProposal.status === "APPROVED"
                                  ? `Mais apoiada no encerramento · ${activeProposal.pickCount} apoio(s)`
                                  : `Assunto aberto · ${activeProposal.pickCount} apoio(s)`
                                : activeProposal.status === "APPROVED"
                                  ? `Aprovada no prazo · ${activeProposal.pickCount} apoios`
                                  : activeProposal.status === "EXPIRED"
                                    ? `Prazo encerrado sem quórum · ${activeProposal.pickCount} de ${activeRequiredVotes}`
                                    : activeHeat.quorumReached
                                      ? `Consenso atingido · ${activeProposal.pickCount} apoios`
                                      : `${activeProposal.pickCount} de ${activeRequiredVotes} apoios necessários`}
                            </strong>
                            <span className="consensus-bar__meta">
                              {activeProposal.quorumPct === null
                                ? "Sem meta de quórum"
                                : `Quórum de ${activeProposal.quorumPct}% (${activeMembersCount} membros ativos)`}
                            </span>
                          </div>

                          {activeProposal.quorumPct !== null && (
                            <div className="progress-track" aria-hidden="true">
                              <div
                                className={
                                  activeHeat.quorumReached ||
                                  activeProposal.status === "APPROVED"
                                    ? "progress-fill progress-fill--consensus"
                                    : "progress-fill"
                                }
                                style={{
                                  width: `${activeHeat.quorumProgressPct}%`,
                                }}
                              />
                            </div>
                          )}

                          {activeProposal.deadlineUnixSeconds !== null && (
                            <p
                              className="md-label-medium"
                              style={{ marginTop: 8 }}
                            >
                              {activeProposal.isVotingOpen
                                ? `Prazo limite: ${formatDeadlineShort(activeProposal.deadlineUnixSeconds)}`
                                : `Prazo encerrado em ${formatDeadlineShort(activeProposal.deadlineUnixSeconds)}`}
                            </p>
                          )}

                          <SupportersCollapsible
                            supporterPubs={activeProposal.supporterPubs}
                            members={members}
                            myPubHex={myPubHex}
                          />
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

                        <ProposalFieldsRenderer
                          fields={activeProposal.fields}
                        />

                        {childForks.length > 0 && (
                          <section className="fork-children-section">
                            <h2 className="md-title-medium">
                              Sínteses derivadas ({childForks.length})
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
                        <div className="detail-drawer__pane detail-drawer__pane--editor">
                          <div className="composer-card__header">
                            <div className="btn-row">
                              <MaterialIcon name="fork_right" />
                              <h2 className="md-title-medium">
                                Nova Síntese / Fork
                              </h2>
                            </div>
                          </div>

                          <ProposalDocumentComposer
                            modeLabel="Síntese / Fork"
                            submitLabel="publicar fork"
                            submitIcon="fork_right"
                            deliberationMode={activeProposal.deliberationMode}
                            quorumPct={activeProposal.quorumPct}
                            subjectScope={activeProposal.scope}
                            parentHashHex={activeProposal.docIdHex}
                            draftId={forkDraftId}
                            existingDrafts={drafts.filter(
                              (d) =>
                                d.subjectScope === activeProposal.scope &&
                                d.parentHashHex === activeProposal.docIdHex,
                            )}
                            title={forkTitle}
                            deadlineInput={forkDeadlineInput}
                            fields={forkFields}
                            busy={busy}
                            onChangeTitle={setForkTitle}
                            onChangeDeadlineInput={setForkDeadlineInput}
                            onChangeFields={setForkFields}
                            onSaveDraft={onSaveDraft}
                            onDeleteDraft={onDeleteDraft}
                            onLoadDraft={(draft) => {
                              setForkTitle(draft.title);
                              setForkDeadlineInput(
                                unixSecondsToLocalInput(
                                  draft.deadlineUnixSeconds,
                                ),
                              );
                              setForkFields(
                                draft.fields.length > 0
                                  ? draft.fields
                                  : [createDefaultField("TEXT")],
                              );
                            }}
                            onSubmitPublish={async (payload) => {
                              const createdId = await onCreateProposal({
                                subjectScope: activeProposal.scope,
                                title: payload.title,
                                body: payload.body,
                                parentHashHex: activeProposal.docIdHex,
                                ...(payload.deadlineUnixSeconds !== undefined
                                  ? {
                                      deadlineUnixSeconds:
                                        payload.deadlineUnixSeconds,
                                    }
                                  : {}),
                                fields: payload.fields,
                              });
                              if (createdId) {
                                closeComposerOnly();
                                onSelectProposal(createdId);
                                return true;
                              }
                              return false;
                            }}
                            onCancel={closeComposerOnly}
                          />
                        </div>
                      )}

                      {isDiffSplitActive && (
                        <div className="detail-drawer__pane detail-drawer__pane--editor">
                          <div className="composer-card__header">
                            <div className="btn-row">
                              <MaterialIcon name="compare_arrows" />
                              <h2 className="md-title-medium">
                                Comparação Estruturada (Diff)
                              </h2>
                            </div>
                          </div>

                          <ProposalDiffPanel
                            targetProposal={activeProposal}
                            candidates={subjectProposals}
                            defaultBaseId={activeProposal.parentHashHex}
                          />
                        </div>
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
