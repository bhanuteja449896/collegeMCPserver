import crypto from "crypto";
import bcrypt from "bcryptjs";

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(username, secret, expiryHours) {
  const now = Date.now();
  const expiresAt = now + expiryHours * 60 * 60 * 1000;
  const payload = JSON.stringify({
    username,
    iat: now,
    exp: expiresAt,
    nonce: crypto.randomUUID()
  });
  const encodedPayload = base64Url(payload);
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function decodeAndVerifyToken(token, secret) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = signPayload(encodedPayload, secret);
  if (signature !== expectedSignature) {
    return null;
  }

  const payloadRaw = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const payload = JSON.parse(payloadRaw);

  if (!payload.username || !payload.exp || Date.now() > payload.exp) {
    return null;
  }

  return payload;
}

export async function login(pool, username, password, sessionSecret, expiryHours) {
  const result = await pool.query(
    `SELECT id, username, role, password_hash
     FROM users
     WHERE username = $1`,
    [username]
  );

  if (!result.rowCount) {
    throw new Error("Invalid credentials");
  }

  const user = result.rows[0];
  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw new Error("Invalid credentials");
  }

  const token = createSessionToken(user.username, sessionSecret, expiryHours);

  await pool.query(
    `UPDATE users
     SET session_token = $1,
         session_expires_at = NOW() + ($2 || ' hours')::interval,
         updated_at = NOW()
     WHERE id = $3`,
    [token, String(expiryHours), user.id]
  );

  await pool.query(
    `INSERT INTO audit_logs (user_id, action, details)
     VALUES ($1, 'LOGIN', $2)`,
    [user.id, JSON.stringify({ username: user.username })]
  );

  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    sessionToken: token
  };
}

export async function requireSession(pool, token, sessionSecret, allowedRoles = []) {
  const payload = decodeAndVerifyToken(token, sessionSecret);
  if (!payload) {
    throw new Error("Invalid or expired session token. Login again.");
  }

  const result = await pool.query(
    `SELECT id, username, role, session_token, session_expires_at
     FROM users
     WHERE username = $1`,
    [payload.username]
  );

  if (!result.rowCount) {
    throw new Error("User does not exist for this token.");
  }

  const user = result.rows[0];
  if (!user.session_token || user.session_token !== token) {
    throw new Error("Session token mismatch. Login again.");
  }

  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) {
    throw new Error("Session expired. Login again.");
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(", ")}`);
  }

  return user;
}
