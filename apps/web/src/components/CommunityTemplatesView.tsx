import {
  BUILTIN_TEMPLATE_CATEGORIES,
  CommunityProjection,
  instantiateTemplateFields,
  MemberView,
  ProposalFieldView,
  ProposalSummaryView,
  ProposalTemplateSummaryView,
  SubjectSummaryView,
  TemplateCategorySummaryView,
} from "@sintetizing/domain";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  CreateProposalTemplateInput,
  CreateTemplateCategoryInput,
} from "../hooks/useExplorer.js";
import { formatDateMs, getInitials, shortHex } from "../utils/format.js";
import { MaterialIcon } from "./MaterialIcon.js";
import { ProposalDiffPanel } from "./ProposalDiffPanel.js";
import {
  createDefaultField,
  ProposalDocumentComposer,
  ProposalFieldsRenderer,
} from "./ProposalDocumentFields.js";
import { SupportersCollapsible } from "./SupportersCollapsible.js";

export interface CommunityTemplatesViewProps {
  readonly myPubHex: string;
  readonly communityTitle: string;
  readonly projection: CommunityProjection | null;
  readonly selectedCategoryId: string | null;
  readonly selectedTemplateId: string | null;
  readonly sidebarCollapsed: boolean;
  readonly busy: boolean;
  readonly onToggleSidebar: () => void;
  readonly onSelectCategory: (categoryId: string) => void;
  readonly onSelectTemplate: (templateId: string | null) => void;
  readonly onCreateTemplateCategory: (
    input: CreateTemplateCategoryInput
  ) => Promise<string | null>;
  readonly onCreateProposalTemplate: (
    input: CreateProposalTemplateInput
  ) => Promise<string | null>;
  readonly onPickTemplate: (
    categoryId: string,
    templateDocIdHex: string
  ) => Promise<void>;
  readonly onUseTemplateInSubject: (
    template: ProposalTemplateSummaryView,
    subjectScope: string
  ) => void;
}

type DrawerMode = "closed" | "new-template" | "fork" | "diff";

function toDiffableProposal(
  tpl: ProposalTemplateSummaryView
): ProposalSummaryView {
  return {
    docIdHex: tpl.docIdHex,
    scope: tpl.scope,
    title: tpl.title,
    body: tpl.body,
    fields: tpl.fields,
    authorPubHex: tpl.authorPubHex,
    authorName: tpl.authorName,
    parentHashHex: tpl.parentHashHex,
    timestampMs: tpl.timestampMs,
    deadlineUnixSeconds: null,
    deliberationMode: "OPEN",
    quorumPct: null,
    requiredVotes: 0,
    status: "OPEN",
    isVotingOpen: true,
    supersededByDocIdHex: null,
    pickCount: tpl.pickCount,
    supporterPubs: tpl.supporterPubs,
  };
}

export function CommunityTemplatesView({
  myPubHex,
  communityTitle,
  projection,
  selectedCategoryId,
  selectedTemplateId,
  sidebarCollapsed,
  busy,
  onToggleSidebar,
  onSelectCategory,
  onSelectTemplate,
  onCreateTemplateCategory,
  onCreateProposalTemplate,
  onPickTemplate,
  onUseTemplateInSubject,
}: CommunityTemplatesViewProps) {
  const categories: readonly TemplateCategorySummaryView[] =
    projection?.templateCategories ?? BUILTIN_TEMPLATE_CATEGORIES;
  const allTemplates: readonly ProposalTemplateSummaryView[] =
    projection?.templates ?? [];
  const members: readonly MemberView[] = projection?.members ?? [];
  const subjects: readonly SubjectSummaryView[] = projection?.subjects ?? [];
  const openSubjects = subjects.filter((s) => !s.isExpired);

  const activeCategoryId =
    selectedCategoryId &&
    categories.some((c) => c.docIdHex === selectedCategoryId)
      ? selectedCategoryId
      : (categories[0]?.docIdHex ?? "");

  const activeCategory =
    categories.find((c) => c.docIdHex === activeCategoryId) ?? null;

  const categoryTemplates = allTemplates.filter(
    (t) => t.categoryId === activeCategoryId
  );

  const activeTemplate = selectedTemplateId
    ? (allTemplates.find((t) => t.docIdHex === selectedTemplateId) ?? null)
    : null;

  const [drawerMode, setDrawerMode] = useState<DrawerMode>("closed");
  const [tplTitle, setTplTitle] = useState("");
  const [tplDeadlinePlaceholder, setTplDeadlinePlaceholder] = useState("");
  const [tplFields, setTplFields] = useState<readonly ProposalFieldView[]>(() => [
    createDefaultField("TEXT"),
  ]);

  const [forkTitle, setForkTitle] = useState("");
  const [forkDeadlinePlaceholder, setForkDeadlinePlaceholder] = useState("");
  const [forkFields, setForkFields] = useState<readonly ProposalFieldView[]>(
    []
  );

  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [newCatTitle, setNewCatTitle] = useState("");
  const [newCatBody, setNewCatBody] = useState("");
  const [newCatError, setNewCatError] = useState<string | null>(null);

  const [showUseModal, setShowUseModal] = useState(false);
  const [targetSubjectScope, setTargetSubjectScope] = useState<string>(
    () => openSubjects[0]?.scope ?? subjects[0]?.scope ?? ""
  );

  useEffect(() => {
    const firstScope = openSubjects[0]?.scope ?? subjects[0]?.scope ?? "";
    if (!targetSubjectScope && firstScope) {
      setTargetSubjectScope(firstScope);
    }
  }, [openSubjects, subjects, targetSubjectScope]);

  const isOverlayOpen =
    activeTemplate !== null || drawerMode === "new-template";

  const closeOverlay = useCallback(() => {
    setDrawerMode("closed");
    setShowUseModal(false);
    onSelectTemplate(null);
  }, [onSelectTemplate]);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeOverlay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOverlay, isOverlayOpen]);

  const openNewTemplateDrawer = () => {
    onSelectTemplate(null);
    setTplTitle("");
    setTplDeadlinePlaceholder("");
    setTplFields([
      {
        kind: "TEXT",
        fieldId: "tpl-contexto",
        label: "Objetivo / Contexto",
        text: "Ex.: Explique quando e por que usar este modelo de proposta.",
      },
    ]);
    setDrawerMode("new-template");
  };

  const toggleForkSplit = (tpl: ProposalTemplateSummaryView) => {
    if (drawerMode === "fork") {
      setDrawerMode("closed");
      return;
    }
    setForkTitle(tpl.isBuiltIn ? `${tpl.title} (Comunidade)` : tpl.title);
    setForkDeadlinePlaceholder("");
    setForkFields(instantiateTemplateFields(tpl.fields, false));
    setDrawerMode("fork");
  };

  const toggleDiffSplit = () => {
    setDrawerMode((prev) => (prev === "diff" ? "closed" : "diff"));
  };

  const handleCreateCategorySubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newCatTitle.trim();
    if (trimmed.length < 5) {
      setNewCatError("O nome da categoria deve ter pelo menos 5 caracteres.");
      return;
    }
    if (
      categories.some(
        (c) => c.title.trim().toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setNewCatError("Já existe uma categoria de modelo com esse nome.");
      return;
    }
    setNewCatError(null);
    const createdId = await onCreateTemplateCategory({
      title: trimmed,
      body: newCatBody.trim(),
    });
    if (createdId) {
      setNewCatTitle("");
      setNewCatBody("");
      setShowNewCatModal(false);
      onSelectCategory(createdId);
    }
  };

  const diffCandidates = activeTemplate
    ? allTemplates
        .filter((t) => t.categoryId === activeTemplate.categoryId)
        .map(toDiffableProposal)
    : [];

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
          <div className="channel-title-wrap">
            <MaterialIcon name="edit_note" />
            <h1 className="channel-title">
              Modelos de Proposta · {communityTitle}
            </h1>
          </div>
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--outlined btn--sm"
            disabled={busy}
            onClick={() => setShowNewCatModal(true)}
          >
            <MaterialIcon name="category" />
            <span>Nova categoria</span>
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={busy || !activeCategoryId}
            onClick={openNewTemplateDrawer}
          >
            <MaterialIcon name="add" />
            <span>Novo modelo</span>
          </button>
        </div>
      </header>

      <div className="subview-scroll">
        <div className="subview-container stack">
          <section className="card">
            <div className="card__header">
              <div>
                <h2 className="md-title-medium">
                  Categorias de Modelos ({categories.length})
                </h2>
                <p className="md-body-small" style={{ marginTop: 4 }}>
                  Categorias separadas dos assuntos da comunidade. Cada membro ativo pode apoiar (Pick) 1 modelo preferido por categoria.
                </p>
              </div>
            </div>

            <div className="btn-row" style={{ flexWrap: "wrap", gap: 8 }}>
              {categories.map((cat) => {
                const isSelected = cat.docIdHex === activeCategoryId;
                return (
                  <button
                    key={cat.docIdHex}
                    type="button"
                    className={
                      isSelected
                        ? "btn btn--primary btn--sm"
                        : "btn btn--outlined btn--sm"
                    }
                    onClick={() => {
                      onSelectTemplate(null);
                      setDrawerMode("closed");
                      onSelectCategory(cat.docIdHex);
                    }}
                  >
                    <span>{cat.title}</span>
                    <span className="chip gov-tabular">{cat.templateCount}</span>
                  </button>
                );
              })}
            </div>

            {activeCategory && (
              <p className="md-body-medium" style={{ marginTop: 12 }}>
                {activeCategory.body || "Sem descrição."}{" "}
                {activeCategory.isBuiltIn && (
                  <span className="chip" style={{ marginLeft: 6 }}>
                    Categoria inicial
                  </span>
                )}
              </p>
            )}
          </section>

          {categoryTemplates.length === 0 ? (
            <div className="empty-state">
              <MaterialIcon name="edit_note" />
              <h2 className="md-title-medium">
                Nenhum modelo nesta categoria ainda
              </h2>
              <p className="md-body-medium">
                Crie um formulário padrão com campos e exemplos para ajudar a comunidade a estruturar propostas nesta categoria.
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={openNewTemplateDrawer}
              >
                <MaterialIcon name="add" />
                <span>Criar primeiro modelo</span>
              </button>
            </div>
          ) : (
            <div className="entity-list" role="list">
              {categoryTemplates.map((tpl) => {
                const isMyPick = tpl.supporterPubs.includes(myPubHex);
                const isSelected = tpl.docIdHex === activeTemplate?.docIdHex;
                const rowClass = [
                  "proposal-list-row",
                  isMyPick ? "proposal-list-row--picked" : "",
                  isSelected ? "proposal-list-row--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <article
                    key={tpl.docIdHex}
                    className={rowClass}
                    role="listitem"
                  >
                    <div
                      className="proposal-list-row__main"
                      onClick={() => {
                        setDrawerMode("closed");
                        onSelectTemplate(tpl.docIdHex);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="btn-row" style={{ flexWrap: "wrap", gap: 6 }}>
                        <strong className="md-title-medium">{tpl.title}</strong>
                        {tpl.isTopInCategory && (
                          <span className="chip chip--memb">
                            Preferido da categoria
                          </span>
                        )}
                        {tpl.isBuiltIn ? (
                          <span className="chip">Inicial</span>
                        ) : (
                          <span className="chip chip--stze">Comunidade</span>
                        )}
                        {tpl.parentHashHex && (
                          <span className="chip">Fork</span>
                        )}
                      </div>

                      {tpl.body && (
                        <p className="md-body-medium" style={{ marginTop: 4 }}>
                          {tpl.body}
                        </p>
                      )}

                      <p className="md-label-medium" style={{ marginTop: 6 }}>
                        {tpl.authorName || "Membro"} · {tpl.fields.length} campo(s)
                        {!tpl.isBuiltIn && ` · ${formatDateMs(tpl.timestampMs)}`}
                      </p>
                    </div>

                    <div className="btn-row">
                      {isMyPick ? (
                        <button
                          type="button"
                          className="vote-pill vote-pill--active"
                          disabled
                        >
                          <MaterialIcon name="check_circle" filled />
                          <span className="gov-tabular">
                            Apoiado · {tpl.pickCount}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="vote-pill"
                          disabled={busy}
                          onClick={() =>
                            void onPickTemplate(tpl.categoryId, tpl.docIdHex)
                          }
                          title="Eleger este modelo como o melhor desta categoria"
                        >
                          <MaterialIcon name="how_to_vote" />
                          <span className="gov-tabular">
                            Apoiar · {tpl.pickCount}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn--tonal btn--sm"
                        onClick={() => {
                          setDrawerMode("closed");
                          onSelectTemplate(tpl.docIdHex);
                        }}
                      >
                        <MaterialIcon name="visibility" />
                        <span>Abrir</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isOverlayOpen && (
        <div
          className="detail-drawer-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeOverlay();
            }
          }}
        >
          <aside
            className="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={
              activeTemplate
                ? activeTemplate.title
                : `Novo modelo em ${activeCategory?.title ?? "Categoria"}`
            }
          >
            {drawerMode === "new-template" && !activeTemplate ? (
              <>
                <header className="detail-drawer__header">
                  <div className="detail-drawer__context">
                    <MaterialIcon name="edit_note" />
                    <span className="detail-drawer__subject">
                      Novo modelo em {activeCategory?.title ?? "Categoria"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={closeOverlay}
                    aria-label="Fechar"
                  >
                    <MaterialIcon name="close" />
                  </button>
                </header>

                <div className="detail-drawer__body">
                  <div className="detail-drawer__reading">
                    <p className="md-body-small" style={{ marginBottom: 12 }}>
                      Preencha os campos com exemplos ou instruções (ex.: “Ex.: Descreva o orçamento...”) para orientar quem criar propostas usando este modelo.
                    </p>
                    <ProposalDocumentComposer
                      modeLabel="Novo Modelo"
                      submitLabel="publicar modelo"
                      submitIcon="send"
                      deliberationMode="OPEN"
                      quorumPct={null}
                      subjectScope={activeCategoryId}
                      parentHashHex={null}
                      draftId={`tpl:${activeCategoryId}`}
                      existingDrafts={[]}
                      title={tplTitle}
                      deadlineInput={tplDeadlinePlaceholder}
                      fields={tplFields}
                      busy={busy}
                      hideLocalDraftActions
                      hideDeadlineInput
                      titleLabel="Nome do modelo (mín. 5 caracteres)"
                      titlePlaceholder="Ex.: Reforma ou Manutenção Predial"
                      onChangeTitle={setTplTitle}
                      onChangeDeadlineInput={setTplDeadlinePlaceholder}
                      onChangeFields={setTplFields}
                      onSaveDraft={async () => {}}
                      onDeleteDraft={async () => {}}
                      onLoadDraft={() => {}}
                      onSubmitPublish={async (payload) => {
                        const createdId = await onCreateProposalTemplate({
                          categoryId: activeCategoryId,
                          title: payload.title,
                          body: payload.body,
                          fields: payload.fields,
                        });
                        if (createdId) {
                          setDrawerMode("closed");
                          onSelectTemplate(createdId);
                          return true;
                        }
                        return false;
                      }}
                      onCancel={closeOverlay}
                    />
                  </div>
                </div>
              </>
            ) : (
              activeTemplate && (
                <>
                  <header className="detail-drawer__header">
                    <div className="detail-drawer__context">
                      <span className="detail-drawer__subject">
                        {activeCategory?.title ?? "Modelo"}
                      </span>
                    </div>

                    <div className="detail-drawer__header-actions">
                      {activeTemplate.supporterPubs.includes(myPubHex) ? (
                        <button
                          type="button"
                          className="vote-pill vote-pill--active"
                          disabled
                        >
                          <MaterialIcon name="check_circle" filled />
                          <span className="gov-tabular">
                            Apoiado · {activeTemplate.pickCount}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="vote-pill"
                          disabled={busy}
                          onClick={() =>
                            void onPickTemplate(
                              activeTemplate.categoryId,
                              activeTemplate.docIdHex
                            )
                          }
                        >
                          <MaterialIcon name="how_to_vote" />
                          <span className="gov-tabular">
                            Apoiar · {activeTemplate.pickCount}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={subjects.length === 0}
                        onClick={() => setShowUseModal(true)}
                        title={
                          subjects.length === 0
                            ? "Crie um assunto primeiro para usar o modelo"
                            : "Abrir criador de proposta com este modelo"
                        }
                      >
                        <MaterialIcon name="description" />
                        <span>Usar em proposta</span>
                      </button>

                      <button
                        type="button"
                        className={
                          drawerMode === "fork"
                            ? "btn btn--primary btn--sm"
                            : "btn btn--outlined btn--sm"
                        }
                        disabled={busy}
                        onClick={() => toggleForkSplit(activeTemplate)}
                      >
                        <MaterialIcon name="fork_right" />
                        <span>
                          {drawerMode === "fork"
                            ? "Fechar Melhoria"
                            : activeTemplate.isBuiltIn
                              ? "Personalizar"
                              : "Melhorar (Fork)"}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={
                          drawerMode === "diff"
                            ? "btn btn--primary btn--sm"
                            : "btn btn--outlined btn--sm"
                        }
                        onClick={toggleDiffSplit}
                      >
                        <MaterialIcon name="compare_arrows" />
                        <span>
                          {drawerMode === "diff" ? "Fechar Diff" : "Comparar"}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="icon-btn"
                        onClick={closeOverlay}
                        aria-label="Fechar detalhes do modelo"
                      >
                        <MaterialIcon name="close" />
                      </button>
                    </div>
                  </header>

                  <div className="detail-drawer__body">
                    <div
                      className={
                        drawerMode === "fork" || drawerMode === "diff"
                          ? "detail-drawer__split"
                          : "detail-drawer__reading"
                      }
                    >
                      <div className="detail-drawer__pane">
                        <div className="btn-row" style={{ marginBottom: 10 }}>
                          {activeTemplate.isTopInCategory && (
                            <span className="chip chip--memb">
                              Preferido nesta categoria
                            </span>
                          )}
                          {activeTemplate.isBuiltIn ? (
                            <span className="chip">Modelo inicial do app</span>
                          ) : (
                            <span className="chip chip--stze">
                              Modelo da comunidade
                            </span>
                          )}
                        </div>

                        {activeTemplate.parentHashHex && (
                          <button
                            type="button"
                            className="proposal-detail__lineage"
                            onClick={() => {
                              setDrawerMode("closed");
                              onSelectTemplate(activeTemplate.parentHashHex);
                            }}
                          >
                            <MaterialIcon name="fork_right" />
                            <span>
                              Derivado de:{" "}
                              <strong>
                                {allTemplates.find(
                                  (t) =>
                                    t.docIdHex === activeTemplate.parentHashHex
                                )?.title ??
                                  shortHex(activeTemplate.parentHashHex)}
                              </strong>
                            </span>
                          </button>
                        )}

                        <h1 className="detail-drawer__title">
                          {activeTemplate.title}
                        </h1>

                        <div className="proposal-detail__meta">
                          <span
                            className="author-avatar author-avatar--sm"
                            aria-hidden="true"
                          >
                            {getInitials(
                              activeTemplate.authorName || "Membro",
                              "M"
                            )}
                          </span>
                          <div className="proposal-detail__author-line">
                            <strong>
                              {activeTemplate.authorName || "Membro"}
                            </strong>
                            {!activeTemplate.isBuiltIn && (
                              <span className="proposal-card__date">
                                · {formatDateMs(activeTemplate.timestampMs)} · ID{" "}
                                <span className="mono">
                                  {shortHex(activeTemplate.docIdHex)}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>

                        {activeTemplate.body && (
                          <p
                            className="md-body-medium"
                            style={{ marginBottom: 14 }}
                          >
                            {activeTemplate.body}
                          </p>
                        )}

                        <SupportersCollapsible
                          supporterPubs={activeTemplate.supporterPubs}
                          members={members}
                          myPubHex={myPubHex}
                        />

                        <ProposalFieldsRenderer fields={activeTemplate.fields} />
                      </div>

                      {drawerMode === "fork" && (
                        <div className="detail-drawer__pane detail-drawer__pane--editor">
                          <div className="composer-card__header">
                            <div className="btn-row">
                              <MaterialIcon name="fork_right" />
                              <h2 className="md-title-medium">
                                {activeTemplate.isBuiltIn
                                  ? "Personalizar para a Comunidade"
                                  : "Melhorar Modelo (Fork)"}
                              </h2>
                            </div>
                          </div>

                          <ProposalDocumentComposer
                            modeLabel={
                              activeTemplate.isBuiltIn
                                ? "Modelo Comunitário"
                                : "Fork de Modelo"
                            }
                            submitLabel="publicar modelo"
                            submitIcon="fork_right"
                            deliberationMode="OPEN"
                            quorumPct={null}
                            subjectScope={activeCategoryId}
                            parentHashHex={
                              activeTemplate.isBuiltIn
                                ? null
                                : activeTemplate.docIdHex
                            }
                            draftId={`tpl-fork:${activeTemplate.docIdHex}`}
                            existingDrafts={[]}
                            title={forkTitle}
                            deadlineInput={forkDeadlinePlaceholder}
                            fields={forkFields}
                            busy={busy}
                            hideLocalDraftActions
                            hideDeadlineInput
                            titleLabel="Nome do modelo (mín. 5 caracteres)"
                            titlePlaceholder="Ex.: Modelo de Obra com Garantia"
                            onChangeTitle={setForkTitle}
                            onChangeDeadlineInput={setForkDeadlinePlaceholder}
                            onChangeFields={setForkFields}
                            onSaveDraft={async () => {}}
                            onDeleteDraft={async () => {}}
                            onLoadDraft={() => {}}
                            onSubmitPublish={async (payload) => {
                              const createdId = await onCreateProposalTemplate({
                                categoryId: activeTemplate.categoryId,
                                title: payload.title,
                                body: payload.body,
                                ...(!activeTemplate.isBuiltIn
                                  ? { parentHashHex: activeTemplate.docIdHex }
                                  : {}),
                                fields: payload.fields,
                              });
                              if (createdId) {
                                setDrawerMode("closed");
                                onSelectTemplate(createdId);
                                return true;
                              }
                              return false;
                            }}
                            onCancel={() => setDrawerMode("closed")}
                          />
                        </div>
                      )}

                      {drawerMode === "diff" && (
                        <div className="detail-drawer__pane detail-drawer__pane--editor">
                          <div className="composer-card__header">
                            <div className="btn-row">
                              <MaterialIcon name="compare_arrows" />
                              <h2 className="md-title-medium">
                                Comparar Modelos (Diff)
                              </h2>
                            </div>
                          </div>

                          <ProposalDiffPanel
                            targetProposal={toDiffableProposal(activeTemplate)}
                            candidates={diffCandidates}
                            defaultBaseId={activeTemplate.parentHashHex}
                            itemNoun="modelo"
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

      {showNewCatModal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-tpl-cat-heading"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewCatModal(false);
            }
          }}
        >
          <form
            className="modal-card"
            onSubmit={(e) => void handleCreateCategorySubmit(e)}
          >
            <div className="composer-card__header">
              <h2 id="new-tpl-cat-heading" className="md-title-large">
                Nova Categoria de Modelo
              </h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowNewCatModal(false)}
                aria-label="Fechar modal"
              >
                <MaterialIcon name="close" />
              </button>
            </div>
            {newCatError && (
              <p
                className="md-body-small"
                style={{ color: "var(--md-sys-color-error)" }}
              >
                {newCatError}
              </p>
            )}
            <div className="field">
              <label htmlFor="new-tpl-cat-title">
                Nome da categoria (mín. 5 caracteres)
              </label>
              <input
                id="new-tpl-cat-title"
                className="input"
                minLength={5}
                required
                autoFocus
                value={newCatTitle}
                onChange={(e) => {
                  setNewCatTitle(e.target.value);
                  if (newCatError) setNewCatError(null);
                }}
                placeholder="Ex.: Prestação de Contas"
              />
            </div>
            <div className="field">
              <label htmlFor="new-tpl-cat-body">Descrição (opcional)</label>
              <input
                id="new-tpl-cat-body"
                className="input"
                value={newCatBody}
                onChange={(e) => setNewCatBody(e.target.value)}
                placeholder="Ex.: Relatórios mensais, notas fiscais e auditoria"
              />
            </div>
            <div className="btn-row">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={busy}
              >
                <MaterialIcon name="send" />
                <span>Publicar categoria</span>
              </button>
              <button
                type="button"
                className="btn btn--outlined"
                onClick={() => setShowNewCatModal(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {showUseModal && activeTemplate && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="use-tpl-heading"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowUseModal(false);
            }
          }}
        >
          <div className="modal-card">
            <div className="composer-card__header">
              <h2 id="use-tpl-heading" className="md-title-large">
                Usar Modelo em Assunto
              </h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowUseModal(false)}
                aria-label="Fechar modal"
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <p className="md-body-medium" style={{ marginBottom: 12 }}>
              Escolha em qual assunto abrir uma nova proposta pré-preenchida com{" "}
              <strong>{activeTemplate.title}</strong>:
            </p>

            <div className="field">
              <label htmlFor="use-tpl-subject">Assunto de destino</label>
              <select
                id="use-tpl-subject"
                className="select"
                value={targetSubjectScope}
                onChange={(e) => setTargetSubjectScope(e.target.value)}
              >
                {(openSubjects.length > 0 ? openSubjects : subjects).map(
                  (subj) => (
                    <option key={subj.scope} value={subj.scope}>
                      {subj.title}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="btn-row">
              <button
                type="button"
                className="btn btn--primary"
                disabled={!targetSubjectScope}
                onClick={() => {
                  setShowUseModal(false);
                  onUseTemplateInSubject(activeTemplate, targetSubjectScope);
                }}
              >
                <MaterialIcon name="description" />
                <span>Abrir criador de proposta</span>
              </button>
              <button
                type="button"
                className="btn btn--outlined"
                onClick={() => setShowUseModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
