import {
  diffProposals,
  ProposalFieldView,
  ProposalSummaryView,
} from "@sintetizing/domain";
import { useMemo, useState } from "react";
import { formatDeadlineShort, formatValueAmount } from "../utils/format.js";
import { MaterialIcon } from "./MaterialIcon.js";

function describeFieldCompact(field: ProposalFieldView | null): string {
  if (!field) {
    return "—";
  }
  switch (field.kind) {
    case "SUBTITLE":
      return `Seção: ${field.label}`;
    case "TEXT":
      return field.text;
    case "VALUE":
      return formatValueAmount(field.amountCents, field.unit);
    case "LINK":
      return field.url;
    case "ARTICLE":
      return `Art. ${field.articleNum}: ${field.text}`;
    case "TABLE":
      return `${field.columns.join(" | ")} (${field.rows.length} linha(s))`;
  }
}

export function ProposalDiffPanel({
  targetProposal,
  candidates,
  defaultBaseId,
}: {
  readonly targetProposal: ProposalSummaryView;
  readonly candidates: readonly ProposalSummaryView[];
  readonly defaultBaseId: string | null;
}) {
  const otherCandidates = candidates.filter(
    (c) => c.docIdHex !== targetProposal.docIdHex
  );
  const [selectedBaseId, setSelectedBaseId] = useState<string>(
    () =>
      (defaultBaseId &&
      otherCandidates.some((c) => c.docIdHex === defaultBaseId)
        ? defaultBaseId
        : otherCandidates[0]?.docIdHex) ?? ""
  );

  const baseProposal =
    otherCandidates.find((c) => c.docIdHex === selectedBaseId) ??
    otherCandidates[0] ??
    null;

  const diff = useMemo(
    () => (baseProposal ? diffProposals(baseProposal, targetProposal) : null),
    [baseProposal, targetProposal]
  );

  if (otherCandidates.length === 0 || !baseProposal || !diff) {
    return (
      <div className="empty-box">
        <p className="md-body-medium">
          Nenhuma outra proposta neste assunto para comparar.
        </p>
      </div>
    );
  }

  const badgeLabel = {
    IDENTICAL: "Igual",
    MODIFIED: "Modificado",
    ADDED: "Adicionado",
    REMOVED: "Removido",
  } as const;

  return (
    <div className="diff-panel stack">
      <div className="diff-panel__controls">
        <label className="field">
          <span>Comparar esta proposta com:</span>
          <select
            className="input"
            value={baseProposal.docIdHex}
            onChange={(e) => setSelectedBaseId(e.target.value)}
          >
            {otherCandidates.map((cand) => (
              <option key={cand.docIdHex} value={cand.docIdHex}>
                {cand.title} ({cand.pickCount} apoio(s))
              </option>
            ))}
          </select>
        </label>

        <div className="diff-summary-chips gov-tabular">
          <span className="chip">{diff.summary.identical} igual(is)</span>
          <span className="chip chip--stze">
            {diff.summary.modified} modificado(s)
          </span>
          <span className="chip chip--memb">
            +{diff.summary.added} adicionado(s)
          </span>
          <span className="chip chip--left">
            -{diff.summary.removed} removido(s)
          </span>
        </div>
      </div>

      {diff.titleChanged && (
        <div className="diff-entry diff-entry--MODIFIED">
          <div className="diff-entry__head">
            <strong>Título</strong>
            <span className="chip">Modificado</span>
          </div>
          <div className="diff-entry__cols">
            <div className="diff-side diff-side--base">{diff.baseTitle}</div>
            <div className="diff-side diff-side--target">{diff.targetTitle}</div>
          </div>
        </div>
      )}

      {diff.deadlineChanged && (
        <div className="diff-entry diff-entry--MODIFIED">
          <div className="diff-entry__head">
            <strong>Prazo limite</strong>
            <span className="chip">Modificado</span>
          </div>
          <div className="diff-entry__cols">
            <div className="diff-side diff-side--base">
              {diff.baseDeadlineUnixSeconds !== null
                ? formatDeadlineShort(diff.baseDeadlineUnixSeconds)
                : "Sem prazo"}
            </div>
            <div className="diff-side diff-side--target">
              {diff.targetDeadlineUnixSeconds !== null
                ? formatDeadlineShort(diff.targetDeadlineUnixSeconds)
                : "Sem prazo"}
            </div>
          </div>
        </div>
      )}

      <div className="diff-entries-list">
        {diff.fields.map((entry) => {
          const refField = entry.targetField ?? entry.baseField;
          const label = refField?.label || refField?.kind || "Campo";
          return (
            <div
              key={entry.key}
              className={`diff-entry diff-entry--${entry.status}`}
            >
              <div className="diff-entry__head">
                <div className="btn-row">
                  <MaterialIcon
                    name={
                      entry.status === "ADDED"
                        ? "add_circle"
                        : entry.status === "REMOVED"
                          ? "remove_circle"
                          : entry.status === "MODIFIED"
                            ? "edit"
                            : "check_circle"
                    }
                  />
                  <strong>{label}</strong>
                  <span className="chip">{refField?.kind}</span>
                </div>
                <span className="chip">{badgeLabel[entry.status]}</span>
              </div>

              {entry.status === "IDENTICAL" ? (
                <div className="diff-side diff-side--same">
                  {describeFieldCompact(entry.targetField)}
                </div>
              ) : (
                <div className="diff-entry__cols">
                  <div className="diff-side diff-side--base">
                    {describeFieldCompact(entry.baseField)}
                  </div>
                  <div className="diff-side diff-side--target">
                    {describeFieldCompact(entry.targetField)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
