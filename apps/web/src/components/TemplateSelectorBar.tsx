import type {
  ProposalTemplateSummaryView,
  TemplateCategorySummaryView,
} from "@sintetizing/domain";
import { useEffect, useState } from "react";
import { MaterialIcon } from "./MaterialIcon.js";

export interface TemplateSelectorBarProps {
  readonly templateCategories: readonly TemplateCategorySummaryView[];
  readonly templates: readonly ProposalTemplateSummaryView[];
  readonly onApplyTemplate: (
    template: ProposalTemplateSummaryView,
    clearExamples: boolean
  ) => void;
}

export function TemplateSelectorBar({
  templateCategories,
  templates,
  onApplyTemplate,
}: TemplateSelectorBarProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    () => templates[0]?.docIdHex ?? ""
  );
  const [clearExamples, setClearExamples] = useState(false);

  useEffect(() => {
    if (
      templates.length > 0 &&
      !templates.some((t) => t.docIdHex === selectedTemplateId)
    ) {
      setSelectedTemplateId(templates[0]!.docIdHex);
    }
  }, [selectedTemplateId, templates]);

  if (templates.length === 0) {
    return null;
  }

  const selectedTemplate =
    templates.find((t) => t.docIdHex === selectedTemplateId) ?? templates[0]!;

  return (
    <div className="composer-block-card" style={{ marginBottom: 4 }}>
      <div className="composer-block-card__head" style={{ marginBottom: 6 }}>
        <div className="btn-row">
          <MaterialIcon name="edit_note" />
          <strong className="md-label-large">Usar Modelo (Template)</strong>
        </div>
        {selectedTemplate.isTopInCategory && (
          <span className="chip chip--memb">Preferido da categoria</span>
        )}
      </div>

      <div className="row-2" style={{ alignItems: "end" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="template-picker-select">
            Escolha um modelo por categoria
          </label>
          <select
            id="template-picker-select"
            className="select"
            value={selectedTemplate.docIdHex}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
          >
            {templateCategories.map((cat) => {
              const catTemplates = templates.filter(
                (t) => t.categoryId === cat.docIdHex
              );
              if (catTemplates.length === 0) {
                return null;
              }
              return (
                <optgroup key={cat.docIdHex} label={cat.title}>
                  {catTemplates.map((tpl) => {
                    const badge = tpl.isTopInCategory
                      ? "★ Preferido"
                      : tpl.isBuiltIn
                        ? "Inicial"
                        : `${tpl.pickCount} apoio(s)`;
                    return (
                      <option key={tpl.docIdHex} value={tpl.docIdHex}>
                        {tpl.title} ({badge})
                      </option>
                    );
                  })}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn--tonal btn--sm"
            onClick={() => onApplyTemplate(selectedTemplate, clearExamples)}
          >
            <MaterialIcon name="content_copy" />
            <span>Aplicar campos do modelo</span>
          </button>
        </div>
      </div>

      {selectedTemplate.body && (
        <p className="md-body-small" style={{ marginTop: 8 }}>
          {selectedTemplate.body} ({selectedTemplate.fields.length} campo(s))
        </p>
      )}

      <label
        className="btn-row"
        style={{ marginTop: 8, cursor: "pointer", fontSize: "0.8125rem" }}
      >
        <input
          type="checkbox"
          checked={clearExamples}
          onChange={(e) => setClearExamples(e.target.checked)}
        />
        <span>Limpar textos de exemplo ao aplicar (manter apenas estrutura)</span>
      </label>
    </div>
  );
}
