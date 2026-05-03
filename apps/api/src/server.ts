import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { randomUUID } from "node:crypto";
import { z, ZodSchema } from "zod";
import { authMiddleware } from "./middleware/auth.js";
import { createRbacMiddleware, closePool } from "./middleware/rbac.js";

declare module "fastify" {
  interface FastifyInstance {
    validateBody: <T>(schema: ZodSchema<T>, body: unknown) => T;
  }
}

const APP_VERSION = process.env.APP_VERSION ?? "1.0.0";

async function getSecret(secretId: string): Promise<string> {
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION ?? "us-east-1",
  });
  const command = new GetSecretValueCommand({ SecretId: secretId });
  const response = await client.send(command);
  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} contains no string value`);
  }
  return response.SecretString;
}

async function loadSecretsIntoEnv(): Promise<void> {
  const dbSecretId = process.env.DB_SECRET_ID ?? "nexus/db-url";
  const jwksSecretId = process.env.JWKS_SECRET_ID ?? "nexus/jwks-uri";

  const [dbUrl, jwksUri] = await Promise.allSettled([
    getSecret(dbSecretId),
    getSecret(jwksSecretId),
  ]);

  if (dbUrl.status === "fulfilled" && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = dbUrl.value;
  }
  if (jwksUri.status === "fulfilled" && !process.env.JWKS_URI) {
    process.env.JWKS_URI = jwksUri.value;
  }
}

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            remoteAddress: req.socket?.remoteAddress,
          };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    },
    genReqId: () => randomUUID(),
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
    disableRequestLogging: true,
  });

  await server.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Nexus API",
        version: APP_VERSION,
        description: "Nexus platform REST API",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      tags: [
        { name: "health", description: "Health and readiness endpoints" },
        { name: "auth", description: "Authentication endpoints" },
      ],
    },
  });

  await server.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: false },
  });

  await server.register(fastifyRateLimit, {
    global: false,
    max: 10,
    timeWindow: "1 minute",
    keyGenerator: (req: FastifyRequest) => req.ip,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded, retry after ${context.after}`,
      retryAfter: context.after,
    }),
  });

  server.decorate(
    "validateBody",
    function <T>(schema: ZodSchema<T>, body: unknown): T {
      const result = schema.safeParse(body);
      if (!result.success) {
        const err = Object.assign(new Error("Request body validation failed"), {
          statusCode: 400,
          validation: result.error.errors,
          validationContext: "body",
        });
        throw err;
      }
      return result.data;
    },
  );

  server.addHook("onRequest", async (request: FastifyRequest) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        path: request.url,
      },
      "request received",
    );
  });

  server.addHook(
    "onResponse",
    async (request: FastifyRequest, reply: FastifyReply) => {
      request.log.info(
        {
          requestId: request.id,
          method: request.method,
          path: request.url,
          status: reply.statusCode,
          duration: reply.elapsedTime,
        },
        "request completed",
      );
    },
  );

  server.setErrorHandler(
    (error, request: FastifyRequest, reply: FastifyReply) => {
      if (error.validation) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Validation failed",
          details: error.validation,
        });
      }
      if (error.statusCode === 429) {
        return reply.status(429).send(error);
      }
      const statusCode = error.statusCode ?? 500;
      request.log.error(
        { err: error, requestId: request.id },
        "unhandled error",
      );
      return reply.status(statusCode).send({
        statusCode,
        error: error.name ?? "Internal Server Error",
        message: error.message,
      });
    },
  );

  server.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        summary: "Health check",
        response: {
          200: {
            type: "object",
            required: ["status", "version"],
            properties: {
              status: { type: "string", example: "ok" },
              version: { type: "string", example: APP_VERSION },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(200).send({ status: "ok", version: APP_VERSION });
    },
  );

  const exampleBodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

  server.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["auth"],
        summary: "Authenticate user",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              statusCode: { type: "number" },
              error: { type: "string" },
              message: { type: "string" },
              details: { type: "array" },
            },
          },
          429: {
            type: "object",
            properties: {
              statusCode: { type: "number" },
              error: { type: "string" },
              message: { type: "string" },
              retryAfter: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      server.validateBody(exampleBodySchema, request.body);
      return reply.status(200).send({ message: "Authentication endpoint" });
    },
  );

  server.get(
    "/admin/status",
    {
      preHandler: [
        authMiddleware,
        createRbacMiddleware(["admin"]),
      ],
      schema: {
        tags: ["auth"],
        summary: "Admin status (requires admin role)",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: { status: { type: "string" } },
          },
          401: {
            type: "object",
            properties: {
              statusCode: { type: "number" },
              error: { type: "string" },
              message: { type: "string" },
            },
          },
          403: {
            type: "object",
            properties: {
              statusCode: { type: "number" },
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(200).send({ status: "admin access granted" });
    },
  );

  return server;
}

export async function startServer(): Promise<FastifyInstance> {
  await loadSecretsIntoEnv();

  const server = await buildServer();

  const host = process.env.HOST ?? "0.0.0.0";
  const port = parseInt(process.env.PORT ?? "3000", 10);

  await server.listen({ host, port });
  server.log.info({ host, port }, "server listening");

  const shutdown = async (signal: string) => {
    server.log.info({ signal }, "shutdown signal received");
    await server.close();
    await closePool();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
