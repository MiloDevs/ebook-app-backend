import { Hono } from "hono";
import withPrisma from "../lib/prisma.js";
import type { AppEnv } from "../index.js";

const app = new Hono<AppEnv>();

app.get("/", withPrisma, async (c) => {
  try {
    const prisma = c.get("prisma");
    const books = await prisma.book.findMany({
      include: {
        author: true,
        genres: true,
      },
    });
    return c.json({ books });
  } catch (error) {
    return c.json({ error });
  }
});

app.post("/", withPrisma, async (c) => {
  try {
    const prisma = c.get("prisma");
    const {
      title,
      image_url,
      file_url,
      description,
      best_selling,
      recommended,
      rating,
      genres,
      released_at,
      author_id,
    } = await c.req.json();
    const releaseDate = released_at ? new Date(released_at) : "";
    const book = await prisma.book.create({
      data: {
        title,
        image_url,
        file_url,
        description,
        best_selling,
        recommended,
        rating,
        genres: {
          connect: genres,
        },
        released_at: releaseDate,
        author_id,
      },
    });
    return c.json({ message: "Created successfully", book });
  } catch (error) {
    return c.json({ error });
  }
});
app.get("/:id", withPrisma, async (c) => {
  try {
    const id = c.req.param("id");
    const prisma = c.get("prisma");
    const book = await prisma.book.findUnique({
      where: {
        id,
      },
      include: {
        genres: {
          select: {
            id: true,
            title: true,
          },
        },
        author: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
    });
    return c.json({ book });
  } catch (error) {
    return c.json({ error });
  }
});
app.put("/:id", withPrisma, async (c) => {
  try {
    const id = c.req.param("id");
    const {
      title,
      image_url,
      file_url,
      description,
      best_selling,
      recommended,
      rating,
      genres,
      released_at,
      author_id,
    } = await c.req.json();
    const prisma = c.get("prisma");
    const updateData: any = {};
    if (title) updateData.title = title;
    if (image_url) updateData.image_url = image_url;
    if (file_url) updateData.file_url = file_url;
    if (description) updateData.description = description;
    if (best_selling !== undefined) updateData.best_selling = best_selling;
    if (recommended !== undefined) updateData.recommended = recommended;
    if (rating) updateData.rating = rating;
    if (genres) updateData.genres = genres;
    if (author_id) updateData.author_id = author_id;

    // Only convert and add released_at if it was provided in the request
    if (released_at) {
      updateData.released_at = new Date(released_at);
    }

    if (genres) {
      // The `set` operator replaces all existing relations with the ones provided.
      // Since your input is already in the correct format (array of { id: '...' } objects),
      // we can assign it directly.
      updateData.genres = { set: genres };
    }

    const book = await prisma.book.update({
      where: {
        id,
      },
      data: updateData,
    });
    return c.json({ book });
  } catch (error) {
    return c.json({ error });
  }
});

app.delete("/:id", withPrisma, async (c) => {
  try {
    const id = c.req.param("id");
    const prisma = c.get("prisma");
    const book = await prisma.book.delete({
      where: {
        id,
      },
    });
    return c.json({ message: "Deleted successfully", book });
  } catch (error) {
    return c.json({ error });
  }
});

export default app;
