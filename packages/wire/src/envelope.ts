import * as ed25519 from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { decodeTLVBlocks, encodeTLVBlocks } from "./tlv.js";
import {
  BinaryDocument,
  UnsignedBinaryDocument,
  WIRE_CONSTANTS,
} from "./types.js";
import { validateDocumentStructure } from "./validators.js";

/**
 * Concatena o pré-cabeçalho (bytes 0..37: version, docType, authorPub, seq)
 * com os bytes do corpo TLV (bytes 102..fim), que compõem o payload assinado.
 */
function buildSignedPayload(
  version: number,
  docType: number,
  authorPub: Uint8Array,
  seq: number,
  tlvBytes: Uint8Array
): Uint8Array {
  const preHeaderLength = 1 + 1 + WIRE_CONSTANTS.AUTHOR_PUB_SIZE + WIRE_CONSTANTS.SEQ_SIZE; // 38 bytes
  const payload = new Uint8Array(preHeaderLength + tlvBytes.length);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

  payload[0] = version;
  payload[1] = docType;
  payload.set(authorPub, 2);
  view.setUint32(2 + WIRE_CONSTANTS.AUTHOR_PUB_SIZE, seq, false);
  payload.set(tlvBytes, preHeaderLength);

  return payload;
}

/**
 * Empacota e assina um documento no formato binário (.stze) com cabeçalho de 102 bytes e fita TLV.
 */
export async function packDocument(
  doc: UnsignedBinaryDocument,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  const version = doc.version ?? WIRE_CONSTANTS.VERSION;

  if (version !== WIRE_CONSTANTS.VERSION) {
    throw new Error(`Versão do protocolo não suportada: ${version}. Esperado: ${WIRE_CONSTANTS.VERSION}.`);
  }

  if (doc.authorPub.length !== WIRE_CONSTANTS.AUTHOR_PUB_SIZE) {
    throw new Error(
      `authorPub inválido: esperado ${WIRE_CONSTANTS.AUTHOR_PUB_SIZE} bytes, recebido ${doc.authorPub.length}.`
    );
  }

  if (privateKey.length !== 32) {
    throw new Error(`privateKey deve ter 32 bytes. Recebido: ${privateKey.length}.`);
  }

  // Validação estrita de limites de negócio dos blocos e docType antes de assinar
  validateDocumentStructure(doc.docType, doc.seq, doc.blocks);

  // Serializa a fita de blocos TLV
  const tlvBytes = encodeTLVBlocks(doc.blocks);
  const totalSize = WIRE_CONSTANTS.HEADER_SIZE + tlvBytes.length;
  if (totalSize > WIRE_CONSTANTS.MAX_PACKET_SIZE) {
    throw new Error(
      `Pacote binário excede o limite máximo de ${WIRE_CONSTANTS.MAX_PACKET_SIZE} bytes (recebido ${totalSize} bytes).`
    );
  }

  // Constrói payload assinado (pré-cabeçalho 38 bytes + tlvBytes)
  const signedPayload = buildSignedPayload(version, doc.docType, doc.authorPub, doc.seq, tlvBytes);

  // Assina com Ed25519
  const signature = await ed25519.signAsync(signedPayload, privateKey);

  // Monta pacote binário final
  const packet = new Uint8Array(WIRE_CONSTANTS.HEADER_SIZE + tlvBytes.length);
  const packetView = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);

  packet[0] = version;
  packet[1] = doc.docType;
  packet.set(doc.authorPub, 2);
  packetView.setUint32(34, doc.seq, false);
  packet.set(signature, 38);
  packet.set(tlvBytes, WIRE_CONSTANTS.HEADER_SIZE);

  return packet;
}

/**
 * Desempacota e valida na porta de entrada um pacote binário (.stze).
 * Verifica cabeçalho de 102 bytes, autenticidade da assinatura Ed25519 e limites da fita TLV.
 */
export async function unpackAndVerifyDocument(bytes: Uint8Array): Promise<BinaryDocument> {
  if (bytes.length > WIRE_CONSTANTS.MAX_PACKET_SIZE) {
    throw new Error(
      `Pacote binário excede o limite máximo de ${WIRE_CONSTANTS.MAX_PACKET_SIZE} bytes (recebido ${bytes.length} bytes).`
    );
  }

  if (bytes.length < WIRE_CONSTANTS.HEADER_SIZE) {
    throw new Error(
      `Pacote binário truncado: esperado no mínimo ${WIRE_CONSTANTS.HEADER_SIZE} bytes de cabeçalho, recebido ${bytes.length}.`
    );
  }

  const version = bytes[0]!;
  if (version !== WIRE_CONSTANTS.VERSION) {
    throw new Error(`Versão desconhecida do protocolo: ${version}. Esperado: ${WIRE_CONSTANTS.VERSION}.`);
  }

  const docType = bytes[1]!;
  const authorPub = bytes.slice(2, 34);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const seq = view.getUint32(34, false);
  const signature = bytes.slice(38, 102);
  const tlvBytes = bytes.slice(WIRE_CONSTANTS.HEADER_SIZE);

  // Reconstrói mensagem assinada
  const signedPayload = buildSignedPayload(version, docType, authorPub, seq, tlvBytes);

  // Validação estrita da assinatura Ed25519
  const isSignatureValid = await ed25519.verifyAsync(signature, signedPayload, authorPub);
  if (!isSignatureValid) {
    throw new Error("Rejeitado na porta de entrada: assinatura Ed25519 inválida ou conteúdo adulterado.");
  }

  // Decodifica a fita TLV
  const blocks = decodeTLVBlocks(tlvBytes);

  // Validação estrita dos limites dos campos e consistência do documento
  validateDocumentStructure(docType, seq, blocks);

  return {
    version,
    docType,
    authorPub,
    seq,
    signature,
    blocks,
  };
}

/**
 * Calcula deterministicamente o docId (identificador único do documento)
 * aplicando SHA-256 sobre a totalidade dos bytes do pacote.
 * Não viaja no envelope, economizando 32 bytes em todo o tráfego de rede.
 */
export function calculateDocId(bytes: Uint8Array): Uint8Array {
  return sha256(bytes);
}

/**
 * Gera um novo par de chaves Ed25519 (32B pública / 32B privada).
 */
export async function generateEd25519Keypair(): Promise<{
  readonly publicKey: Uint8Array;
  readonly privateKey: Uint8Array;
}> {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);
  return { publicKey, privateKey };
}
