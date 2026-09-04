import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { INestApplication, Logger, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../src/prisma/prisma.service.js";
import { AppModule } from "../../src/app.module.js";
import { FIREBASE_AUTH } from "../../src/auth/firebase-admin.provider.js";
import request from "supertest";

const VALID_TOKEN = "integration.fake.token";
const stubAuth = {
  verifyIdToken: async (token: string) => ({ uid: token === VALID_TOKEN ? "e2e-user" : "other-user", email: "e2e@example.com" }),
};

const apiPath = (route: string) => `/api${route}`;
const HEADERS = { Authorization: `Bearer ${VALID_TOKEN}` };
let appRef: ReturnType<NonNullable<INestApplication["getHttpServer"]>>;

const publicGet = (route: string) => request(appRef).get(apiPath(route));
const authed = () => {
  const r: ReturnType<typeof request> = request(appRef);
  return {
    get: (url: string) => r.get(apiPath(url)).set(HEADERS),
    post: (url: string, body?: object) => r.post(apiPath(url)).set(HEADERS).send(body ?? {}),
    patch: (url: string, body?: object) => r.patch(apiPath(url)).set(HEADERS).send(body ?? {}),
  };
};
const anonymous = (route: string) => request(appRef).get(apiPath(route));

describe("API e2e integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createdProblemIds: number[] = [];
  let patternId = 0;
  let storyId = 0;
  let stagedId = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FIREBASE_AUTH)
      .useValue(stubAuth)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" });
    app.useLogger(new Logger("E2E", { timestamp: false }));
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    appRef = app.getHttpServer();
    prisma = app.get(PrismaService);
    const pattern = await prisma.pattern.findFirst({ orderBy: { id: "asc" } });
    patternId = pattern?.id ?? 1;
  });

  afterAll(async () => {
    if (createdProblemIds.length) {
      const ids = { in: createdProblemIds };
      await prisma.solution.deleteMany({ where: { problemId: ids } } as never);
      await prisma.revisionLog.deleteMany({ where: { problemId: ids } } as never);
      await prisma.problemPattern.deleteMany({ where: { problemId: ids } } as never);
      await prisma.oAStory.deleteMany({ where: { closestLcProblemId: ids } } as never);
      await prisma.problem.deleteMany({ where: { id: ids } } as never);
    }
    if (storyId) await prisma.oAStory.delete({ where: { id: storyId } }).catch(() => undefined);
    if (stagedId) await prisma.ingestionStaging.delete({ where: { id: stagedId } }).catch(() => undefined);
    await app.close();
  });

  it("GET /health responds ok (public)", async () => {
    const res = await publicGet("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("rejects protected routes without a Bearer token", async () => {
    await anonymous("/patterns").expect(401);
  });

  it("GET /patterns lists seeded patterns", async () => {
    const res = await authed().get("/patterns").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(17);
    expect(res.body[0]).toHaveProperty("name");
    expect(res.body[0]).toHaveProperty("_count");
  });

  it("GET /dashboard/stats returns aggregate stats", async () => {
    const res = await authed().get("/dashboard/stats").expect(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("solved");
    expect(res.body).toHaveProperty("completionPercent");
  });

  it("POST /problems then GET /problems/:id returns created problem", async () => {
    const create = await authed().post("/problems", { title: `E2E Problem ${Date.now()}`, primaryPatternId: patternId, difficulty: "Medium", status: "Todo" }).expect(201);
    expect(create.body).toHaveProperty("id");
    createdProblemIds.push(create.body.id as number);

    const get = await authed().get(`/problems/${create.body.id}`).expect(200);
    expect(get.body.id).toBe(create.body.id);
    expect(get.body.title).toContain("E2E Problem");
    expect(get.body.primaryPattern.id).toBe(patternId);
  });

  it("PATCH /problems/:id updates status", async () => {
    const create = await authed().post("/problems", { title: `E2E Update ${Date.now()}`, primaryPatternId: patternId, status: "Todo" }).expect(201);
    createdProblemIds.push(create.body.id as number);

    const patch = await authed().patch(`/problems/${create.body.id}`, { status: "Solved", confidence: 4 }).expect(200);
    expect(patch.body.status).toBe("Solved");
    expect(patch.body.confidence).toBe(4);
  });

  it("revision: queues unattempted problems, reviews one, and returns a recap", async () => {
    const create = await authed().post("/problems", { title: `E2E Revision ${Date.now()}`, primaryPatternId: patternId, status: "Attempted", confidence: 3 }).expect(201);
    createdProblemIds.push(create.body.id as number);
    const problemId = create.body.id as number;

    const queue = await authed().get("/revision/queue").expect(200);
    expect(Array.isArray(queue.body)).toBe(true);
    expect(queue.body.some((p: { id: number }) => p.id === problemId)).toBe(true);

    const review = await authed().post(`/revision/${problemId}/review`, { confidenceAtReview: 5 }).expect(201);
    expect(review.body.nextReviewDue).toBeDefined();
    expect(review.body.problem.id).toBe(problemId);
    expect(review.body.problem.timesRevisited).toBe(1);
    expect(review.body.problem.status).toBe("Solved");

    const recap = await authed().get(`/revision/daily-recap?date=${new Date().toISOString().slice(0, 10)}`).expect(200);
    expect(recap.body.reviewedCount).toBeGreaterThanOrEqual(1);
  }, { timeout: 20_000 });

  it("oa-stories: creates and lists a story", async () => {
    const create = await authed().post("/oa-stories", { storySummary: "E2E summary", company: "E2E Corp", roleLevel: "sde1", sourcePlatform: "reddit" }).expect(201);
    expect(create.body.id).toBeGreaterThan(0);
    storyId = create.body.id as number;

    const list = await authed().get("/oa-stories?company=E2E").expect(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
  });

  it("ingestion: stages a row, lists it, promotes it, and removes the staging row", async () => {
    const staged = await prisma.ingestionStaging.create({
      data: { sourcePlatform: "reddit", sourceLink: `https://reddit.com/r/leetcode/${Date.now()}`, rawTitle: "E2E staged", rawExcerpt: "excerpt" },
    });
    stagedId = staged.id;

    const list = await authed().get("/ingestion/staging").expect(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);

    const promote = await authed().post(`/ingestion/staging/${staged.id}/promote`, { storySummary: "Promoted E2E summary", company: "E2E", roleLevel: "fresher" }).expect(201);
    expect(promote.body).toHaveProperty("id");
    expect(promote.body.storySummary).toBe("Promoted E2E summary");
    expect(promote.body.sourcePlatform).toBe("reddit");
    storyId = promote.body.id as number;
    stagedId = 0;

    const gone = await prisma.ingestionStaging.findUnique({ where: { id: staged.id } });
    expect(gone).toBeNull();
  }, { timeout: 20_000 });

  it("returns 400 on invalid payloads", async () => {
    await authed().post("/problems", { title: "Missing pattern id" }).expect(400);
    await authed().post("/problems", { title: "Bad confidence", primaryPatternId: patternId, confidence: 99 }).expect(400);
    await authed().post("/problems", { title: "Unknown pattern", primaryPatternId: 99999999 }).expect(400);
  });

  it("returns 404 for missing records", async () => {
    await authed().get("/problems/9999999").expect(404);
    await authed().get("/oa-stories/9999999").expect(404);
    await authed().post("/revision/9999999/review", { confidenceAtReview: 3 }).expect(404);
  });

  it("exports all data as JSON", async () => {
    const res = await authed().get("/export").expect(200);
    expect(res.body).toHaveProperty("problems");
    expect(res.body).toHaveProperty("oaStories");
    expect(res.body).toHaveProperty("exportedAt");
  });

  if (process.env.LEETCODE_API_URL) {
    describe("LeetCode integration (requires leetcode-api container)", () => {
      const USER = encodeURIComponent("alfaarghya");

      it("GET /leetcode/daily returns the daily problem", async () => {
        const res = await authed().get("/leetcode/daily").expect(200);
        expect(res.body).toHaveProperty("question");
      });

      it("GET /leetcode/discussions/trending returns discussions", async () => {
        const res = await authed().get("/leetcode/discussions/trending?first=3").expect(200);
        expect(Array.isArray(res.body.cachedTrendingCategoryTopics)).toBe(true);
        expect(res.body.cachedTrendingCategoryTopics.length).toBe(3);
      });

      it("GET /leetcode/user/:username returns solve stats", async () => {
        const res = await authed().get(`/leetcode/user/${USER}`).expect(200);
        expect(typeof res.body.totalSolved).toBe("number");
      });

      it("GET /leetcode/user/:username/solved returns solve counts", async () => {
        const res = await authed().get(`/leetcode/user/${USER}/solved`).expect(200);
        expect(res.body).toHaveProperty("solvedProblem");
      });

      it("maps an unknown user to 404", async () => {
        await authed().get("/leetcode/user/definitely-not-a-real-leetcode-user-xyz123").expect(404);
      });
    });
  }
});