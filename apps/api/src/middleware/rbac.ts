import { FastifyRequest, FastifyReply } from "fastify";
import { Pool, PoolClient } from "pg";

export type Role = "admin" | "user" | (string & Record<never, never>);

let pgPool: Pool | null = null;

function getPool(): Pool {
  if (!pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pgPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pgPool;
}

async function fetchUserRoles(
  client: PoolClient,
  userId: string,
): Promise<string[]> {
  const result = await client.query<{ role: string }>(
    `SELECT r.name AS role
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId],
  );
  return result.rows.map((row) => row.role);
}

export function createRbacMiddleware(requiredRoles: Role[]) {
  return async function rbacMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const user = request.user;
    if (!user || !user.sub) {
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Authentication required before authorization",
      });
    }

    const userId = user.sub;
    let dbRoles: string[] = [];

    try {
      const pool = getPool();
      const client = await pool.connect();
      try {
        dbRoles = await fetchUserRoles(client, userId);
      } finally {
        client.release();
      }
    } catch (err) {
      request.log.error({ err, userId }, "RBAC database query failed");
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Authorization check failed",
      });
    }

    const jwtRoles: string[] =
      (user.roles as string[] | undefined) ??
      (user["https://nexus.io/roles"] as string[] | undefined) ??
      [];

    const allRoles = [...new Set([...dbRoles, ...jwtRoles])];
    const hasRequiredRole = requiredRoles.some((role) => allRoles.includes(role));

    if (!hasRequiredRole) {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: `Access denied. Required roles: ${requiredRoles.join(", ")}`,
      });
    }
  };
}

export async function closePool(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}
