import type { DocUniverse, InvitePolicyValue } from "@sintetizing/wire";
export interface DecodedBlockView {
    readonly tag: number;
    readonly tagName: string;
    readonly byteLength: number;
    readonly displayValue: string;
}
export interface InspectedDocument {
    readonly docIdHex: string;
    readonly universe: DocUniverse;
    readonly docType: number;
    readonly docTypeLabel: string;
    readonly authorPubHex: string;
    readonly seq: number;
    readonly byteLength: number;
    readonly scope: string | null;
    readonly timestampMs: number | null;
    readonly parentHashHex: string | null;
    readonly blocks: readonly DecodedBlockView[];
}
export type ConfigVersionStatus = "ACTIVE" | "SUPERSEDED" | "PENDING";
export interface CommunityConfigVersion {
    readonly docIdHex: string;
    readonly versionIndex: number;
    readonly parentHashHex: string | null;
    readonly authorPubHex: string;
    readonly scope: string;
    readonly title: string;
    readonly body: string;
    readonly quorumPct: number;
    readonly inactivityDays: number;
    readonly invitePolicy: InvitePolicyValue;
    readonly parentCommunityHashHex: string | null;
    readonly timestampMs: number;
    readonly supportCount: number;
    readonly supporterPubs: readonly string[];
    readonly requiredSupports: number;
    readonly status: ConfigVersionStatus;
}
export type MemberStatus = "ACTIVE" | "INACTIVE" | "LEFT";
export interface MemberView {
    readonly pubHex: string;
    readonly displayName: string | null;
    readonly isFounder: boolean;
    readonly invitedByPubHex: string | null;
    readonly joinedAtMs: number;
    readonly lastActivityMs: number;
    readonly status: MemberStatus;
    readonly pickCount: number;
    readonly joinDocIdHex: string;
}
export interface CategorySummaryView {
    readonly docIdHex: string;
    readonly scope: string;
    readonly title: string;
    readonly body: string;
    readonly authorPubHex: string;
    readonly timestampMs: number;
    readonly subjectCount: number;
}
export interface SubjectSummaryView {
    readonly scope: string;
    readonly docIdHex: string;
    readonly categoryHashHex: string | null;
    readonly title: string;
    readonly body: string;
    readonly quorumPct: number;
    readonly deadlineUnixSeconds: number | null;
    readonly authorPubHex: string;
    readonly timestampMs: number;
    readonly proposalCount: number;
}
export interface ProposalSummaryView {
    readonly docIdHex: string;
    readonly scope: string;
    readonly title: string;
    readonly body: string;
    readonly authorPubHex: string;
    readonly authorName: string | null;
    readonly parentHashHex: string | null;
    readonly timestampMs: number;
    readonly pickCount: number;
    readonly supporterPubs: readonly string[];
}
export interface SnapshotSummaryView {
    readonly docIdHex: string;
    readonly authorPubHex: string;
    readonly timestampMs: number;
    readonly cutoffHashHex: string;
    readonly activeCmntHashHex: string;
    readonly memberCount: number;
    readonly cosignatureCount: number;
}
export interface PickHistoryEntry {
    readonly docIdHex: string;
    readonly kind: "PROPOSAL" | "COMMUNITY";
    readonly scope: string;
    readonly authorPubHex: string;
    readonly targetHashHex: string;
    readonly targetTitle: string | null;
    readonly seq: number;
    readonly timestampMs: number;
}
export interface CommunityProjection {
    readonly communityId: string;
    readonly activeConfig: CommunityConfigVersion | null;
    readonly configVersions: readonly CommunityConfigVersion[];
    readonly members: readonly MemberView[];
    readonly activeMemberCount: number;
    readonly categories: readonly CategorySummaryView[];
    readonly subjects: readonly SubjectSummaryView[];
    readonly proposals: readonly ProposalSummaryView[];
    readonly snapshots: readonly SnapshotSummaryView[];
    readonly pickHistory: readonly PickHistoryEntry[];
    readonly documents: readonly InspectedDocument[];
    readonly rejectedPacketCount: number;
}
//# sourceMappingURL=types.d.ts.map