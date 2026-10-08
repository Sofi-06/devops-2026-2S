import { Router, type Request, type Response } from "express";
import { pgPool } from "../db/postgres.js";
import { getMongoDb } from "../db/mongo.js";

export const booksRouter = Router();

// GET /api/books - Devuelve la lista de libros guardados
booksRouter.get("/", async (_req: Request, res: Response) => {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        pages INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const result = await pgPool.query(
      "SELECT id, title, pages, created_at FROM books ORDER BY id ASC"
    );

    res.json(result.rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
});

// POST /api/books - Guarda un libro si pasa la validación (PostgreSQL + MongoDB)
booksRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { title, pages } = req.body as { title?: string; pages?: number };

    // Validación: Título obligatorio y páginas > 0
    if (
      !title ||
      typeof title !== "string" ||
      !title.trim() ||
      pages === undefined ||
      pages === null ||
      typeof pages !== "number" ||
      pages <= 0
    ) {
      res.status(400).json({
        message: "El título es obligatorio y el número de páginas debe ser un número mayor a 0."
      });
      return;
    }

    // Guardar en PostgreSQL
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        pages INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const pgResult = await pgPool.query(
      `INSERT INTO books (title, pages)
       VALUES ($1, $2)
       RETURNING id, title, pages, created_at`,
      [title, pages]
    );

    // Guardar en MongoDB
    const db = getMongoDb();
    await db.collection("books").insertOne({
      title,
      pages,
      createdAt: new Date(),
    });

    res.status(201).json(pgResult.rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
});
