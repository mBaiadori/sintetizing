import type { MemberView } from "@sintetizing/domain";
import { useMemo, useState } from "react";
import { shortHex } from "../utils/format.js";
import { MaterialIcon } from "./MaterialIcon.js";

export interface SupportersCollapsibleProps {
  readonly supporterPubs: readonly string[];
  readonly members: readonly MemberView[];
  readonly myPubHex: string;
  readonly defaultExpanded?: boolean;
}

interface ResolvedSupporter {
  readonly pubHex: string;
  readonly label: string;
  readonly isMe: boolean;
}

function resolveSupporterLabel(
  pubHex: string,
  myPubHex: string,
  members: readonly MemberView[],
): string {
  const member = members.find((m) => m.pubHex === pubHex);
  if (pubHex === myPubHex) {
    return member?.displayName ? `${member.displayName} (você)` : "Você";
  }
  return member?.displayName ?? shortHex(pubHex);
}

export function SupportersCollapsible({
  supporterPubs,
  members,
  myPubHex,
  defaultExpanded = false,
}: SupportersCollapsibleProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState("");

  const resolvedSupporters = useMemo<readonly ResolvedSupporter[]>(() => {
    const items = supporterPubs.map((pubHex) => ({
      pubHex,
      label: resolveSupporterLabel(pubHex, myPubHex, members),
      isMe: pubHex === myPubHex,
    }));
    return items.sort((a, b) => {
      if (a.isMe !== b.isMe) {
        return a.isMe ? -1 : 1;
      }
      return a.label.localeCompare(b.label, "pt-BR");
    });
  }, [supporterPubs, myPubHex, members]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleSupporters = useMemo(() => {
    if (!normalizedQuery) {
      return resolvedSupporters;
    }
    return resolvedSupporters.filter(
      (item) =>
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.pubHex.toLowerCase().includes(normalizedQuery),
    );
  }, [resolvedSupporters, normalizedQuery]);

  if (supporterPubs.length === 0) {
    return null;
  }

  return (
    <div className="supporters-collapsible">
      <button
        type="button"
        className="supporters-collapsible__toggle"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="supporters-collapsible__title">
          <MaterialIcon name="groups" />
          <span className="gov-tabular">
            Ver apoiadores ({supporterPubs.length})
          </span>
        </span>
        <MaterialIcon name={expanded ? "expand_less" : "expand_more"} />
      </button>

      {expanded && (
        <div className="supporters-collapsible__body">
          <div className="supporters-collapsible__search">
            <MaterialIcon name="search" />
            <input
              type="search"
              className="supporters-collapsible__input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar apoiador..."
              aria-label="Buscar apoiador"
            />
            {searchQuery && (
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                onClick={() => setSearchQuery("")}
                aria-label="Limpar busca de apoiador"
              >
                <MaterialIcon name="close" />
              </button>
            )}
          </div>

          {visibleSupporters.length === 0 ? (
            <p className="supporters-collapsible__empty">
              Nenhum apoiador encontrado para "{searchQuery}".
            </p>
          ) : (
            <div className="supporter-list">
              {visibleSupporters.map((item) => (
                <span
                  key={item.pubHex}
                  className={
                    item.isMe
                      ? "supporter-chip supporter-chip--me"
                      : "supporter-chip"
                  }
                >
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
