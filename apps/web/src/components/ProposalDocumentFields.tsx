import type {
  DeliberationModeKind,
  ProposalFieldView,
} from "@sintetizing/domain";
import type { ProposalDraftRecord } from "@sintetizing/storage";
import { useState } from "react";
import type { SaveDraftInput } from "../hooks/useExplorer.js";
import {
  formatDateMs,
  formatDeadlineShort,
  formatValueAmount,
} from "../utils/format.js";
import { MaterialIcon } from "./MaterialIcon.js";

function makeFieldId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${hex}`;
}

export function createDefaultField(kind: ProposalFieldView["kind"]): ProposalFieldView {
  switch (kind) {
    case "SUBTITLE":
      return { kind: "SUBTITLE", fieldId: makeFieldId("sub"), label: "Nova Seção" };
    case "TEXT":
      return {
        kind: "TEXT",
        fieldId: makeFieldId("txt"),
        label: "Descrição",
        text: "",
      };
    case "VALUE":
      return {
        kind: "VALUE",
        fieldId: makeFieldId("val"),
        label: "Orçamento",
        amountCents: 0,
        unit: "BRL",
      };
    case "LINK":
      return {
        kind: "LINK",
        fieldId: makeFieldId("lnk"),
        label: "Referência",
        url: "https://",
      };
    case "TABLE":
      return {
        kind: "TABLE",
        fieldId: makeFieldId("tbl"),
        label: "Tabela",
        columns: ["Item", "Detalhe"],
        rows: [["", ""]],
      };
    case "ARTICLE":
      return {
        kind: "ARTICLE",
        fieldId: makeFieldId("art"),
        label: "Art. 1",
        articleNum: 1,
        text: "",
      };
  }
}

export function summarizeValueTotals(
  fields: readonly ProposalFieldView[]
): Array<{ readonly unit: string; readonly totalCents: number }> {
  const totals = new Map<string, number>();
  for (const field of fields) {
    if (field.kind === "VALUE") {
      const unit = field.unit.trim().toUpperCase() || "BRL";
      totals.set(unit, (totals.get(unit) ?? 0) + field.amountCents);
    }
  }
  return Array.from(totals.entries()).map(([unit, totalCents]) => ({
    unit,
    totalCents,
  }));
}

export function unixSecondsToLocalInput(unixSec: number | null): string {
  if (!unixSec) {
    return "";
  }
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function localInputToUnixSeconds(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms) || ms <= 0) {
    return undefined;
  }
  return Math.floor(ms / 1000);
}

export function ProposalFieldsRenderer({
  fields,
}: {
  readonly fields: readonly ProposalFieldView[];
}) {
  const totals = summarizeValueTotals(fields);

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="proposal-fields-view">
      {fields.map((field) => {
        switch (field.kind) {
          case "SUBTITLE":
            return (
              <h2 key={field.fieldId} className="proposal-field__subtitle">
                {field.label}
              </h2>
            );
          case "TEXT":
            return (
              <section key={field.fieldId} className="proposal-field-card">
                {field.label && (
                  <h3 className="proposal-field-card__label">{field.label}</h3>
                )}
                <p className="proposal-field-card__text">{field.text}</p>
              </section>
            );
          case "VALUE":
            return (
              <div key={field.fieldId} className="proposal-field-value">
                <span className="proposal-field-value__label">{field.label}</span>
                <strong className="proposal-field-value__amount gov-tabular">
                  {formatValueAmount(field.amountCents, field.unit)}
                </strong>
              </div>
            );
          case "LINK":
            return (
              <div key={field.fieldId} className="proposal-field-link">
                <MaterialIcon name="link" />
                <div className="proposal-field-link__main">
                  <span className="proposal-field-link__label">
                    {field.label || "Link externo"}
                  </span>
                  <a
                    href={field.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="proposal-field-link__url"
                  >
                    {field.url}
                  </a>
                </div>
              </div>
            );
          case "TABLE":
            return (
              <section key={field.fieldId} className="proposal-field-card">
                {field.label && (
                  <h3 className="proposal-field-card__label">{field.label}</h3>
                )}
                <div className="proposal-field-table-wrap">
                  <table className="proposal-field-table">
                    <thead>
                      <tr>
                        {field.columns.map((col, colIdx) => (
                          <th key={colIdx}>{col || `Coluna ${colIdx + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {field.rows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          {field.columns.map((_, colIdx) => (
                            <td key={colIdx}>{row[colIdx] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          case "ARTICLE":
            return (
              <section key={field.fieldId} className="proposal-field-card">
                <h3 className="proposal-field-card__label">
                  Artigo {field.articleNum}
                </h3>
                <p className="proposal-field-card__text">{field.text}</p>
              </section>
            );
        }
      })}

      {totals.length > 0 && (
        <div className="proposal-fields-totals gov-tabular">
          <span className="md-label-medium">Total dos valores:</span>
          {totals.map((t) => (
            <strong key={t.unit} className="chip chip--stze">
              {formatValueAmount(t.totalCents, t.unit)}
            </strong>
          ))}
        </div>
      )}
    </div>
  );
}

export interface ProposalDocumentComposerProps {
  readonly modeLabel: string;
  readonly submitLabel: string;
  readonly submitIcon: "send" | "fork_right" | "save";
  readonly deliberationMode: DeliberationModeKind;
  readonly quorumPct: number | null;
  readonly subjectScope: string;
  readonly parentHashHex: string | null;
  readonly draftId: string;
  readonly existingDrafts: readonly ProposalDraftRecord[];
  readonly title: string;
  readonly deadlineInput: string;
  readonly fields: readonly ProposalFieldView[];
  readonly busy: boolean;
  readonly skipConfirm?: boolean | undefined;
  readonly hideLocalDraftActions?: boolean | undefined;
  readonly onChangeTitle: (value: string) => void;
  readonly onChangeDeadlineInput: (value: string) => void;
  readonly onChangeFields: (fields: readonly ProposalFieldView[]) => void;
  readonly onSaveDraft: (input: SaveDraftInput) => Promise<void>;
  readonly onDeleteDraft: (draftId: string) => Promise<void>;
  readonly onLoadDraft: (draft: ProposalDraftRecord) => void;
  readonly onSubmitPublish: (payload: {
    readonly title: string;
    readonly body: string;
    readonly deadlineUnixSeconds?: number | undefined;
    readonly fields: readonly ProposalFieldView[];
  }) => Promise<boolean>;
  readonly onCancel: () => void;
}

export function ProposalDocumentComposer({
  modeLabel,
  submitLabel,
  submitIcon,
  deliberationMode,
  quorumPct,
  subjectScope,
  parentHashHex,
  draftId,
  existingDrafts,
  title,
  deadlineInput,
  fields,
  busy,
  skipConfirm = false,
  hideLocalDraftActions = false,
  onChangeTitle,
  onChangeDeadlineInput,
  onChangeFields,
  onSaveDraft,
  onDeleteDraft,
  onLoadDraft,
  onSubmitPublish,
  onCancel,
}: ProposalDocumentComposerProps) {
  const [confirming, setConfirming] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [draftSavedMsg, setDraftSavedMsg] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  const updateFieldAt = (index: number, nextField: ProposalFieldView) => {
    const next = [...fields];
    next[index] = nextField;
    onChangeFields(next);
  };

  const moveField = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= fields.length) {
      return;
    }
    const next = [...fields];
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    onChangeFields(next);
  };

  const removeField = (index: number) => {
    onChangeFields(fields.filter((_, i) => i !== index));
  };

  const addField = (kind: ProposalFieldView["kind"]) => {
    onChangeFields([...fields, createDefaultField(kind)]);
  };

  const validateForReview = (): string | null => {
    if (title.trim().length < 5) {
      return "O título da proposta deve ter pelo menos 5 caracteres.";
    }
    if (fields.length === 0) {
      return "Adicione pelo menos 1 campo ao documento da proposta.";
    }
    for (const f of fields) {
      if (f.kind === "SUBTITLE" && !f.label.trim()) {
        return "Todo subtítulo precisa ter um texto.";
      }
      if (f.kind === "TEXT" && !f.text.trim()) {
        return `O bloco de texto "${f.label || "sem rótulo"}" não pode ficar vazio.`;
      }
      if (f.kind === "VALUE" && (!f.label.trim() || !f.unit.trim())) {
        return "Campos de valor precisam de rótulo e moeda/unidade.";
      }
      if (f.kind === "LINK") {
        const cleanUrl = f.url.trim();
        if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
          return `O link "${f.label || cleanUrl}" deve iniciar com http:// ou https://.`;
        }
      }
      if (f.kind === "ARTICLE" && (!f.text.trim() || f.articleNum < 1)) {
        return "Artigos precisam de número >= 1 e texto.";
      }
    }
    return null;
  };

  const handleEnterConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForReview();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    if (skipConfirm) {
      void handleConfirmPublish();
      return;
    }
    setConfirming(true);
  };

  const handleConfirmPublish = async () => {
    const deadlineUnixSeconds = localInputToUnixSeconds(deadlineInput);
    const firstText = fields.find((f) => f.kind === "TEXT");
    const summaryBody =
      firstText && firstText.kind === "TEXT" ? firstText.text.slice(0, 300) : title.trim();

    const ok = await onSubmitPublish({
      title: title.trim(),
      body: summaryBody,
      ...(deadlineUnixSeconds !== undefined ? { deadlineUnixSeconds } : {}),
      fields,
    });
    if (ok && activeDraftId) {
      await onDeleteDraft(activeDraftId);
      setActiveDraftId(null);
    }
    if (ok) {
      setConfirming(false);
    }
  };

  const handleSaveDraftClick = async (asNew = false) => {
    const deadlineUnixSeconds = localInputToUnixSeconds(deadlineInput) ?? null;
    const firstText = fields.find((f) => f.kind === "TEXT");
    const targetDraftId =
      !asNew && activeDraftId ? activeDraftId : `${draftId}:${Date.now()}`;
    await onSaveDraft({
      draftId: targetDraftId,
      subjectScope,
      parentHashHex,
      title,
      body: firstText && firstText.kind === "TEXT" ? firstText.text : "",
      deadlineUnixSeconds,
      fields,
    });
    setActiveDraftId(targetDraftId);
    setDraftSavedMsg(
      asNew ? "Novo rascunho salvo localmente." : "Rascunho salvo localmente.",
    );
    setTimeout(() => setDraftSavedMsg(null), 2500);
  };

  const previewDeadlineSec = localInputToUnixSeconds(deadlineInput) ?? null;

  if (confirming) {
    return (
      <div className="stack">
        <div className="confirm-publish-banner">
          <MaterialIcon name="verified_user" />
          <div>
            <strong>Revisão antes de publicar na rede</strong>
            <p className="md-body-medium">
              Este documento será assinado com sua chave Ed25519 e propagado aos relays. Após publicado, ele não pode ser apagado da rede (correções exigem um novo Fork).
            </p>
          </div>
        </div>

        <section className="proposal-preview-card">
          <div className="btn-row" style={{ flexWrap: "wrap", gap: 6 }}>
            <span className="chip chip--stze">{modeLabel}</span>
            <span className="chip">
              {deliberationMode === "OPEN"
                ? "Assunto aberto (sem quórum)"
                : `Quórum da comunidade: ${quorumPct ?? 51}%`}
            </span>
            {previewDeadlineSec !== null && (
              <span className="chip">
                Prazo: {formatDeadlineShort(previewDeadlineSec)}
              </span>
            )}
          </div>

          <h2 className="md-title-large" style={{ marginTop: 10 }}>
            {title.trim()}
          </h2>

          <ProposalFieldsRenderer fields={fields} />
        </section>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => void handleConfirmPublish()}
          >
            <MaterialIcon name={submitIcon} />
            <span>Confirmar e publicar na rede</span>
          </button>
          <button
            type="button"
            className="btn btn--outlined"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            Voltar e editar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={handleEnterConfirm}>
      {!hideLocalDraftActions && existingDrafts.length > 0 && (
        <div className="stack" style={{ gap: "8px" }}>
          {existingDrafts.map((draft) => (
            <div key={draft.draftId} className="draft-restore-banner">
              <div className="draft-restore-banner__info">
                <MaterialIcon name="save" />
                <span>
                  {activeDraftId === draft.draftId ? "Editando: " : "Rascunho: "}
                  {draft.title.trim() ? `“${draft.title.trim()}”` : "Sem título"} ·{" "}
                  {formatDateMs(draft.updatedAtMs)}
                </span>
              </div>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn--tonal btn--sm"
                  onClick={() => {
                    setActiveDraftId(draft.draftId);
                    onLoadDraft(draft);
                  }}
                >
                  Carregar
                </button>
                <button
                  type="button"
                  className="btn btn--outlined btn--sm"
                  onClick={() => {
                    if (activeDraftId === draft.draftId) {
                      setActiveDraftId(null);
                    }
                    void onDeleteDraft(draft.draftId);
                  }}
                >
                  Descartar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {validationError && (
        <div className="banner banner--error" role="alert">
          <MaterialIcon name="close" />
          <span>{validationError}</span>
        </div>
      )}

      {draftSavedMsg && (
        <div className="banner banner--info" role="status">
          <MaterialIcon name="check_circle" />
          <span>{draftSavedMsg}</span>
        </div>
      )}

      <div className="row-2">
        <div className="field">
          <label htmlFor={`prop-title-${draftId}`}>
            Título da proposta (mín. 5 caracteres)
          </label>
          <input
            id={`prop-title-${draftId}`}
            className="input"
            minLength={5}
            required
            autoFocus
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            placeholder="Ex.: Instalar 12 luminárias LED"
          />
        </div>

        <div className="field">
          <label htmlFor={`prop-deadline-${draftId}`}>
            Prazo limite da proposta (opcional)
          </label>
          <input
            id={`prop-deadline-${draftId}`}
            type="datetime-local"
            className="input"
            value={deadlineInput}
            onChange={(e) => onChangeDeadlineInput(e.target.value)}
          />
        </div>
      </div>

      <div className="composer-blocks-header">
        <span className="md-label-medium">
          Campos do documento ({fields.length})
        </span>
        <div className="composer-blocks-toolbar">
          <button
            type="button"
            className="btn btn--outlined btn--sm"
            onClick={() => addField("SUBTITLE")}
          >
            + Subtítulo
          </button>
          <button
            type="button"
            className="btn btn--outlined btn--sm"
            onClick={() => addField("TEXT")}
          >
            + Texto
          </button>
          <button
            type="button"
            className="btn btn--outlined btn--sm"
            onClick={() => addField("VALUE")}
          >
            + Valor
          </button>
          <button
            type="button"
            className="btn btn--outlined btn--sm"
            onClick={() => addField("LINK")}
          >
            + Link
          </button>
          <button
            type="button"
            className="btn btn--outlined btn--sm"
            onClick={() => addField("TABLE")}
          >
            + Tabela
          </button>
          <button
            type="button"
            className="btn btn--outlined btn--sm"
            onClick={() => addField("ARTICLE")}
          >
            + Artigo
          </button>
        </div>
      </div>

      <div className="composer-blocks-list">
        {fields.map((field, idx) => (
          <div key={field.fieldId} className="composer-block-card">
            <div className="composer-block-card__head">
              <span className="chip">{field.kind}</span>
              <div className="btn-row">
                <button
                  type="button"
                  className="icon-btn icon-btn--xs"
                  disabled={idx === 0}
                  onClick={() => moveField(idx, -1)}
                  title="Mover para cima"
                >
                  <MaterialIcon name="arrow_upward" />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--xs"
                  disabled={idx === fields.length - 1}
                  onClick={() => moveField(idx, 1)}
                  title="Mover para baixo"
                >
                  <MaterialIcon name="arrow_downward" />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--xs"
                  onClick={() => removeField(idx)}
                  title="Remover campo"
                >
                  <MaterialIcon name="delete" />
                </button>
              </div>
            </div>

            {field.kind === "SUBTITLE" && (
              <input
                className="input"
                value={field.label}
                onChange={(e) =>
                  updateFieldAt(idx, { ...field, label: e.target.value })
                }
                placeholder="Título da seção"
              />
            )}

            {field.kind === "TEXT" && (
              <div className="stack-sm">
                <input
                  className="input"
                  value={field.label}
                  onChange={(e) =>
                    updateFieldAt(idx, { ...field, label: e.target.value })
                  }
                  placeholder="Rótulo (ex.: Justificativa)"
                />
                <textarea
                  className="textarea"
                  value={field.text}
                  onChange={(e) =>
                    updateFieldAt(idx, { ...field, text: e.target.value })
                  }
                  placeholder="Texto da seção..."
                />
              </div>
            )}

            {field.kind === "VALUE" && (
              <div className="row-3">
                <input
                  className="input"
                  value={field.label}
                  onChange={(e) =>
                    updateFieldAt(idx, { ...field, label: e.target.value })
                  }
                  placeholder="Descrição do valor"
                />
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={(field.amountCents / 100).toFixed(2)}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    updateFieldAt(idx, {
                      ...field,
                      amountCents: Number.isFinite(parsed)
                        ? Math.round(parsed * 100)
                        : 0,
                    });
                  }}
                  placeholder="0.00"
                />
                <input
                  className="input"
                  maxLength={12}
                  value={field.unit}
                  onChange={(e) =>
                    updateFieldAt(idx, { ...field, unit: e.target.value })
                  }
                  placeholder="BRL"
                />
              </div>
            )}

            {field.kind === "LINK" && (
              <div className="row-2">
                <input
                  className="input"
                  value={field.label}
                  onChange={(e) =>
                    updateFieldAt(idx, { ...field, label: e.target.value })
                  }
                  placeholder="Rótulo do link"
                />
                <input
                  className="input"
                  type="url"
                  value={field.url}
                  onChange={(e) =>
                    updateFieldAt(idx, { ...field, url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
            )}

            {field.kind === "ARTICLE" && (
              <div className="stack-sm">
                <div className="row-2">
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={field.articleNum}
                    onChange={(e) => {
                      const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
                      updateFieldAt(idx, {
                        ...field,
                        articleNum: n,
                        label: `Art. ${n}`,
                      });
                    }}
                    placeholder="Número"
                  />
                </div>
                <textarea
                  className="textarea"
                  value={field.text}
                  onChange={(e) =>
                    updateFieldAt(idx, { ...field, text: e.target.value })
                  }
                  placeholder="Texto do artigo ou regra..."
                />
              </div>
            )}

            {field.kind === "TABLE" && (
              <div className="stack-sm">
                <input
                  className="input"
                  value={field.label}
                  onChange={(e) =>
                    updateFieldAt(idx, { ...field, label: e.target.value })
                  }
                  placeholder="Título da tabela"
                />
                <div className="proposal-field-table-wrap">
                  <table className="proposal-field-table proposal-field-table--edit">
                    <thead>
                      <tr>
                        {field.columns.map((col, colIdx) => (
                          <th key={colIdx}>
                            <input
                              className="input input--xs"
                              value={col}
                              onChange={(e) => {
                                const cols = [...field.columns];
                                cols[colIdx] = e.target.value;
                                updateFieldAt(idx, { ...field, columns: cols });
                              }}
                              placeholder={`Col ${colIdx + 1}`}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {field.rows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          {field.columns.map((_, colIdx) => (
                            <td key={colIdx}>
                              <input
                                className="input input--xs"
                                value={row[colIdx] ?? ""}
                                onChange={(e) => {
                                  const nextRows = field.rows.map((r, rI) =>
                                    rI === rowIdx
                                      ? field.columns.map((__, cI) =>
                                          cI === colIdx
                                            ? e.target.value
                                            : (r[cI] ?? "")
                                        )
                                      : [...r]
                                  );
                                  updateFieldAt(idx, { ...field, rows: nextRows });
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn--outlined btn--sm"
                    onClick={() =>
                      updateFieldAt(idx, {
                        ...field,
                        rows: [...field.rows, field.columns.map(() => "")],
                      })
                    }
                  >
                    + Linha
                  </button>
                  <button
                    type="button"
                    className="btn btn--outlined btn--sm"
                    onClick={() =>
                      updateFieldAt(idx, {
                        ...field,
                        columns: [
                          ...field.columns,
                          `Coluna ${field.columns.length + 1}`,
                        ],
                        rows: field.rows.map((r) => [...r, ""]),
                      })
                    }
                  >
                    + Coluna
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="btn-row" style={{ flexWrap: "wrap" }}>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          <MaterialIcon name={skipConfirm ? submitIcon : "preview"} />
          <span>{skipConfirm ? submitLabel : `Revisar e ${submitLabel}`}</span>
        </button>
        {!hideLocalDraftActions && (
          <>
            <button
              type="button"
              className="btn btn--tonal"
              disabled={busy}
              onClick={() => void handleSaveDraftClick(false)}
            >
              <MaterialIcon name="save" />
              <span>{activeDraftId ? "Atualizar rascunho" : "Salvar rascunho local"}</span>
            </button>
            {activeDraftId && (
              <button
                type="button"
                className="btn btn--outlined"
                disabled={busy}
                onClick={() => void handleSaveDraftClick(true)}
              >
                <MaterialIcon name="add" />
                <span>Salvar como novo</span>
              </button>
            )}
          </>
        )}
        <button
          type="button"
          className="btn btn--outlined"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
