import { FastifyRequest, FastifyReply } from "fastify";
import jwksRsa from "jwks-rsa";
import jwt from "jsonwebtoken";

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export interface JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
  [key: string]: unknown;
}

const jwksClientCache = new Map<string, jwksRsa.JwksClient>();

function getJwksClient(jwksUri: string): jwksRsa.JwksClient {
  if (!jwksClientCache.has(jwksUri)) {
    jwksClientCache.set(
      jwksUri,
      jwksRsa({
        jwksUri,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 600_000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      }),
    );
  }
  return jwksClientCache.get(jwksUri)!;
}

async function getSigningKey(jwksUri: string, kid: string): Promise<string> {
  const client = getJwksClient(jwksUri);
  const key = await client.getSigningKey(kid);
  return key.getPublicKey();
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Missing or invalid authorization header",
    });
  }

  const token = authHeader.slice(7);
  const jwksUri = process.env.JWKS_URI;

  if (!jwksUri) {
    request.log.error("JWKS_URI not configured");
    return reply.status(500).send({
      statusCode: 500,
      error: "Internal Server Error",
      message: "Authentication service misconfigured",
    });
  }

  try {
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader || typeof decodedHeader === "string") {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid token format",
      });
    }

    const kid = decodedHeader.header.kid;
    if (!kid) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Token missing kid header",
      });
    }

    const publicKey = await getSigningKey(jwksUri, kid);
    const payload = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    }) as JwtPayload;

    request.user = payload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Token has expired",
      });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid token",
      });
    }
    request.log.error({ err }, "JWT verification error");
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Token verification failed",
    });
  }
}
