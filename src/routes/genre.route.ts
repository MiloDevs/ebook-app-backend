import { Hono } from "hono";
import withPrisma from "../lib/prisma.js";
import type { AppEnv } from "../index.js";

const app = new Hono<AppEnv>();

app.get("/", withPrisma, async (c) => {
  try {
    const prisma = c.get("prisma");
    const genres = await prisma.genre.findMany();
    return c.json({ genres });
  } catch (error) {
    return c.json({ error });
  }
});

app.post("/", withPrisma, async (c) => {
  try {
    const { title, description } = await c.req.json();
    const prisma = c.get("prisma");
    const genre = await prisma.genre.create({
      data: {
        title,
        description,
      },
    });
    return c.json({ message: "Created successfully", genre });
  } catch (error) {
    return c.json({ error });
  }
});
app.get("/:id", withPrisma, async (c) => {
  try {
    const id = c.req.param("id");
    const prisma = c.get("prisma");
    const genre = await prisma.genre.findUnique({
      where: {
        id,
      },
    });
    return c.json({ genre });
  } catch (error) {
    return c.json({ error });
  }
});
app.put("/:id", withPrisma, async (c) => {
  try {
    const id = c.req.param("id");
    const { title, description } = await c.req.json();
    const prisma = c.get("prisma");
    const genre = await prisma.genre.update({
      where: {
        id,
      },
      data: {
        title,
        description,
      },
    });
    return c.json({ genre });
  } catch (error) {
    return c.json({ error });
  }
});

app.delete("/:id", withPrisma, async (c) => {
  try {
    const id = c.req.param("id");
    const prisma = c.get("prisma");
    const genre = await prisma.genre.delete({
      where: {
        id,
      },
    });
    return c.json({ message: "Deleted successfully", genre });
  } catch (error) {
    return c.json({ error });
  }
});

export default app;
