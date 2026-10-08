import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const { pgQuery, mongoInsertOne } = vi.hoisted(() => ({
  pgQuery: vi.fn(),
  mongoInsertOne: vi.fn(),
}));

vi.mock("../src/db/postgres.js", () => ({
  pgPool: { query: pgQuery },
}));

vi.mock("../src/db/mongo.js", () => ({
  getMongoDb: () => ({
    collection: () => ({ insertOne: mongoInsertOne }),
  }),
}));

import { createApp } from "../src/app.js";

const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Books API (/api/books)", () => {
  it("Test 1: Un caso exitoso donde cree un libro correctamente y verifique la respuesta 201", async () => {
    const createdBook = {
      id: 1,
      title: "Cien años de soledad",
      pages: 417,
      created_at: "2026-10-08T00:00:00.000Z",
    };

    pgQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [createdBook], rowCount: 1 });
    mongoInsertOne.mockResolvedValueOnce({ insertedId: "mockedId123" });

    const res = await request(app)
      .post("/api/books")
      .send({ title: "Cien años de soledad", pages: 417 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(createdBook);
    expect(pgQuery).toHaveBeenCalled();
    expect(mongoInsertOne).toHaveBeenCalled();
  });

  it("Test 2: Un caso de error que envíe datos incompletos (sin páginas), verifique que responda estado 400 y confirme que la base de datos no fue tocada", async () => {
    const res = await request(app)
      .post("/api/books")
      .send({ title: "El Principito" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
    expect(pgQuery).not.toHaveBeenCalled();
    expect(mongoInsertOne).not.toHaveBeenCalled();
  });
});
