import { BinaryDocument } from "@sintetizing/wire";
import { InspectedDocument } from "./types.js";
/**
 * Converte um BinaryDocument já verificado em uma visão legível para o Explorador de Documentos.
 */
export declare function buildInspectedDocument(docIdHex: string, byteLength: number, doc: BinaryDocument): InspectedDocument;
/**
 * Verifica um pacote binário bruto e decodifica seus blocos TLV para inspeção humana.
 */
export declare function inspectBinaryPacket(rawBytes: Uint8Array): Promise<InspectedDocument>;
//# sourceMappingURL=inspector.d.ts.map