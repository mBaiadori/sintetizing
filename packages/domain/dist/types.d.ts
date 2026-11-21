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
export type DeliberationModeKind = "QUORUM" | "OPEN";
export type ProposalStatus = "OPEN" | "CONSENSUS" | "APPROVED" | "EXPIRED";
export type ProposalFieldView = {
    readonly kind: "SUBTITLE";
    readonly fieldId: string;
    readonly label: string;
} | {
    readonly kind: "TEXT";
    readonly fieldId: string;
    readonly label: string;
    readonly text: string;
} | {
    readonly kind: "VALUE";
    readonly fieldId: string;
    readonly label: string;
    readonly amountCents: number;
    readonly unit: string;
} | {
    readonly kind: "LINK";
    readonly fieldId: string;
    readonly label: string;
    readonly url: string;
} | {
    readonly kind: "TABLE";
    readonly fieldId: string;
    readonly label: string;
    readonly columns: readonly string[];
    readonly rows: readonly (readonly string[])[];
} | {
    readonly kind: "ARTICLE";
    readonly fieldId: string;
    readonly label: string;
    readonly articleNum: number;
    readonly text: string;
};
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
    readonly activatedAtMs: number | null;
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
    readonly endorsedByPubHex: string | null;
    readonly joinedAtMs: number;
    readonly lastActivityMs: number;
    readonly status: MemberStatus;
    readonly pickCount: number;
    readonly joinDocIdHex: string;
}
export interface InvitePolicyRulesView {
    readonly bootstrapMaxMembers: number;
    readonly requiresEndorsement: boolean;
    readonly rotationWindowSize: number;
    readonly cooldownInviterPubs: readonly string[];
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
    readonly deliberationMode: DeliberationModeKind;
    readonly quorumPct: number | null;
    readonly requiredVotes: number;
    readonly deadlineUnixSeconds: number | null;
    readonly isExpired: boolean;
    readonly authorPubHex: string;
    readonly timestampMs: number;
    readonly proposalCount: number;
}
export interface ProposalSummaryView {
    readonly docIdHex: string;
    readonly scope: string;
    readonly title: string;
    readonly body: string;
    readonly fields: readonly ProposalFieldView[];
    readonly authorPubHex: string;
    readonly authorName: string | null;
    readonly parentHashHex: string | null;
    readonly timestampMs: number;
    readonly deadlineUnixSeconds: number | null;
    readonly deliberationMode: DeliberationModeKind;
    readonly quorumPct: number | null;
    readonly requiredVotes: number;
    readonly status: ProposalStatus;
    readonly isVotingOpen: boolean;
    readonly supersededByDocIdHex: string | null;
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
    readonly inviteRules: InvitePolicyRulesView;
    readonly categories: readonly CategorySummaryView[];
    readonly subjects: readonly SubjectSummaryView[];
    readonly proposals: readonly ProposalSummaryView[];
    readonly snapshots: readonly SnapshotSummaryView[];
    readonly pickHistory: readonly PickHistoryEntry[];
    readonly documents: readonly InspectedDocument[];
    readonly rejectedPacketCount: number;
}
export interface ChatMessageView {
    readonly docIdHex: string;
    readonly scope: string;
    readonly authorPubHex: string;
    readonly authorName: string | null;
    readonly body: string;
    readonly timestampMs: number;
    readonly seq: number;
    readonly referencedDraftId: string | null;
    readonly referencedProposalDocIdHex: string | null;
}
export interface SharedDraftView {
    readonly docIdHex: string;
    readonly draftId: string;
    readonly scope: string;
    readonly authorPubHex: string;
    readonly authorName: string | null;
    readonly title: string;
    readonly body: string;
    readonly fields: readonly ProposalFieldView[];
    readonly parentHashHex: string | null;
    readonly deadlineUnixSeconds: number | null;
    readonly timestampMs: number;
    readonly seq: number;
    readonly convertedToProposalDocIdHex: string | null;
    readonly convertedToProposalTitle: string | null;
    readonly convertedByPubHex: string | null;
    readonly convertedByName: string | null;
}
export interface SubjectWorkshopView {
    readonly subjectScope: string;
    readonly messages: readonly ChatMessageView[];
    readonly activeDrafts: readonly SharedDraftView[];
}
//# sourceMappingURL=types.d.ts.map