import { describe, expect, it } from "vitest";
import { hashPassword, isAdminBootstrapConfigured, verifyAdminBootstrapCode, verifyPassword } from "../_core/localAuth";
import { calculateStudyStreak } from "../services/achievements";

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

describe("autenticação local", () => {
  it("só aceita um código de bootstrap longo configurado no servidor", () => {
    const original = process.env.ADMIN_BOOTSTRAP_CODE;
    try {
      const secret = `bootstrap-test-${"x".repeat(32)}`;
      process.env.ADMIN_BOOTSTRAP_CODE = secret;
      expect(isAdminBootstrapConfigured()).toBe(true);
      expect(verifyAdminBootstrapCode(secret)).toBe(true);
      expect(verifyAdminBootstrapCode(`${secret}-wrong`)).toBe(false);
      process.env.ADMIN_BOOTSTRAP_CODE = "short";
      expect(isAdminBootstrapConfigured()).toBe(false);
      expect(verifyAdminBootstrapCode("short")).toBe(false);
    } finally {
      if (original === undefined) delete process.env.ADMIN_BOOTSTRAP_CODE;
      else process.env.ADMIN_BOOTSTRAP_CODE = original;
    }
  });

  it("armazena senha derivada e verifica apenas a senha correspondente", async () => {
    const encoded = await hashPassword("senha-forte-123");
    expect(encoded.split("$")).toHaveLength(3);
    expect(encoded.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("senha-forte-123", encoded)).resolves.toBe(true);
    await expect(verifyPassword("outra-senha-456", encoded)).resolves.toBe(false);
  });

  it("rejeita hashes ausentes ou malformados", async () => {
    await expect(verifyPassword("anything", null)).resolves.toBe(false);
    await expect(verifyPassword("anything", "invalid")).resolves.toBe(false);
  });
});

describe("sequência de estudo", () => {
  it("calcula dias consecutivos a partir de hoje", () => {
    expect(calculateStudyStreak([daysAgo(0), daysAgo(1), daysAgo(2)])).toBe(3);
  });
  it("aceita uma sequência iniciada ontem quando ainda não houve sessão hoje", () => {
    expect(calculateStudyStreak([daysAgo(1), daysAgo(2)])).toBe(2);
  });
  it("ignora dias desconectados da sequência atual", () => {
    expect(calculateStudyStreak([daysAgo(0), daysAgo(2), daysAgo(3)])).toBe(1);
  });
});
