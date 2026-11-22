import type { CommunityProjection } from "@sintetizing/domain";
import type { LocalIdentity } from "@sintetizing/storage";
import { useState } from "react";
import { SEED_SCALE_CONFIGS, SeedScale } from "../utils/seed-generator.js";
import { formatDateMs, getInitials, shortHex } from "../utils/format.js";
import { MaterialIcon } from "./MaterialIcon.js";

export interface ProfileViewProps {
  readonly identity: LocalIdentity;
  readonly selectedCommunityTitle: string | null;
  readonly projection: CommunityProjection | null;
  readonly busy: boolean;
  readonly seedProgress: string | null;
  readonly onOpenProposal: (scope: string, targetHashHex: string) => void;
  readonly onSeedDataset: (scale: SeedScale) => Promise<void>;
  readonly onResetAllData: () => Promise<void>;
}

export function ProfileView({
  identity,
  selectedCommunityTitle,
  projection,
  busy,
  seedProgress,
  onOpenProposal,
  onSeedDataset,
  onResetAllData,
}: ProfileViewProps) {
  const [seedScale, setSeedScale] = useState<SeedScale>("large");
  const [confirmReset, setConfirmReset] = useState(false);
  const myPubHex = identity.publicKeyHex;
  const myMember = projection?.members.find((m) => m.pubHex === myPubHex) ?? null;
  const myPicks =
    projection?.pickHistory.filter((p) => p.authorPubHex === myPubHex) ?? [];

  const copyPub = () => {
    void navigator.clipboard?.writeText(myPubHex);
  };

  return (
    <div className="stack">
      {/* Cartão unificado estilo perfil de usuário do Discord */}
      <section className="card profile-hero-card">
        <div className="profile-hero-top">
          <div className="profile-hero-identity">
            <span className="profile-avatar-lg">
              {getInitials(identity.displayName, "EU")}
            </span>
            <div>
              <div className="btn-row">
                <h2 className="md-title-large">{identity.displayName}</h2>
                {myMember && (
                  <span
                    className={
                      myMember.status === "ACTIVE"
                        ? "chip chip--memb"
                        : myMember.status === "LEFT"
                          ? "chip chip--left"
                          : "chip chip--stze"
                    }
                  >
                    {myMember.status === "ACTIVE"
                      ? "Membro Ativo"
                      : myMember.status === "LEFT"
                        ? "Saiu"
                        : "Inativo"}
                  </span>
                )}
              </div>
              <p className="md-body-medium mono" style={{ marginTop: 2 }}>
                {shortHex(myPubHex)}
                {selectedCommunityTitle ? ` · ${selectedCommunityTitle}` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn--sm btn--outlined"
            onClick={copyPub}
          >
            <MaterialIcon name="content_copy" />
            <span>Copiar chave pública</span>
          </button>
        </div>

        <div className="kv-grid" style={{ marginTop: 16, marginBottom: 0 }}>
          <div className="kv-box">
            <span className="md-label-medium">Identidade criada</span>
            <strong className="md-title-medium">
              {formatDateMs(identity.createdAtMs)}
            </strong>
          </div>
          <div className="kv-box">
            <span className="md-label-medium">Entrada na comunidade</span>
            <strong className="md-title-medium">
              {myMember ? formatDateMs(myMember.joinedAtMs) : "—"}
            </strong>
          </div>
          <div className="kv-box">
            <span className="md-label-medium">Última atividade</span>
            <strong className="md-title-medium">
              {myMember ? formatDateMs(myMember.lastActivityMs) : "—"}
            </strong>
          </div>
          <div className="kv-box">
            <span className="md-label-medium">Total de apoios</span>
            <strong className="md-title-medium gov-tabular">
              {myMember ? myMember.pickCount : 0}
            </strong>
          </div>
        </div>
      </section>

      {!projection ? (
        <section className="card empty-box">
          <p className="md-body-medium">
            Selecione uma comunidade na barra lateral para ver seu histórico de apoios.
          </p>
        </section>
      ) : (
        <section className="card">
          <div className="card__header">
            <div className="btn-row">
              <MaterialIcon name="history" />
              <h2 className="md-title-medium">
                Histórico de Apoios ({myPicks.length})
              </h2>
            </div>
          </div>

          {myPicks.length === 0 ? (
            <div className="empty-box">
              <p className="md-body-medium">
                Você ainda não apoiou nenhuma proposta nesta comunidade.
              </p>
            </div>
          ) : (
            <div className="member-list">
              {myPicks.map((pick) => (
                <article key={pick.docIdHex} className="member-row">
                  <div className="member-row__left">
                    <span
                      className={
                        pick.kind === "PROPOSAL"
                          ? "chip chip--stze"
                          : pick.kind === "TEMPLATE"
                            ? "chip chip--memb"
                            : "chip chip--cmnt"
                      }
                    >
                      {pick.kind === "PROPOSAL"
                        ? "Proposta"
                        : pick.kind === "TEMPLATE"
                          ? "Modelo"
                          : "Regras"}
                    </span>
                    <div className="member-row__text">
                      <strong className="md-title-medium">
                        {pick.targetTitle ??
                          (pick.kind === "TEMPLATE"
                            ? "Modelo de proposta"
                            : "Alteração de regras")}
                      </strong>
                      <span className="md-label-medium">
                        {formatDateMs(pick.timestampMs)}
                      </span>
                    </div>
                  </div>

                  {pick.kind === "PROPOSAL" && (
                    <button
                      type="button"
                      className="btn btn--sm btn--tonal"
                      onClick={() => onOpenProposal(pick.scope, pick.targetHashHex)}
                    >
                      <span>Abrir proposta</span>
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Ambiente de Teste: Seed de Grande Porte e Reset Total */}
      <section className="card">
        <div className="card__header">
          <div>
            <div className="btn-row">
              <MaterialIcon name="science" />
              <h2 className="md-title-medium">Ambiente de Teste (Seed e Reset)</h2>
            </div>
            <p className="md-body-medium" style={{ marginTop: 4 }}>
              Gere comunidades, membros com chaves Ed25519 próprias, categorias,
              assuntos, propostas e apoios locais para testar performance e UX.
            </p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="seed-scale-select">Escala do Seed</label>
          <select
            id="seed-scale-select"
            className="select"
            value={seedScale}
            onChange={(e) => setSeedScale(e.target.value as SeedScale)}
            disabled={busy}
          >
            {(Object.keys(SEED_SCALE_CONFIGS) as SeedScale[]).map((key) => (
              <option key={key} value={key}>
                {SEED_SCALE_CONFIGS[key].label} — {SEED_SCALE_CONFIGS[key].description}
              </option>
            ))}
          </select>
        </div>

        {seedProgress && (
          <p className="md-body-medium" style={{ marginBottom: 12 }}>
            {seedProgress}
          </p>
        )}

        <div className="btn-row" style={{ flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            className="btn btn--tonal"
            disabled={busy}
            onClick={() => void onSeedDataset(seedScale)}
          >
            <MaterialIcon name="dataset" />
            <span>
              {busy && seedProgress
                ? "Gerando seed..."
                : `Popular Seed (${SEED_SCALE_CONFIGS[seedScale].label})`}
            </span>
          </button>

          {!confirmReset ? (
            <button
              type="button"
              className="btn btn--danger"
              disabled={busy}
              onClick={() => setConfirmReset(true)}
            >
              <MaterialIcon name="delete_forever" />
              <span>Resetar todos os dados</span>
            </button>
          ) : (
            <div className="btn-row">
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy}
                onClick={() => {
                  setConfirmReset(false);
                  void onResetAllData();
                }}
              >
                <MaterialIcon name="warning" />
                <span>Confirmar Reset Total</span>
              </button>
              <button
                type="button"
                className="btn btn--outlined"
                disabled={busy}
                onClick={() => setConfirmReset(false)}
              >
                <span>Cancelar</span>
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
