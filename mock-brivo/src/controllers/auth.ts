import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const authCodes = new Map();
const tokens = new Map();

export const authorize = (req: Request, res: Response) => {
  const { client_id, redirect_uri, state } = req.query;
  if (client_id !== process.env.CLIENT_ID) {
    return res.status(400).json({ error: 'invalid_client' });
  }
  const code = uuidv4();
  authCodes.set(code, { client_id, redirect_uri });
  const redirect = `${redirect_uri}?code=${code}${state ? `&state=${state}` : ''}`;
  return res.redirect(302, redirect);
};

export const token = (req: Request, res: Response) => {
  if (!validateApiKeyAndClientAuth(req, res)) return;

  const { grant_type } = req.body;
  switch (grant_type) {
    case 'authorization_code':
      return handleAuthorizationCode(req, res);
    case 'password':
      return handlePasswordGrant(req, res);
    case 'refresh_token':
      return handleRefreshToken(req, res);
    default:
      return res.status(400).json({ error: 'unsupported_grant_type' });
  }
};

export const redirect = (req: Request, res: Response) => {
  res.json({ code: req.query.code, state: req.query.state });
};

export function isAccessTokenValid(accessToken: string): boolean {
  for (const [, v] of tokens.entries()) {
    if (v.access_token === accessToken) return true;
  }
  return false;
}

function validateApiKeyAndClientAuth(req: Request, res: Response): boolean {
  const apiKey = req.headers['api-key'];
  if (apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: 'invalid_api_key' });
    return false;
  }
  const authHeader = req.headers['authorization'];
  const basic = Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString(
    'base64',
  );
  if (authHeader !== `Basic ${basic}`) {
    res.status(401).json({ error: 'invalid_client' });
    return false;
  }
  return true;
}

function generateTokens(refreshToken?: string) {
  const access_token = uuidv4();
  const refresh_token = refreshToken || uuidv4();
  tokens.set(refresh_token, { access_token });
  return { access_token, token_type: 'bearer', refresh_token, expires_in: process.env.ACCESS_TTL };
}

function handleAuthorizationCode(req: Request, res: Response) {
  const { code } = req.body;
  if (!authCodes.has(code)) return res.status(400).json({ error: 'invalid_code' });
  authCodes.delete(code);
  return res.json(generateTokens());
}

function handlePasswordGrant(req: Request, res: Response) {
  const { username, password } = req.body;
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'invalid_grant' });
  }
  return res.json(generateTokens());
}

function handleRefreshToken(req: Request, res: Response) {
  const { refresh_token } = req.body;
  if (!tokens.has(refresh_token)) return res.status(401).json({ error: 'invalid_refresh_token' });
  return res.json(generateTokens(refresh_token));
}
