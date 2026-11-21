import type { DocUniverse } from "@sintetizing/wire";

export interface LocalIdentity {
  readonly id: "self";
  readonly displayName: string;
  readonly publicKey: Uint8Array;
  readonly privateKey: Uint8Array;
  readonly publicKeyHex: string;
  readonly createdAtMs: number;
}

export interface CommunityRecord {
  readonly communityId: string;
  readonly title: string;
  readonly relays: readonly string[];
  readonly createdAtMs: number;
}

export interface StoredPacketRecord {
  readonly docIdHex: string;
  readonly communityId: string;
  readonly universe: DocUniverse;
  readonly docType: number;
  readonly authorPubHex: string;
  readonly seq: number;
  readonly rawBytes: Uint8Array;
  readonly storedAtMs: number;
}

export interface SavePacketResult {
  readonly docIdHex: string;
  readonly universe: DocUniverse;
  readonly isNew: boolean;
}

export interface LocalStoreOptions {
  readonly dbName?: string;
  readonly indexedDB?: IDBFactory;
}

export type DraftFieldInput =
  | { readonly kind: "SUBTITLE"; readonly fieldId: string; readonly label: string }
  | { readonly kind: "TEXT"; readonly fieldId: string; readonly label: string; readonly text: string }
  | { readonly kind: "VALUE"; readonly fieldId: string; readonly label: string; readonly amountCents: number; readonly unit: string }
  | { readonly kind: "LINK"; readonly fieldId: string; readonly label: string; readonly url: string }
  | { readonly kind: "TABLE"; readonly fieldId: string; readonly label: string; readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] }
  | { readonly kind: "ARTICLE"; readonly fieldId: string; readonly label: string; readonly articleNum: number; readonly text: string };

export interface ProposalDraftRecord {
  readonly draftId: string;
  readonly communityId: string;
  readonly subjectScope: string;
  readonly parentHashHex: string | null;
  readonly title: string;
  readonly body: string;
  readonly deadlineUnixSeconds: number | null;
  readonly fields: readonly DraftFieldInput[];
  readonly updatedAtMs: number;
}

export interface HiddenDocRecord {
  readonly docIdHex: string;
  readonly communityId: string;
  readonly kind: "SUBJECT" | "PROPOSAL";
  readonly hiddenAtMs: number;
}

export interface StoredChatFileRecord {
  readonly subjectScope: string;
  readonly communityId: string;
  readonly rawChatBytes: Uint8Array;
  readonly messageCount: number;
  readonly activeDraftCount: number;
  readonly updatedAtMs: number;
}
