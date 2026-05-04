import { Request } from 'express';

/** HttpOnly cookie name for refresh token (optional transport alongside JSON body). */
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

export type ClientSessionMeta = {
  ip_address: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
};

function pickForwardedIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim();
  }
  return undefined;
}

/**
 * Best-effort extraction from standard proxy headers and User-Agent.
 */
export function extractClientSessionMeta(req: Request): ClientSessionMeta {
  const rawIp = pickForwardedIp(req) ?? req.ip ?? req.socket?.remoteAddress;
  const ip_address = rawIp ? rawIp.slice(0, 45) : null;

  const ua = (req.headers['user-agent'] ?? '') as string;
  const browser = ua ? ua.slice(0, 64) : null;

  const deviceHeader = req.headers['sec-ch-ua-mobile'];
  const device =
    typeof deviceHeader === 'string' && deviceHeader.includes('?1')
      ? 'Mobile'
      : ua.includes('Mobile')
        ? 'Mobile'
        : 'Desktop';

  const platform = req.headers['sec-ch-ua-platform'];
  const os =
    typeof platform === 'string'
      ? platform.replace(/^"|"$/g, '').slice(0, 64)
      : null;

  return {
    ip_address,
    device: device.slice(0, 64),
    os,
    browser,
  };
}

export function readRefreshTokenFromCookie(req: Request, cookieName = REFRESH_TOKEN_COOKIE_NAME): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';').map((c) => c.trim());
  const prefix = `${cookieName}=`;
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return part.slice(prefix.length);
      }
    }
  }
  return undefined;
}
