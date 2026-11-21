import type { CommunityProjection } from "@sintetizing/domain";
import { DEFAULT_PUBLIC_NOSTR_RELAYS } from "@sintetizing/network";
import type { CommunityRecord } from "@sintetizing/storage";
import { InvitePolicy, InvitePolicyValue } from "@sintetizing/wire";
import { FormEvent, useEffect, useState } from "react";
import type {
  CreateCommunityInput,
  ProposeConfigVersionInput,
} from "../hooks/useExplorer.js";
import { getInitialDefaultRelays } from "../hooks/useExplorer.js";
import type { SeedScale } from "../utils/seed-generator.js";
import { formatDateMs, getInitials } from "../utils/format.js";
import { MaterialIcon } from "./MaterialIcon.js";

export type CommunitiesTab = "overview" | "members" | "relays" | "add";

export interface CommunitiesViewProps {
  readonly myPubHex: string;
  readonly selectedCommunity: CommunityRecord | null;
  readonly projection: CommunityProjection | null;
  readonly generatedInviteCode: string | null;
  readonly activeTab: CommunitiesTab;
  readonly busy: boolean;
  readonly seedProgress: string | null;
  readonly onChangeTab: (tab: CommunitiesTab) => void;
  readonly onGoToWorkspace: () => void;
  readonly onCreateCommunity: (input: CreateCommunityInput) => Promise<void>;
  readonly onJoinWithInvite: (inviteCode: string) => Promise<void>;
  readonly onUpdateRelays: (relays: readonly string[]) => Promise<void>;
  readonly onProposeConfigVersion: (input: ProposeConfigVersionInput) => Promise<void>;
  readonly onSupportConfigVersion: (targetDocIdHex: string) => Promise<void>;
  readonly onGenerateInvite: () => Promise<void>;
  readonly onLeaveCommunity: () => Promise<void>;
  readonly onSeedDataset: (scale: SeedScale) => Promise<void>;
}

export function CommunitiesView({
  myPubHex,
  selectedCommunity,
  projection,
  generatedInviteCode,
  activeTab,
  busy,
  seedProgress,
  onChangeTab,
  onGoToWorkspace,
  onCreateCommunity,
  onJoinWithInvite,
  onUpdateRelays,
  onProposeConfigVersion,
  onSupportConfigVersion,
  onGenerateInvite,
  onLeaveCommunity,
  onSeedDataset,
}: CommunitiesViewProps) {
  const [addMode, setAddMode] = useState<"create" | "join">("create");
  const [showProposeV2Form, setShowProposeV2Form] = useState(false);

  const [newCommTitle, setNewCommTitle] = useState("");
  const [newCommBody, setNewCommBody] = useState("");
  const [newCommQuorum, setNewCommQuorum] = useState(51);
  const [newCommInactivity, setNewCommInactivity] = useState(30);
  const [newCommPolicy, setNewCommPolicy] = useState<InvitePolicyValue>(
    InvitePolicy.ANY_ACTIVE_MEMBER
  );

  const [inviteInput, setInviteInput] = useState("");
  const [relaysDraft, setRelaysDraft] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const [v2Title, setV2Title] = useState("");
  const [v2Body, setV2Body] = useState("");
  const [v2Quorum, setV2Quorum] = useState(51);
  const [v2Inactivity, setV2Inactivity] = useState(30);
  const [v2Policy, setV2Policy] = useState<InvitePolicyValue>(
    InvitePolicy.ANY_ACTIVE_MEMBER
  );

  useEffect(() => {
    setRelaysDraft(selectedCommunity ? selectedCommunity.relays.join("\n") : "");
    setShowProposeV2Form(false);
    setMemberSearchQuery("");
  }, [selectedCommunity]);

  useEffect(() => {
    const active = projection?.activeConfig;
    if (active) {
      setV2Title(active.title);
      setV2Body(active.body);
      setV2Quorum(active.quorumPct);
      setV2Inactivity(active.inactivityDays);
      setV2Policy(active.invitePolicy);
    }
  }, [projection?.activeConfig?.docIdHex]);

  const activeMembersCount = projection?.activeMemberCount ?? 0;

  const handleCreateCommunity = async (e: FormEvent) => {
    e.preventDefault();
    if (newCommTitle.trim().length < 5) {
      return;
    }
    await onCreateCommunity({
      title: newCommTitle,
      body: newCommBody,
      quorumPct: newCommQuorum,
      inactivityDays: newCommInactivity,
      invitePolicy: newCommPolicy,
      relays: getInitialDefaultRelays(),
    });
    setNewCommTitle("");
    setNewCommBody("");
  };

  const handleJoinInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) {
      return;
    }
    await onJoinWithInvite(inviteInput);
    setInviteInput("");
  };

  const handleSaveRelays = async (e: FormEvent) => {
    e.preventDefault();
    const list = relaysDraft
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    await onUpdateRelays(list);
  };

  const appendRelayPreset = (url: string) => {
    const existing = relaysDraft
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!existing.includes(url)) {
      setRelaysDraft([...existing, url].join("\n"));
    }
  };

  const copyText = (value: string) => {
    void navigator.clipboard?.writeText(value);
  };

  // Modo Adicionar Comunidade (estilo modal/tela "Add a Server" do Discord)
  if (activeTab === "add" || !selectedCommunity) {
    return (
      <div className="add-server-wrap">
        <section className="card add-server-card">
          <div className="card__header">
            <div>
              <h2 className="md-title-large">Adicionar Comunidade</h2>
              <p className="md-body-medium">
                Crie um espaço coletivo novo ou participe usando um convite assinado.
              </p>
            </div>
            {selectedCommunity && (
              <button
                type="button"
                className="btn btn--sm btn--outlined"
                onClick={() => onChangeTab("overview")}
              >
                <MaterialIcon name="arrow_back" />
                <span>Voltar</span>
              </button>
            )}
          </div>

          <div className="segmented-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={addMode === "create"}
              className={
                addMode === "create"
                  ? "segmented-tab segmented-tab--active"
                  : "segmented-tab"
              }
              onClick={() => setAddMode("create")}
            >
              <MaterialIcon name="add" />
              <span>Criar comunidade</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={addMode === "join"}
              className={
                addMode === "join"
                  ? "segmented-tab segmented-tab--active"
                  : "segmented-tab"
              }
              onClick={() => setAddMode("join")}
            >
              <MaterialIcon name="person_add" />
              <span>Entrar com convite</span>
            </button>
          </div>

          {addMode === "create" ? (
            <form onSubmit={(e) => void handleCreateCommunity(e)}>
              <div className="field">
                <label htmlFor="comm-title">
                  Nome da comunidade (mín. 5 caracteres)
                </label>
                <input
                  id="comm-title"
                  className="input"
                  minLength={5}
                  required
                  value={newCommTitle}
                  onChange={(e) => setNewCommTitle(e.target.value)}
                  placeholder="Ex.: Bairro Centro"
                />
              </div>
              <div className="field">
                <label htmlFor="comm-body">Estatuto / Descrição</label>
                <textarea
                  id="comm-body"
                  className="textarea"
                  value={newCommBody}
                  onChange={(e) => setNewCommBody(e.target.value)}
                  placeholder="Regras iniciais e propósito"
                />
              </div>
              <div className="row-2">
                <div className="field">
                  <label htmlFor="comm-quorum">Quórum (%)</label>
                  <input
                    id="comm-quorum"
                    className="input"
                    type="number"
                    min={1}
                    max={100}
                    value={newCommQuorum}
                    onChange={(e) => setNewCommQuorum(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="comm-inactivity">Inatividade (dias)</label>
                  <input
                    id="comm-inactivity"
                    className="input"
                    type="number"
                    min={1}
                    max={3650}
                    value={newCommInactivity}
                    onChange={(e) => setNewCommInactivity(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="comm-policy">Quem pode convidar</label>
                <select
                  id="comm-policy"
                  className="select"
                  value={newCommPolicy}
                  onChange={(e) =>
                    setNewCommPolicy(Number(e.target.value) as InvitePolicyValue)
                  }
                >
                  <option value={InvitePolicy.ANY_ACTIVE_MEMBER}>
                    Qualquer membro ativo
                  </option>
                  <option value={InvitePolicy.FOUNDER_ONLY}>Somente fundador</option>
                </select>
              </div>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={busy}
              >
                <MaterialIcon name="send" />
                <span>Criar comunidade</span>
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void handleJoinInvite(e)}>
              <div className="field">
                <label htmlFor="invite-code">Código de convite</label>
                <textarea
                  id="invite-code"
                  className="textarea mono"
                  required
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  placeholder="Cole aqui o código de convite recebido"
                />
              </div>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={busy}
              >
                <MaterialIcon name="person_add" />
                <span>Entrar na comunidade</span>
              </button>
            </form>
          )}
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="btn-row">
                <MaterialIcon name="science" />
                <h2 className="md-title-medium">Ambiente de Teste (Seed Rápido)</h2>
              </div>
              <p className="md-body-medium" style={{ marginTop: 4 }}>
                Popule rapidamente 4 comunidades, 140 membros, 24 categorias, 96
                assuntos e ~320 propostas locais sem enviar spam para relays.
              </p>
            </div>
          </div>

          {seedProgress && (
            <p className="md-body-medium" style={{ marginBottom: 12 }}>
              {seedProgress}
            </p>
          )}

          <button
            type="button"
            className="btn btn--tonal"
            disabled={busy}
            onClick={() => void onSeedDataset("large")}
          >
            <MaterialIcon name="dataset" />
            <span>
              {busy && seedProgress
                ? "Gerando seed..."
                : "Gerar Seed de Grande Porte"}
            </span>
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      {/* Cabeçalho e Abas estilo Server Settings do Discord */}
      <div className="server-settings-header">
        <div className="discord-tabs" role="tablist" aria-label="Seções da comunidade">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            className={
              activeTab === "overview"
                ? "discord-tab discord-tab--active"
                : "discord-tab"
            }
            onClick={() => onChangeTab("overview")}
          >
            <MaterialIcon name="description" />
            <span>Regras e Estatuto</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "members"}
            className={
              activeTab === "members"
                ? "discord-tab discord-tab--active"
                : "discord-tab"
            }
            onClick={() => onChangeTab("members")}
          >
            <MaterialIcon name="groups" />
            <span>Membros ({projection?.members.length ?? 0})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "relays"}
            className={
              activeTab === "relays"
                ? "discord-tab discord-tab--active"
                : "discord-tab"
            }
            onClick={() => onChangeTab("relays")}
          >
            <MaterialIcon name="sync" />
            <span>Sincronização ({selectedCommunity.relays.length})</span>
          </button>
        </div>

        <button
          type="button"
          className="btn btn--sm btn--tonal"
          onClick={onGoToWorkspace}
        >
          <MaterialIcon name="category" />
          <span>Ir para categorias</span>
        </button>
      </div>

      {/* Aba 1: Regras e Estatuto */}
      {activeTab === "overview" && (
        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="md-title-large">
                {projection?.activeConfig?.title ?? selectedCommunity.title}
              </h2>
              {projection?.activeConfig && (
                <p className="md-body-medium">
                  Estatuto vigente · Versão v{projection.activeConfig.versionIndex}
                </p>
              )}
            </div>

            {projection?.activeConfig && (
              <button
                type="button"
                className="btn btn--sm btn--tonal"
                onClick={() => setShowProposeV2Form((prev) => !prev)}
              >
                <MaterialIcon name={showProposeV2Form ? "close" : "edit"} />
                <span>{showProposeV2Form ? "Cancelar" : "Propor alteração"}</span>
              </button>
            )}
          </div>

          {!projection?.activeConfig ? (
            <p className="md-body-medium">Sincronizando regras da comunidade...</p>
          ) : (
            <>
              <div className="kv-grid">
                <div className="kv-box">
                  <span className="md-label-medium">Quórum para mudar regras</span>
                  <strong className="md-title-medium gov-tabular">
                    {projection.activeConfig.quorumPct}% (
                    {projection.activeConfig.requiredSupports} de {activeMembersCount})
                  </strong>
                </div>
                <div className="kv-box">
                  <span className="md-label-medium">Prazo de inatividade</span>
                  <strong className="md-title-medium gov-tabular">
                    {projection.activeConfig.inactivityDays} dias
                  </strong>
                </div>
                <div className="kv-box">
                  <span className="md-label-medium">Política de convites</span>
                  <strong className="md-title-medium">
                    {projection.activeConfig.invitePolicy === InvitePolicy.FOUNDER_ONLY
                      ? "Somente fundador"
                      : "Qualquer membro ativo"}
                  </strong>
                </div>
              </div>

              <p className="detail-body">{projection.activeConfig.body}</p>

              {showProposeV2Form && (
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void (async () => {
                      await onProposeConfigVersion({
                        title: v2Title,
                        body: v2Body,
                        quorumPct: v2Quorum,
                        inactivityDays: v2Inactivity,
                        invitePolicy: v2Policy,
                      });
                      setShowProposeV2Form(false);
                    })();
                  }}
                >
                  <div className="field">
                    <label htmlFor="v2-title">Nome da comunidade</label>
                    <input
                      id="v2-title"
                      className="input"
                      minLength={5}
                      required
                      value={v2Title}
                      onChange={(e) => setV2Title(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="v2-body">Estatuto / Motivo da alteração</label>
                    <textarea
                      id="v2-body"
                      className="textarea"
                      value={v2Body}
                      onChange={(e) => setV2Body(e.target.value)}
                    />
                  </div>
                  <div className="row-2">
                    <div className="field">
                      <label htmlFor="v2-quorum">Novo quórum (%)</label>
                      <input
                        id="v2-quorum"
                        className="input"
                        type="number"
                        min={1}
                        max={100}
                        value={v2Quorum}
                        onChange={(e) => setV2Quorum(Number(e.target.value))}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="v2-inactivity">Nova inatividade (dias)</label>
                      <input
                        id="v2-inactivity"
                        className="input"
                        type="number"
                        min={1}
                        max={3650}
                        value={v2Inactivity}
                        onChange={(e) => setV2Inactivity(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="v2-policy">Política de convite</label>
                    <select
                      id="v2-policy"
                      className="select"
                      value={v2Policy}
                      onChange={(e) =>
                        setV2Policy(Number(e.target.value) as InvitePolicyValue)
                      }
                    >
                      <option value={InvitePolicy.ANY_ACTIVE_MEMBER}>
                        Qualquer membro ativo
                      </option>
                      <option value={InvitePolicy.FOUNDER_ONLY}>Somente fundador</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="btn btn--primary btn--sm"
                    disabled={busy}
                  >
                    <MaterialIcon name="send" />
                    <span>Publicar proposta de regra</span>
                  </button>
                </form>
              )}

              {projection.configVersions.filter((v) => v.status !== "ACTIVE").length >
                0 && (
                <div className="doc-list" style={{ marginTop: 18 }}>
                  <h3 className="md-title-medium">Versões propostas / anteriores</h3>
                  {projection.configVersions
                    .filter((v) => v.status !== "ACTIVE")
                    .map((ver) => {
                      const supportedByMe = ver.supporterPubs.includes(myPubHex);
                      return (
                        <article
                          key={ver.docIdHex}
                          className={
                            supportedByMe
                              ? "proposal-row proposal-row--picked"
                              : "proposal-row"
                          }
                        >
                          <div className="proposal-row__top">
                            <div>
                              <div className="btn-row">
                                <span className="chip chip--cmnt">
                                  {ver.status === "SUPERSEDED"
                                    ? `Superada (v${ver.versionIndex})`
                                    : "Pendente de quórum"}
                                </span>
                                <strong className="md-title-medium">{ver.title}</strong>
                              </div>
                              <p className="md-body-medium" style={{ marginTop: 4 }}>
                                Quórum {ver.quorumPct}% · Inatividade{" "}
                                {ver.inactivityDays} dias — {ver.body}
                              </p>
                            </div>

                            {ver.status === "PENDING" &&
                              (supportedByMe ? (
                                <button
                                  type="button"
                                  className="btn btn--sm btn--consensus"
                                  disabled
                                >
                                  <MaterialIcon name="check_circle" filled />
                                  <span className="gov-tabular">
                                    Apoiado ({ver.supportCount}/
                                    {ver.requiredSupports})
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
                                    Apoiar ({ver.supportCount}/
                                    {ver.requiredSupports})
                                  </span>
                                </button>
                              ))}
                          </div>
                        </article>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Aba 2: Membros & Convites */}
      {activeTab === "members" && (
        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="md-title-large">
                Membros ({projection?.members.length ?? 0})
              </h2>
              <p className="md-body-medium">
                {activeMembersCount} ativo(s) contabilizado(s) para quórum
              </p>
            </div>

            <div className="btn-row">
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={() => void onGenerateInvite()}
                disabled={busy}
              >
                <MaterialIcon name="link" />
                <span>Gerar convite</span>
              </button>
              <button
                type="button"
                className="btn btn--sm btn--danger"
                onClick={() => void onLeaveCommunity()}
                disabled={busy}
              >
                <MaterialIcon name="logout" />
                <span>Sair da comunidade</span>
              </button>
            </div>
          </div>

          {generatedInviteCode && (
            <div className="inline-form" style={{ marginTop: 0 }}>
              <div className="card__header">
                <span className="md-title-medium">Convite assinado pronto</span>
                <button
                  type="button"
                  className="btn btn--sm btn--tonal"
                  onClick={() => copyText(generatedInviteCode)}
                >
                  <MaterialIcon name="content_copy" />
                  <span>Copiar código</span>
                </button>
              </div>
              <p className="mono">{generatedInviteCode}</p>
            </div>
          )}

          {!projection || projection.members.length === 0 ? (
            <p className="md-body-medium">Nenhum membro registrado ainda.</p>
          ) : (() => {
            const normalizedMemberQuery = memberSearchQuery.trim().toLowerCase();
            const filteredMembers = normalizedMemberQuery
              ? projection.members.filter((m) => {
                  const name = (m.displayName ?? "Membro").toLowerCase();
                  return (
                    name.includes(normalizedMemberQuery) ||
                    m.pubHex.toLowerCase().includes(normalizedMemberQuery)
                  );
                })
              : projection.members;

            return (
              <>
                <div className="feed-search" style={{ marginBottom: 12 }}>
                  <MaterialIcon name="search" />
                  <input
                    type="search"
                    className="feed-search__input"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Buscar membro por nome ou chave..."
                    aria-label="Buscar membro"
                  />
                  {memberSearchQuery && (
                    <button
                      type="button"
                      className="icon-btn icon-btn--xs"
                      onClick={() => setMemberSearchQuery("")}
                      aria-label="Limpar busca de membros"
                    >
                      <MaterialIcon name="close" />
                    </button>
                  )}
                </div>

                {filteredMembers.length === 0 ? (
                  <p className="md-body-medium">
                    Nenhum membro encontrado para &ldquo;{memberSearchQuery}&rdquo;.
                  </p>
                ) : (
                  <div className="member-list">
                    {filteredMembers.map((m) => {
                      const inviterName = m.invitedByPubHex
                        ? projection.members.find((x) => x.pubHex === m.invitedByPubHex)
                            ?.displayName
                        : null;
                      const displayName = m.displayName ?? "Membro";

                      return (
                        <article key={m.pubHex} className="member-row">
                          <div className="member-row__left">
                            <span className="author-avatar">
                              {getInitials(displayName, "M")}
                            </span>
                            <div className="member-row__text">
                              <div className="btn-row">
                                <strong className="md-title-medium">{displayName}</strong>
                                <span
                                  className={
                                    m.status === "ACTIVE"
                                      ? "chip chip--memb"
                                      : m.status === "LEFT"
                                        ? "chip chip--left"
                                        : "chip chip--stze"
                                  }
                                >
                                  {m.status === "ACTIVE"
                                    ? "Ativo"
                                    : m.status === "LEFT"
                                      ? "Saiu"
                                      : "Inativo"}
                                </span>
                                <span className="chip">
                                  {m.isFounder
                                    ? "Fundador"
                                    : inviterName
                                      ? `Convidado por ${inviterName}`
                                      : "Convidado"}
                                </span>
                              </div>
                              <span className="md-label-medium">
                                Última atividade: {formatDateMs(m.lastActivityMs)}
                              </span>
                            </div>
                          </div>

                          <span className="chip gov-tabular">{m.pickCount} apoio(s)</span>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </section>
      )}

      {/* Aba 3: Relays de Sincronização */}
      {activeTab === "relays" && (
        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="md-title-large">Servidores de Sincronização (Relays)</h2>
              <p className="md-body-medium">
                Os pacotes assinados são replicados automaticamente pelos relays abaixo.
              </p>
            </div>
          </div>

          <form onSubmit={(e) => void handleSaveRelays(e)}>
            <div className="field">
              <label htmlFor="relays-input">1 URL por linha (ws:// ou wss://)</label>
              <textarea
                id="relays-input"
                className="textarea mono"
                value={relaysDraft}
                onChange={(e) => setRelaysDraft(e.target.value)}
              />
            </div>

            <div className="btn-row" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className="chip chip--button"
                onClick={() => appendRelayPreset("ws://localhost:8080")}
              >
                + ws://localhost:8080
              </button>
              {DEFAULT_PUBLIC_NOSTR_RELAYS.map((url) => (
                <button
                  key={url}
                  type="button"
                  className="chip chip--button"
                  onClick={() => appendRelayPreset(url)}
                >
                  + {url}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--sm"
              disabled={busy}
            >
              <MaterialIcon name="sync" />
              <span>Salvar relays</span>
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
