import { DocUniverse } from "@sintetizing/wire";
import { type Event } from "nostr-tools";
/**
 * Evento regular (imutável) reservado para pacotes TLV assinados do Sintetize.
 */
export declare const SINTETIZE_NOSTR_KIND = 4545;
export interface DecodedNostrPacket {
    readonly eventId: string;
    readonly createdAt: number;
    readonly nostrPubkey: string;
    readonly communityId: string;
    readonly universe: DocUniverse;
    readonly docIdHex: string;
    readonly rawBytes: Uint8Array;
}
export interface EncodedNostrPacket {
    readonly event: Event;
    readonly docIdHex: string;
    readonly universe: DocUniverse;
}
export interface InvitePayload {
    readonly communityId: string;
    readonly proofBytes: Uint8Array;
    readonly relays: readonly string[];
}
export declare function bytesToBase64(bytes: Uint8Array): string;
export declare function base64ToBytes(b64: string): Uint8Array;
/**
 * Deriva deterministicamente uma chave secp256k1 por comunidade para o envelope Nostr,
 * evitando correlação pública entre comunidades enquanto mantém a identidade Ed25519 soberana.
 */
export declare function deriveNostrSecretKey(ed25519PrivateKey: Uint8Array, communityId: string): Uint8Array;
/**
 * Empacota um documento binário TLV assinado dentro de um evento Nostr NIP-01.
 */
export declare function encodePacketToNostrEvent(rawPacket: Uint8Array, communityId: string, ed25519PrivateKey: Uint8Array): Promise<EncodedNostrPacket>;
/**
 * Decodifica e valida um evento Nostr (NIP-01 + teto 100 KB + SHA-256 + Ed25519 + TLV).
 */
export declare function decodeAndVerifyNostrEvent(event: Event): Promise<DecodedNostrPacket | null>;
export declare function deriveNostrPubkeyHex(ed25519PrivateKey: Uint8Array, communityId: string): string;
/**
 * Codifica um convite assinado (communityId + 116B INVITE_PROOF + relays) para compartilhamento fácil.
 */
export declare function encodeInviteCode(input: InvitePayload): string;
/**
 * Decodifica uma string stze-inv:... validando estrutura e tamanho da prova binária.
 */
export declare function decodeInviteCode(rawCode: string): InvitePayload;
//# sourceMappingURL=nostr-codec.d.ts.map