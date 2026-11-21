import type {
  MemberView,
  ProposalFieldView,
  SharedDraftView,
  SubjectSummaryView,
  SubjectWorkshopView,
} from "@sintetizing/domain";
import type { StoredChatFileRecord } from "@sintetizing/storage";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PublishSharedDraftInput, SendChatMessageInput } from "../hooks/useExplorer.js";
import { formatDateMs, getInitials, shortHex } from "../utils/format.js";
import { MaterialIcon } from "./MaterialIcon.js";
import {
  createDefaultField,
  ProposalDocumentComposer,
  ProposalFieldsRenderer,
  unixSecondsToLocalInput,
} from "./ProposalDocumentFields.js";

export interface SubjectWorkshopPanelProps {
  readonly myPubHex: string;
  readonly subject: SubjectSummaryView;
  readonly members: readonly MemberView[];
  readonly workshop: SubjectWorkshopView | null;
  readonly chatFileRecord: StoredChatFileRecord | null;
  readonly busy: boolean;
  readonly onSendChatMessage: (input: SendChatMessageInput) => Promise<string | null>;
  readonly onPublishSharedDraft: (input: PublishSharedDraftInput) => Promise<string | null>;
  readonly onDeleteSharedDraft: (subjectScope: string, draftId: string) => Promise<void>;
  readonly onPromoteSharedDraft: (params: {
    readonly draft: SharedDraftView;
  }) => Promise<string | null>;
  readonly onOpenProposal: (proposalDocIdHex: string) => void;
}

function makeSharedDraftId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `draft-${suffix}`;
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function SubjectWorkshopPanel({
  myPubHex,
  subject,
  members,
  workshop,
  chatFileRecord,
  busy,
  onSendChatMessage,
  onPublishSharedDraft,
  onDeleteSharedDraft,
  onPromoteSharedDraft,
  onOpenProposal,
}: SubjectWorkshopPanelProps) {
  const [messageInput, setMessageInput] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDeadlineInput, setDraftDeadlineInput] = useState("");
  const [draftFields, setDraftFields] = useState<readonly ProposalFieldView[]>(() => [
    createDefaultField("TEXT"),
  ]);
  const [confirmPromoteDraftId, setConfirmPromoteDraftId] = useState<string | null>(null);
  const [expandedDraftIds, setExpandedDraftIds] = useState<Readonly<Record<string, boolean>>>({});

  useEffect(() => {
    setMessageInput("");
    setComposerOpen(false);
    setEditingDraftId(null);
    setConfirmPromoteDraftId(null);
    setExpandedDraftIds({});
  }, [subject.scope]);

  const memberNameByPub = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members) {
      if (member.displayName) {
        map.set(member.pubHex, member.displayName);
      }
    }
    return map;
  }, [members]);

  const messages = workshop?.messages ?? [];
  const activeDrafts = workshop?.activeDrafts ?? [];

  const openNewDraft = () => {
    setEditingDraftId(null);
    setDraftTitle("");
    setDraftDeadlineInput(unixSecondsToLocalInput(subject.deadlineUnixSeconds));
    setDraftFields([createDefaultField("TEXT")]);
    setComposerOpen(true);
  };

  const openEditMyDraft = (draft: SharedDraftView) => {
    setEditingDraftId(draft.draftId);
    setDraftTitle(draft.title);
    setDraftDeadlineInput(unixSecondsToLocalInput(draft.deadlineUnixSeconds));
    setDraftFields(
      draft.fields.length > 0
        ? draft.fields.map((f) =>
            f.kind === "TABLE"
              ? { ...f, columns: [...f.columns], rows: f.rows.map((r) => [...r]) }
              : { ...f }
          )
        : [createDefaultField("TEXT")]
    );
    setComposerOpen(true);
  };

  const openCopyToMyDraft = (draft: SharedDraftView) => {
    setEditingDraftId(null);
    setDraftTitle(`${draft.title} (cópia)`);
    setDraftDeadlineInput(unixSecondsToLocalInput(draft.deadlineUnixSeconds));
    setDraftFields(
      draft.fields.length > 0
        ? draft.fields.map((f) =>
            f.kind === "TABLE"
              ? { ...f, columns: [...f.columns], rows: f.rows.map((r) => [...r]) }
              : { ...f }
          )
        : [createDefaultField("TEXT")]
    );
    setComposerOpen(true);
  };

  const handleSendSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed || busy) {
      return;
    }
    const sentId = await onSendChatMessage({
      subjectScope: subject.scope,
      body: trimmed,
    });
    if (sentId) {
      setMessageInput("");
    }
  };

  const toggleExpandDraft = (draftKey: string) => {
    setExpandedDraftIds((prev) => ({
      ...prev,
      [draftKey]: !prev[draftKey],
    }));
  };

  return (
    <div className="workshop-shell">
      <div className="workshop-summary-banner">
        <div className="workshop-summary-banner__text">
          <MaterialIcon name="chat" />
          <div>
            <strong>Oficina do Assunto (.chat aberto e auditável)</strong>
            <p className="md-body-small">
              Debatam aqui e lapidem rascunhos em grupo. Quando uma ideia estiver madura, subam para Propostas Oficiais (.stze).
            </p>
          </div>
        </div>
        <div className="btn-row gov-tabular">
          <span className="chip">{messages.length} msg(s)</span>
          <span className="chip">{activeDrafts.length} rascunho(s)</span>
          {chatFileRecord && (
            <span className="chip chip--cmnt">
              .chat {formatByteSize(chatFileRecord.rawChatBytes.length)}
            </span>
          )}
        </div>
      </div>

      <div className="workshop-grid">
        {/* Coluna 1: Conversa do Assunto (.chat) */}
        <section className="workshop-pane">
          <header className="workshop-pane__header">
            <div className="btn-row">
              <MaterialIcon name="forum" />
              <h2 className="md-title-medium">Conversa do Assunto</h2>
            </div>
            <span className="md-label-medium gov-tabular">{messages.length}</span>
          </header>

          <div className="workshop-chat-list" role="log" aria-label="Mensagens da oficina">
            {messages.length === 0 ? (
              <div className="empty-box">
                <p className="md-body-medium">
                  Nenhuma mensagem ainda. Inicie a conversa para alinhar dúvidas ou montar um rascunho em grupo.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.authorPubHex === myPubHex;
                const displayName =
                  msg.authorName ??
                  memberNameByPub.get(msg.authorPubHex) ??
                  shortHex(msg.authorPubHex);

                return (
                  <article
                    key={msg.docIdHex}
                    className={
                      isMine
                        ? "workshop-chat-msg workshop-chat-msg--mine"
                        : "workshop-chat-msg"
                    }
                  >
                    <span className="author-avatar author-avatar--sm" aria-hidden="true">
                      {getInitials(displayName, "M")}
                    </span>
                    <div className="workshop-chat-msg__content">
                      <div className="workshop-chat-msg__meta">
                        <strong>{isMine ? `${displayName} (Você)` : displayName}</strong>
                        <span className="md-label-medium gov-tabular">
                          {formatDateMs(msg.timestampMs)}
                        </span>
                      </div>
                      <p className="workshop-chat-msg__body">{msg.body}</p>
                      {msg.referencedProposalDocIdHex && (
                        <div className="workshop-chat-msg__ref">
                          <button
                            type="button"
                            className="btn btn--tonal btn--sm"
                            onClick={() => onOpenProposal(msg.referencedProposalDocIdHex!)}
                          >
                            <MaterialIcon name="published_with_changes" />
                            <span>Abrir Proposta Oficial (.stze)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <form className="workshop-chat-form" onSubmit={(e) => void handleSendSubmit(e)}>
            <textarea
              className="textarea workshop-chat-form__input"
              placeholder="Escreva sua dúvida, sugestão ou ajuste para os rascunhos..."
              value={messageInput}
              maxLength={4000}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={busy || !messageInput.trim()}
            >
              <MaterialIcon name="send" />
              <span>Enviar</span>
            </button>
          </form>
        </section>

        {/* Coluna 2: Rascunhos em Lapidação (.chat) */}
        <section className="workshop-pane">
          <header className="workshop-pane__header">
            <div className="btn-row">
              <MaterialIcon name="edit_note" />
              <h2 className="md-title-medium">Rascunhos em Lapidação</h2>
            </div>
            {!composerOpen && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={busy}
                onClick={openNewDraft}
              >
                <MaterialIcon name="add" />
                <span>Novo meu rascunho</span>
              </button>
            )}
          </header>

          {composerOpen && (
            <div className="composer-card" style={{ marginBottom: 12 }}>
              <div className="composer-card__header">
                <div>
                  <h3 className="md-title-medium">
                    {editingDraftId ? "Editar meu rascunho" : "Novo rascunho na Oficina"}
                  </h3>
                  <p className="md-body-small">
                    Ao salvar, este rascunho substitui sua versão anterior no .chat e pode ser descartado depois.
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    setComposerOpen(false);
                    setEditingDraftId(null);
                  }}
                  aria-label="Fechar editor de rascunho"
                >
                  <MaterialIcon name="close" />
                </button>
              </div>

              <ProposalDocumentComposer
                modeLabel="Rascunho (.chat)"
                submitLabel={editingDraftId ? "atualizar rascunho" : "publicar rascunho"}
                submitIcon="save"
                deliberationMode={subject.deliberationMode}
                quorumPct={subject.quorumPct}
                subjectScope={subject.scope}
                parentHashHex={null}
                draftId={editingDraftId ?? "shared-draft"}
                existingDrafts={[]}
                title={draftTitle}
                deadlineInput={draftDeadlineInput}
                fields={draftFields}
                busy={busy}
                skipConfirm={true}
                hideLocalDraftActions={true}
                onChangeTitle={setDraftTitle}
                onChangeDeadlineInput={setDraftDeadlineInput}
                onChangeFields={setDraftFields}
                onSaveDraft={async () => {}}
                onDeleteDraft={async () => {}}
                onLoadDraft={() => {}}
                onSubmitPublish={async (payload) => {
                  const targetDraftId = editingDraftId ?? makeSharedDraftId();
                  const savedId = await onPublishSharedDraft({
                    subjectScope: subject.scope,
                    draftId: targetDraftId,
                    title: payload.title,
                    body: payload.body,
                    deadlineUnixSeconds: payload.deadlineUnixSeconds ?? null,
                    fields: payload.fields,
                  });
                  if (savedId) {
                    setComposerOpen(false);
                    setEditingDraftId(null);
                    return true;
                  }
                  return false;
                }}
                onCancel={() => {
                  setComposerOpen(false);
                  setEditingDraftId(null);
                }}
              />
            </div>
          )}

          {activeDrafts.length === 0 ? (
            <div className="empty-box">
              <p className="md-body-medium">
                Nenhum rascunho em construção. Clique em “Novo meu rascunho” para começar um esboço compartilhado no chat.
              </p>
            </div>
          ) : (
            <div className="workshop-drafts-list">
              {activeDrafts.map((draft) => {
                const draftKey = `${draft.authorPubHex}:${draft.draftId}`;
                const isMine = draft.authorPubHex === myPubHex;
                const authorName =
                  draft.authorName ??
                  memberNameByPub.get(draft.authorPubHex) ??
                  shortHex(draft.authorPubHex);
                const isExpanded = Boolean(expandedDraftIds[draftKey]);
                const isConfirmingPromote = confirmPromoteDraftId === draftKey;

                return (
                  <article key={draftKey} className="workshop-draft-card">
                    <div className="workshop-draft-card__head">
                      <div className="workshop-draft-card__title-wrap">
                        <strong className="md-title-medium">{draft.title}</strong>
                        <span className="md-label-medium gov-tabular">
                          {isMine ? "Meu rascunho" : `Rascunho de ${authorName}`} · v{draft.seq} ·{" "}
                          {formatDateMs(draft.timestampMs)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn--outlined btn--sm"
                        onClick={() => toggleExpandDraft(draftKey)}
                      >
                        <MaterialIcon name={isExpanded ? "expand_less" : "expand_more"} />
                        <span>{isExpanded ? "Recolher" : `Ver campos (${draft.fields.length})`}</span>
                      </button>
                    </div>

                    {draft.body && (
                      <p className="md-body-medium workshop-draft-card__preview">
                        {draft.body}
                      </p>
                    )}

                    {draft.convertedToProposalDocIdHex && (
                      <div className="workshop-conversion-banner">
                        <div className="workshop-conversion-banner__info">
                          <MaterialIcon name="published_with_changes" />
                          <span>
                            Já convertido em Proposta Oficial por{" "}
                            <strong>{draft.convertedByName ?? "Membro"}</strong>
                            {draft.convertedToProposalTitle
                              ? ` (“${draft.convertedToProposalTitle}”)`
                              : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn--tonal btn--sm"
                          onClick={() => onOpenProposal(draft.convertedToProposalDocIdHex!)}
                        >
                          <MaterialIcon name="open_in_new" />
                          <span>Ver proposta</span>
                        </button>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="workshop-draft-card__fields">
                        <ProposalFieldsRenderer fields={draft.fields} />
                      </div>
                    )}

                    {isConfirmingPromote ? (
                      <div className="confirm-publish-box">
                        <p className="md-body-small">
                          {isMine
                            ? "Publicar este rascunho como Proposta Oficial (.stze) e removê-lo da Oficina?"
                            : "Publicar este rascunho em seu nome como Proposta Oficial (.stze)? O rascunho original receberá o aviso de que já foi convertido."}
                        </p>
                        <div className="btn-row">
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            disabled={busy}
                            onClick={() => {
                              void (async () => {
                                const createdId = await onPromoteSharedDraft({ draft });
                                setConfirmPromoteDraftId(null);
                                if (createdId) {
                                  onOpenProposal(createdId);
                                }
                              })();
                            }}
                          >
                            <MaterialIcon name="send" />
                            <span>Confirmar publicação (.stze)</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn--outlined btn--sm"
                            disabled={busy}
                            onClick={() => setConfirmPromoteDraftId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="btn-row" style={{ flexWrap: "wrap" }}>
                        {isMine ? (
                          <>
                            <button
                              type="button"
                              className="btn btn--tonal btn--sm"
                              disabled={busy}
                              onClick={() => openEditMyDraft(draft)}
                            >
                              <MaterialIcon name="edit" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              disabled={busy}
                              onClick={() => setConfirmPromoteDraftId(draftKey)}
                            >
                              <MaterialIcon name="published_with_changes" />
                              <span>Subir proposta (.stze)</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn--danger btn--sm"
                              disabled={busy}
                              onClick={() => void onDeleteSharedDraft(draft.scope, draft.draftId)}
                            >
                              <MaterialIcon name="delete" />
                              <span>Eliminar</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn--tonal btn--sm"
                              disabled={busy}
                              onClick={() => openCopyToMyDraft(draft)}
                            >
                              <MaterialIcon name="content_copy" />
                              <span>Copiar para meu rascunho</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              disabled={busy}
                              onClick={() => setConfirmPromoteDraftId(draftKey)}
                            >
                              <MaterialIcon name="published_with_changes" />
                              <span>Subir para o assunto (.stze)</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
