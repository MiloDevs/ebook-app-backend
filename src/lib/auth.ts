import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "../generated/client.js";
import { expo } from "@better-auth/expo";

const prisma = new PrismaClient();

export const auth = betterAuth({
  plugins: [expo()],
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: ["ebook-app://"],
  debug: true,
  allowDangerousConnections: process.env.NODE_ENV !== "production",
  advanced: {
    disableOriginCheck: true,
  },
});