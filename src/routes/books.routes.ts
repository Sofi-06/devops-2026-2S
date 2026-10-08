import { Router, type Request, type Response } from "express";
import { pgPool } from "../db/postgres.js";

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

// POST /api/books - Crea un nuevo libro
booksRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { title, pages } = req.body as { title?: string; pages?: number };

    if (!title || typeof title !== "string" || !title.trim() || pages === undefined || pages === null || typeof pages !== "number" || pages <= 0) {
      res.status(400).json({ message: "El título es obligatorio y el número de páginas debe ser un número mayor a 0." });
      return;
    }

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        pages INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const result = await pgPool.query(
      `INSERT INTO books (title, pages)
       VALUES ($1, $2)
       RETURNING id, title, pages, created_at`,
      [title, pages]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message });
  }
});
