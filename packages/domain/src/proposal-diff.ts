import type { ProposalFieldView, ProposalSummaryView } from "./types.js";

export type FieldDiffStatus = "IDENTICAL" | "MODIFIED" | "ADDED" | "REMOVED";

export interface ProposalFieldDiffEntry {
  readonly key: string;
  readonly status: FieldDiffStatus;
  readonly baseField: ProposalFieldView | null;
  readonly targetField: ProposalFieldView | null;
}

export interface ProposalDiffSummary {
  readonly identical: number;
  readonly modified: number;
  readonly added: number;
  readonly removed: number;
}

export interface ProposalDiffResult {
  readonly baseDocIdHex: string;
  readonly targetDocIdHex: string;
  readonly titleChanged: boolean;
  readonly baseTitle: string;
  readonly targetTitle: string;
  readonly deadlineChanged: boolean;
  readonly baseDeadlineUnixSeconds: number | null;
  readonly targetDeadlineUnixSeconds: number | null;
  readonly fields: readonly ProposalFieldDiffEntry[];
  readonly summary: ProposalDiffSummary;
}

function areTablesEqual(
  aCols: readonly string[],
  aRows: readonly (readonly string[])[],
  bCols: readonly string[],
  bRows: readonly (readonly string[])[]
): boolean {
  if (aCols.length !== bCols.length || aRows.length !== bRows.length) {
    return false;
  }
  for (let i = 0; i < aCols.length; i += 1) {
    if (aCols[i] !== bCols[i]) {
      return false;
    }
  }
  for (let r = 0; r < aRows.length; r += 1) {
    const rowA = aRows[r]!;
    const rowB = bRows[r]!;
    if (rowA.length !== rowB.length) {
      return false;
    }
    for (let c = 0; c < rowA.length; c += 1) {
      if (rowA[c] !== rowB[c]) {
        return false;
      }
    }
  }
  return true;
}

function areFieldsEqual(a: ProposalFieldView, b: ProposalFieldView): boolean {
  if (a.kind !== b.kind || a.label !== b.label) {
    return false;
  }
  switch (a.kind) {
    case "SUBTITLE":
      return true;
    case "TEXT":
      return b.kind === "TEXT" && a.text === b.text;
    case "VALUE":
      return b.kind === "VALUE" && a.amountCents === b.amountCents && a.unit === b.unit;
    case "LINK":
      return b.kind === "LINK" && a.url === b.url;
    case "ARTICLE":
      return b.kind === "ARTICLE" && a.articleNum === b.articleNum && a.text === b.text;
    case "TABLE":
      return b.kind === "TABLE" && areTablesEqual(a.columns, a.rows, b.columns, b.rows);
  }
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * Compara duas propostas (N x N) pareando blocos primeiro por fieldId (exato para Forks)
 * e depois por (kind + rótulo normalizado) para propostas independentes.
 */
export function diffProposals(
  base: ProposalSummaryView,
  target: ProposalSummaryView
): ProposalDiffResult {
  const matchedTargetIndices = new Set<number>();
  const baseMatches = new Map<number, number>();

  // Passo 1: pareamento exato por fieldId
  for (let i = 0; i < base.fields.length; i += 1) {
    const bField = base.fields[i]!;
    const idx = target.fields.findIndex(
      (tField, tIdx) => !matchedTargetIndices.has(tIdx) && tField.fieldId === bField.fieldId
    );
    if (idx >= 0) {
      matchedTargetIndices.add(idx);
      baseMatches.set(i, idx);
    }
  }

  // Passo 2: fallback por (kind + rótulo normalizado) para propostas sem parentesco
  for (let i = 0; i < base.fields.length; i += 1) {
    if (baseMatches.has(i)) {
      continue;
    }
    const bField = base.fields[i]!;
    const bNorm = normalizeLabel(bField.label);
    const idx = target.fields.findIndex(
      (tField, tIdx) =>
        !matchedTargetIndices.has(tIdx) &&
        tField.kind === bField.kind &&
        normalizeLabel(tField.label) === bNorm
    );
    if (idx >= 0) {
      matchedTargetIndices.add(idx);
      baseMatches.set(i, idx);
    }
  }

  const entries: ProposalFieldDiffEntry[] = [];
  let identical = 0;
  let modified = 0;
  let added = 0;
  let removed = 0;

  let nextTargetCursor = 0;
  const flushAddedBefore = (limitIndex: number) => {
    while (nextTargetCursor < limitIndex) {
      if (!matchedTargetIndices.has(nextTargetCursor)) {
        const tField = target.fields[nextTargetCursor]!;
        entries.push({
          key: `add-${nextTargetCursor}-${tField.fieldId}`,
          status: "ADDED",
          baseField: null,
          targetField: tField,
        });
        added += 1;
      }
      nextTargetCursor += 1;
    }
  };

  for (let i = 0; i < base.fields.length; i += 1) {
    const bField = base.fields[i]!;
    const matchedIdx = baseMatches.get(i);
    if (matchedIdx === undefined) {
      entries.push({
        key: `rem-${i}-${bField.fieldId}`,
        status: "REMOVED",
        baseField: bField,
        targetField: null,
      });
      removed += 1;
      continue;
    }

    flushAddedBefore(matchedIdx);
    const tField = target.fields[matchedIdx]!;
    if (matchedIdx === nextTargetCursor) {
      nextTargetCursor += 1;
    }

    const isEq = areFieldsEqual(bField, tField);
    if (isEq) {
      identical += 1;
    } else {
      modified += 1;
    }
    entries.push({
      key: `pair-${i}-${matchedIdx}-${bField.fieldId}`,
      status: isEq ? "IDENTICAL" : "MODIFIED",
      baseField: bField,
      targetField: tField,
    });
  }

  flushAddedBefore(target.fields.length);

  return {
    baseDocIdHex: base.docIdHex,
    targetDocIdHex: target.docIdHex,
    titleChanged: base.title !== target.title,
    baseTitle: base.title,
    targetTitle: target.title,
    deadlineChanged: base.deadlineUnixSeconds !== target.deadlineUnixSeconds,
    baseDeadlineUnixSeconds: base.deadlineUnixSeconds,
    targetDeadlineUnixSeconds: target.deadlineUnixSeconds,
    fields: entries,
    summary: { identical, modified, added, removed },
  };
}
