import { describe, expect, it } from "vitest";
import {
  canonicalStringify,
  computeCanonicalHash,
  DefaultCryptoEngine,
  derivePersonaId,
  generateKeyPair,
  generateVrfProof,
  isValidHex128,
  isValidHex64,
  signCanonicalPayload,
  verifySignature,
  verifyVrfProof,
} from "../src/crypto/index.js";
import { ProtocolException } from "../src/types/errors.js";

describe("Crypto Module: Canonical Serialization & Hashing", () => {
  it("serializes objects deterministically regardless of key order", () => {
    const objA = { b: 2, a: 1, c: { z: 9, y: 8 } };
    const objB = { a: 1, c: { y: 8, z: 9 }, b: 2 };

    const strA = canonicalStringify(objA);
    const strB = canonicalStringify(objB);

    expect(strA).toBe(strB);
    expect(strA).toBe('{"a":1,"b":2,"c":{"y":8,"z":9}}');
  });

  it("handles arrays, null and primitives canonically", () => {
    expect(canonicalStringify([3, 2, 1])).toBe("[3,2,1]");
    expect(canonicalStringify(null)).toBe("null");
    expect(canonicalStringify("hello")).toBe('"hello"');
    expect(canonicalStringify(42)).toBe("42");
    expect(canonicalStringify(true)).toBe("true");
  });

  it("ignores undefined, functions and symbols in objects", () => {
    const obj = {
      valid: "ok",
      fn: () => {},
      undef: undefined,
      sym: Symbol("sym"),
    };
    expect(canonicalStringify(obj)).toBe('{"valid":"ok"}');
  });

  it("computes 64-character hex SHA-256 hash deterministically", () => {
    const payload1 = { title: "Proposta", votes: 5 };
    const payload2 = { votes: 5, title: "Proposta" };

    const hash1 = computeCanonicalHash(payload1);
    const hash2 = computeCanonicalHash(payload2);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);

    // Modificação de 1 caractere altera completamente o hash
    const hashModified = computeCanonicalHash({ title: "PropostB", votes: 5 });
    expect(hashModified).not.toBe(hash1);
  });
});

describe("Crypto Module: Ed25519 Keys and Signatures", () => {
  it("validates hex helper functions", () => {
    expect(isValidHex64("a".repeat(64))).toBe(true);
    expect(isValidHex64("a".repeat(63))).toBe(false);
    expect(isValidHex64("z".repeat(64))).toBe(false);

    expect(isValidHex128("b".repeat(128))).toBe(true);
    expect(isValidHex128("b".repeat(127))).toBe(false);
    expect(isValidHex128("g".repeat(128))).toBe(false);
  });

  it("generates valid Ed25519 key pairs", async () => {
    const keys = await generateKeyPair();
    expect(keys.privateKeyHex).toHaveLength(64);
    expect(keys.publicKeyHex).toHaveLength(64);
    expect(isValidHex64(keys.privateKeyHex)).toBe(true);
    expect(isValidHex64(keys.publicKeyHex)).toBe(true);
  });

  it("derives persona_id correctly from public key", async () => {
    const keys = await generateKeyPair();
    const personaId = derivePersonaId(keys.publicKeyHex);

    expect(personaId).toMatch(/^0x[a-f0-9]{40}$/);
    expect(personaId.length).toBe(42);

    // Mesma chave pública produz sempre o mesmo persona_id
    expect(derivePersonaId(keys.publicKeyHex)).toBe(personaId);
  });

  it("throws ProtocolException when deriving persona_id with invalid public key", () => {
    expect(() => derivePersonaId("invalid_key")).toThrow(ProtocolException);
    expect(() => derivePersonaId("123456")).toThrowError(/64 caracteres/);
  });

  it("signs and verifies canonical payloads successfully", async () => {
    const keys = await generateKeyPair();
    const payload = { proposalId: "urn:pfs:prop:123", vote: "YES" };

    const signature = await signCanonicalPayload(keys.privateKeyHex, payload);
    expect(signature).toHaveLength(128);
    expect(isValidHex128(signature)).toBe(true);

    const isValid = await verifySignature(keys.publicKeyHex, payload, signature);
    expect(isValid).toBe(true);
  });

  it("rejects signatures when payload is tampered", async () => {
    const keys = await generateKeyPair();
    const payload = { proposalId: "urn:pfs:prop:123", vote: "YES" };
    const signature = await signCanonicalPayload(keys.privateKeyHex, payload);

    const tamperedPayload = { proposalId: "urn:pfs:prop:123", vote: "NO" };
    const isValid = await verifySignature(keys.publicKeyHex, tamperedPayload, signature);
    expect(isValid).toBe(false);
  });

  it("rejects signatures when verified with another public key", async () => {
    const keys1 = await generateKeyPair();
    const keys2 = await generateKeyPair();
    const payload = { note: "test" };

    const signature = await signCanonicalPayload(keys1.privateKeyHex, payload);
    const isValid = await verifySignature(keys2.publicKeyHex, payload, signature);
    expect(isValid).toBe(false);
  });

  it("handles malformed public keys or signatures gracefully in verifySignature", async () => {
    const isValidShortPub = await verifySignature("123", {}, "a".repeat(128));
    expect(isValidShortPub).toBe(false);

    const isValidShortSig = await verifySignature("a".repeat(64), {}, "123");
    expect(isValidShortSig).toBe(false);

    // Payload que causa erro de serialização (referência circular) cai no catch e retorna false
    const circularObj: Record<string, unknown> = {};
    circularObj["self"] = circularObj;
    const isValidCircular = await verifySignature("a".repeat(64), circularObj, "b".repeat(128));
    expect(isValidCircular).toBe(false);
  });

  it("throws ProtocolException when signing with invalid private key", async () => {
    await expect(signCanonicalPayload("invalid_priv", { a: 1 })).rejects.toThrow(ProtocolException);
  });
});

describe("Crypto Module: VRF Deterministic Sorteio", () => {
  it("generates and verifies deterministic VRF proof", async () => {
    const keys = await generateKeyPair();
    const seed = "block-hash-genesis-12345";

    const vrf = await generateVrfProof(keys.privateKeyHex, seed);
    expect(vrf.proof).toHaveLength(128);
    expect(vrf.output).toHaveLength(64);

    const isValid = await verifyVrfProof(keys.publicKeyHex, seed, vrf.proof);
    expect(isValid).toBe(true);

    // Mesma semente e chave produzem a mesma saída determinística
    const vrfAgain = await generateVrfProof(keys.privateKeyHex, seed);
    expect(vrfAgain.output).toBe(vrf.output);
  });

  it("rejects VRF proof with modified seed or mismatched public key", async () => {
    const keys1 = await generateKeyPair();
    const keys2 = await generateKeyPair();
    const seed = "seed-original";

    const vrf = await generateVrfProof(keys1.privateKeyHex, seed);

    const isValidWrongSeed = await verifyVrfProof(keys1.publicKeyHex, "seed-tampered", vrf.proof);
    expect(isValidWrongSeed).toBe(false);

    const isValidWrongKey = await verifyVrfProof(keys2.publicKeyHex, seed, vrf.proof);
    expect(isValidWrongKey).toBe(false);
  });

  it("rejects invalid parameters in VRF verification", async () => {
    expect(await verifyVrfProof("shortKey", "seed", "proof")).toBe(false);
    expect(await verifyVrfProof("a".repeat(64), "", "b".repeat(128))).toBe(false);
    expect(await verifyVrfProof("a".repeat(64), "seed", "shortProof")).toBe(false);
  });

  it("throws ProtocolException on invalid seed or private key during VRF generation", async () => {
    await expect(generateVrfProof("invalid_key", "seed")).rejects.toThrow(ProtocolException);

    const keys = await generateKeyPair();
    await expect(generateVrfProof(keys.privateKeyHex, "")).rejects.toThrow(ProtocolException);
  });
});

describe("DefaultCryptoEngine Facade", () => {
  it("executes all crypto engine methods through the facade class", async () => {
    const engine = new DefaultCryptoEngine();
    const keys = await engine.generateKeyPair();
    expect(isValidHex64(keys.publicKeyHex)).toBe(true);

    const personaId = engine.derivePersonaId(keys.publicKeyHex);
    expect(personaId).toMatch(/^0x[a-f0-9]{40}$/);

    const payload = { hello: "world" };
    const hash = engine.computeCanonicalHash(payload);
    expect(hash).toHaveLength(64);

    const signature = await engine.signCanonicalPayload(keys.privateKeyHex, payload);
    const verified = await engine.verifySignature(keys.publicKeyHex, payload, signature);
    expect(verified).toBe(true);

    const vrf = await engine.generateVrfProof(keys.privateKeyHex, "seed1");
    const vrfVerified = await engine.verifyVrfProof(keys.publicKeyHex, "seed1", vrf.proof);
    expect(vrfVerified).toBe(true);
  });
});
