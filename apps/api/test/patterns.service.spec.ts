import { describe, expect, it } from "bun:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { PatternsService } from "../src/patterns/patterns.service.js";

describe("PatternsService", () => {
  it("rejects deletion when the pattern has linked problems", async () => {
    const prisma = { pattern: { findUnique: async () => ({ id: 4, name: "Graphs", _count: { primaryProblems: 1, secondaryProblems: 0 } }) } };
    const service = new PatternsService(prisma as never);
    await expect(service.remove(4)).rejects.toBeInstanceOf(ConflictException);
  });
  it("reports a missing pattern", async () => {
    const prisma = { pattern: { findUnique: async () => null } };
    const service = new PatternsService(prisma as never);
    await expect(service.findOne(42)).rejects.toBeInstanceOf(NotFoundException);
  });
});
