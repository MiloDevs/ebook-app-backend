import { Hono } from "hono";
import withPrisma from "../lib/prisma.js";
import type { AppEnv } from "../index.js";

const app = new Hono<AppEnv>();

app.get("/", withPrisma, async (c) => {
  try {
    const prisma = c.get("prisma");
    const authors = await prisma.author.findMany();
    return c.json({ authors });
  } catch (error) {
    return c.json({ error });
  }
});

app.post("/", withPrisma, async (c) => {
  try {
    const prisma = c.get("prisma");
    const { first_name, last_name, description, full_name } =
      await c.req.json();
    const author = await prisma.author.create({
      data: {
        first_name,
        last_name,
        full_name,
        description,
      },
    });
    return c.json({ message: "Created successfully", author });
  } catch (error) {
    return c.json({ error });
  }
});
app.get("/:id", withPrisma, async (c) => {
  try {
    const id = c.req.param("id");
    const prisma = c.get("prisma");
    const author = await prisma.author.findUnique({
      where: {
        id,
      },
    });
    return c.json({ author });
  } catch (error) {
    return c.json({ error });
  }
});
app.put("/:id", withPrisma, async (c) => {
  try {
    const id = c.req.param("id");
    const { first_name, last_name, description, full_name } =
      await c.req.json();
    const prisma = c.get("prisma");
    const author = await prisma.author.update({
      where: {
        id,
      },
      data: {
        first_name,
        last_name,
        full_name,
        description,
      },
    });
    return c.json({ author });
  } catch (error) {
    return c.json({ error });
  }
});

app.delete("/:id", withPrisma, async (c) => {
  try {
    const id = c.req.param("id");
    const prisma = c.get("prisma");
    const author = await prisma.author.delete({
      where: {
        id,
      },
    });
    return c.json({ message: "Deleted successfully", author });
  } catch (error) {
    return c.json({ error });
  }
});

export default app;
