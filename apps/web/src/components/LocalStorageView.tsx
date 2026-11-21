import {
  type InspectedDocument,
  inspectBinaryPacket,
} from "@sintetizing/domain";
import type {
  CommunityRecord,
  LocalIdentity,
  StoredPacketRecord,
} from "@sintetizing/storage";
import { getDocTypeName } from "@sintetizing/wire";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateMs, shortHex } from "../utils/format.js";
import { MaterialIcon } from "./MaterialIcon.js";

export interface LocalStorageViewProps {
  readonly identity: LocalIdentity;
  readonly communities: readonly CommunityRecord[];
  readonly loadAllPackets: () => Promise<StoredPacketRecord[]>;
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function universeChipClass(universe: string): string {
  switch (universe) {
    case ".cmnt":
      return "chip chip--cmnt";
    case ".memb":
      return "chip chip--memb";
    case ".stze":
      return "chip chip--stze";
    default:
      return "chip chip--left";
  }
}

export function LocalStorageView({
  identity,
  communities,
  loadAllPackets,
}: LocalStorageViewProps) {
  const [packets, setPackets] = useState<StoredPacketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const [universeFilter, setUniverseFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [decodedByDocId, setDecodedByDocId] = useState<
    Readonly<Record<string, InspectedDocument>>
  >({});
  const [decodeErrorByDocId, setDecodeErrorByDocId] = useState<
    Readonly<Record<string, string>>
  >({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await loadAllPackets();
      setPackets(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadAllPackets]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const communityTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const comm of communities) {
      map.set(comm.communityId, comm.title);
    }
    return map;
  }, [communities]);

  const totalBytes = useMemo(
    () => packets.reduce((sum, p) => sum + p.rawBytes.length, 0),
    [packets]
  );

  const filteredPackets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return packets.filter((pkt) => {
      if (communityFilter !== "all" && pkt.communityId !== communityFilter) {
        return false;
      }
      if (universeFilter !== "all" && pkt.universe !== universeFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      const docTypeName = getDocTypeName(pkt.docType).toLowerCase();
      return (
        pkt.docIdHex.toLowerCase().includes(q) ||
        pkt.authorPubHex.toLowerCase().includes(q) ||
        pkt.communityId.toLowerCase().includes(q) ||
        docTypeName.includes(q)
      );
    });
  }, [communityFilter, packets, searchQuery, universeFilter]);

  const handleToggleInspect = async (pkt: StoredPacketRecord) => {
    if (expandedDocId === pkt.docIdHex) {
      setExpandedDocId(null);
      return;
    }
    setExpandedDocId(pkt.docIdHex);
    if (decodedByDocId[pkt.docIdHex] || decodeErrorByDocId[pkt.docIdHex]) {
      return;
    }
    try {
      const inspected = await inspectBinaryPacket(pkt.rawBytes);
      setDecodedByDocId((prev) => ({ ...prev, [pkt.docIdHex]: inspected }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDecodeErrorByDocId((prev) => ({ ...prev, [pkt.docIdHex]: msg }));
    }
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="card__header">
          <div className="btn-row">
            <MaterialIcon name="dataset" />
            <h2 className="md-title-medium">
              Resumo do Banco Local (IndexedDB: sintetize-nostr-v2)
            </h2>
          </div>
          <button
            type="button"
            className="btn btn--sm btn--outlined"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <MaterialIcon name="refresh" />
            <span>Atualizar</span>
          </button>
        </div>

        <div className="kv-grid" style={{ marginBottom: 0 }}>
          <div className="kv-box">
            <span className="md-label-medium">Identidade neste nó</span>
            <strong className="md-title-medium">{identity.displayName}</strong>
            <span className="md-label-medium mono">
              {shortHex(identity.publicKeyHex)}
            </span>
          </div>
          <div className="kv-box">
            <span className="md-label-medium">Comunidades salvas</span>
            <strong className="md-title-medium gov-tabular">
              {communities.length}
            </strong>
          </div>
          <div className="kv-box">
            <span className="md-label-medium">Pacotes TLV guardados</span>
            <strong className="md-title-medium gov-tabular">
              {packets.length}
            </strong>
          </div>
          <div className="kv-box">
            <span className="md-label-medium">Tamanho bruto total</span>
            <strong className="md-title-medium gov-tabular">
              {formatByteSize(totalBytes)}
            </strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div className="btn-row">
            <MaterialIcon name="key" />
            <h2 className="md-title-medium">Store: identity</h2>
          </div>
        </div>
        <div className="kv-grid" style={{ marginBottom: 0 }}>
          <div className="kv-box">
            <span className="md-label-medium">Chave Pública (Ed25519)</span>
            <span className="md-body-medium mono" style={{ wordBreak: "break-all" }}>
              {identity.publicKeyHex}
            </span>
          </div>
          <div className="kv-box">
            <span className="md-label-medium">Chave Privada</span>
            <span className="md-body-medium">
              Armazenada localmente (32 bytes, nunca enviada à rede)
            </span>
          </div>
          <div className="kv-box">
            <span className="md-label-medium">Criada em</span>
            <span className="md-body-medium">
              {formatDateMs(identity.createdAtMs)}
            </span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div className="btn-row">
            <MaterialIcon name="groups" />
            <h2 className="md-title-medium">
              Store: communities ({communities.length})
            </h2>
          </div>
        </div>

        {communities.length === 0 ? (
          <div className="empty-box">
            <p className="md-body-medium">Nenhuma comunidade salva neste nó.</p>
          </div>
        ) : (
          <div className="member-list">
            {communities.map((comm) => (
              <article key={comm.communityId} className="member-row">
                <div className="member-row__left">
                  <div className="member-row__text">
                    <strong className="md-title-medium">{comm.title}</strong>
                    <span className="md-label-medium mono">{comm.communityId}</span>
                    <span className="md-label-medium">
                      Relays: {comm.relays.length > 0 ? comm.relays.join(", ") : "nenhum"}
                    </span>
                  </div>
                </div>
                <span className="md-label-medium">
                  {formatDateMs(comm.createdAtMs)}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__header">
          <div className="btn-row">
            <MaterialIcon name="inventory_2" />
            <h2 className="md-title-medium">
              Store: packets ({filteredPackets.length}
              {filteredPackets.length !== packets.length
                ? ` de ${packets.length}`
                : ""}
              )
            </h2>
          </div>
        </div>

        <div
          className="btn-row"
          style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}
        >
          <select
            className="input"
            style={{ width: "auto", minWidth: 180 }}
            aria-label="Filtrar por comunidade"
            value={communityFilter}
            onChange={(e) => setCommunityFilter(e.target.value)}
          >
            <option value="all">Todas as comunidades</option>
            {communities.map((c) => (
              <option key={c.communityId} value={c.communityId}>
                {c.title}
              </option>
            ))}
          </select>

          <select
            className="input"
            style={{ width: "auto", minWidth: 140 }}
            aria-label="Filtrar por universo"
            value={universeFilter}
            onChange={(e) => setUniverseFilter(e.target.value)}
          >
            <option value="all">Todos universos</option>
            <option value=".cmnt">.cmnt</option>
            <option value=".memb">.memb</option>
            <option value=".stze">.stze</option>
            <option value=".snap">.snap</option>
          </select>

          <input
            className="input"
            style={{ flex: "1 1 220px" }}
            placeholder="Buscar por docId, autor ou tipo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {error && (
          <div className="banner banner--error" role="alert" style={{ marginBottom: 12 }}>
            <MaterialIcon name="close" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="empty-box">
            <p className="md-body-medium">Lendo pacotes do IndexedDB...</p>
          </div>
        ) : filteredPackets.length === 0 ? (
          <div className="empty-box">
            <p className="md-body-medium">
              Nenhum pacote encontrado com os filtros atuais.
            </p>
          </div>
        ) : (
          <div className="member-list">
            {filteredPackets.map((pkt) => {
              const isExpanded = expandedDocId === pkt.docIdHex;
              const decoded = decodedByDocId[pkt.docIdHex];
              const decodeError = decodeErrorByDocId[pkt.docIdHex];
              const commTitle = communityTitleById.get(pkt.communityId) ?? pkt.communityId;

              return (
                <article
                  key={pkt.docIdHex}
                  className="member-row"
                  style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div className="member-row__left">
                      <span className={universeChipClass(pkt.universe)}>
                        {pkt.universe}
                      </span>
                      <div className="member-row__text">
                        <strong className="md-title-medium">
                          {getDocTypeName(pkt.docType)} · seq #{pkt.seq}
                        </strong>
                        <span className="md-label-medium mono">
                          docId: {shortHex(pkt.docIdHex)} · autor:{" "}
                          {shortHex(pkt.authorPubHex)} · {pkt.rawBytes.length} B
                        </span>
                        <span className="md-label-medium">
                          {commTitle} · salvo em {formatDateMs(pkt.storedAtMs)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn--sm btn--outlined"
                      onClick={() => void handleToggleInspect(pkt)}
                    >
                      <MaterialIcon
                        name={isExpanded ? "expand_less" : "expand_more"}
                      />
                      <span>{isExpanded ? "Ocultar TLV" : "Inspecionar TLV"}</span>
                    </button>
                  </div>

                  {isExpanded && (
                    <div
                      className="kv-box"
                      style={{ marginTop: 4, gap: 8 }}
                    >
                      {decodeError ? (
                        <span className="md-body-medium">
                          Erro ao decodificar pacote: {decodeError}
                        </span>
                      ) : !decoded ? (
                        <span className="md-body-medium">Decodificando blocos TLV...</span>
                      ) : (
                        <>
                          <div className="md-label-medium mono" style={{ wordBreak: "break-all" }}>
                            <strong>docIdHex:</strong> {decoded.docIdHex}
                          </div>
                          <div className="md-label-medium mono" style={{ wordBreak: "break-all" }}>
                            <strong>authorPubHex:</strong> {decoded.authorPubHex}
                          </div>
                          {decoded.scope && (
                            <div className="md-label-medium mono">
                              <strong>scope:</strong> {decoded.scope}
                            </div>
                          )}
                          {decoded.parentHashHex && (
                            <div className="md-label-medium mono" style={{ wordBreak: "break-all" }}>
                              <strong>parentHashHex:</strong> {decoded.parentHashHex}
                            </div>
                          )}
                          <div className="md-label-medium" style={{ marginTop: 4 }}>
                            <strong>Blocos TLV ({decoded.blocks.length}):</strong>
                          </div>
                          {decoded.blocks.map((blk, idx) => (
                            <div
                              key={`${blk.tag}-${idx}`}
                              className="md-body-medium"
                              style={{
                                paddingLeft: 10,
                                borderLeft: "2px solid var(--md-outline-variant, #444)",
                                wordBreak: "break-word",
                              }}
                            >
                              <span className="mono md-label-medium">
                                [{blk.tagName} ({blk.byteLength} B)]
                              </span>{" "}
                              {blk.displayValue}
                            </div>
                          ))}
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
  );
}
