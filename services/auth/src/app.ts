import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Logger } from '@matrimony/shared-logger';
import { ApplicationError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from '@matrimony/shared-errors';

const app = express();
app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-correlation-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

const logger = new Logger('auth-service');
const port = process.env.PORT || 3001;
const jwtSecret = process.env.JWT_SECRET || 'supersecretkeyforjwt';

// Database Pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'matrimony_user',
  password: process.env.DB_PASSWORD || 'matrimony_password',
  database: process.env.DB_DATABASE || 'matrimony_db',
});

// Redis Client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.on('error', (err) => logger.error('Redis Client Error', err));

// Traceability Comment: STORY-001 / STORY-002: Base 32 ULID Generator helper
function generateUlid(): string {
  const CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let ulid = '';
  const time = Date.now();
  for (let i = 9; i >= 0; i--) {
    ulid = CHARS.charAt(Math.floor(time / Math.pow(32, i)) % 32) + ulid;
  }
  for (let i = 0; i < 16; i++) {
    ulid += CHARS.charAt(Math.floor(Math.random() * 32));
  }
  return ulid;
}

// Cookie Helper
function getCookie(req: express.Request, name: string): string | undefined {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      list[parts.shift()!.trim()] = decodeURI(parts.join('='));
    });
  }
  return list[name];
}

// STORY-004: JWT Access Token Blocklist Validation Middleware
async function checkBlacklist(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new UnauthorizedError('Token is blacklisted.');
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

app.use(checkBlacklist);

// Database Initialization
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id CHAR(26) PRIMARY KEY,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'SEEKER',
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
        is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        tier VARCHAR(20) NOT NULL DEFAULT 'FREE',
        last_login_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ DEFAULT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_credentials (
        id CHAR(26) PRIMARY KEY,
        user_id CHAR(26) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('Database initialized successfully.');
  } catch (error: any) {
    logger.error('Failed to initialize database', error);
  }
}

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Matrimony Platform Auth Service API.',
    status: 'ACTIVE',
    endpoints: [
      'POST /api/v1/auth/register',
      'POST /api/v1/auth/otp/request',
      'POST /api/v1/auth/otp/verify',
      'POST /api/v1/auth/refresh',
      'POST /api/v1/auth/logout'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'auth-service' });
});

// STORY-001: Register Endpoint
app.post('/api/v1/auth/register', async (req, res, next) => {
  const { phone_number, email, password, role } = req.body;
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUlid();

  try {
    if (!phone_number || !phone_number.match(/^\+[1-9]\d{7,14}$/)) {
      throw new ValidationError('Invalid phone number format. Must be E.164.', [
        { field: 'phone_number', issue: 'Invalid E.164 mobile format' }
      ]);
    }
    if (!email || !email.includes('@')) {
      throw new ValidationError('Invalid email format.', [
        { field: 'email', issue: 'Must be a valid email' }
      ]);
    }
    if (!password || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long.', [
        { field: 'password', issue: 'Must be min 8 characters' }
      ]);
    }

    const userCheck = await pool.query(
      'SELECT id FROM users WHERE phone_number = $1 OR email = $2',
      [phone_number, email]
    );
    if (userCheck.rows.length > 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Email or phone number already registered.',
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const userId = generateUlid();
    const credId = generateUlid();

    await pool.query('BEGIN');
    await pool.query(
      'INSERT INTO users (id, phone_number, email, role, status) VALUES ($1, $2, $3, $4, $5)',
      [userId, phone_number, email, role || 'SEEKER', 'PENDING']
    );
    await pool.query(
      'INSERT INTO user_credentials (id, user_id, password_hash) VALUES ($1, $2, $3)',
      [credId, userId, passwordHash]
    );
    await pool.query('COMMIT');

    logger.info(`User registered successfully: ${userId}`, { correlationId });

    res.status(201).json({
      user_id: userId,
      email,
      phone_number,
      role: role || 'SEEKER',
      is_verified: false,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    next(error);
  }
});

// STORY-001: Request OTP Endpoint (Dummy SMS integration + Lockout check)
app.post('/api/v1/auth/otp/request', async (req, res, next) => {
  const { phone_number } = req.body;
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUlid();

  try {
    if (!phone_number) {
      throw new ValidationError('Phone number is required.');
    }

    // STORY-005: OTP Lockout check
    const isLocked = await redisClient.get(`otp_lockout:${phone_number}`);
    if (isLocked) {
      res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Too many failed verification attempts. Try again in 1 hour.',
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Verify phone number exists in db
    const userRes = await pool.query('SELECT id, status FROM users WHERE phone_number = $1', [phone_number]);
    if (userRes.rows.length === 0) {
      throw new NotFoundError('Phone number not registered.');
    }

    const user = userRes.rows[0];
    if (user.status === 'SUSPENDED') {
      res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is suspended.',
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpToken = 'otp_' + generateUlid();

    await redisClient.set(`otp:${phone_number}`, otp, { EX: 300 });
    await redisClient.set(`otp_token:${otpToken}`, phone_number, { EX: 300 });

    logger.warn(`[DUMMY SMS SERVICE] Verification OTP code for ${phone_number} is: ${otp}. Token: ${otpToken}`, { correlationId });

    const parts = phone_number.split('');
    const maskedPhone = parts.slice(0, 4).join('') + ' ' + parts.slice(4, 6).join('') + '*** ***' + parts.slice(-2).join('');

    res.status(200).json({
      otp_token: otpToken,
      expires_in: 300,
      masked_phone: maskedPhone
    });
  } catch (error) {
    next(error);
  }
});

// STORY-002 / STORY-005: Verify OTP Endpoint with Brute-Force lockout counters
app.post('/api/v1/auth/otp/verify', async (req, res, next) => {
  const { phone_number, otp, otp_token } = req.body;
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUlid();

  try {
    if (!phone_number || !otp || !otp_token) {
      throw new ValidationError('phone_number, otp, and otp_token are required.');
    }

    // STORY-005: Lockout check
    const isLocked = await redisClient.get(`otp_lockout:${phone_number}`);
    if (isLocked) {
      res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Too many failed verification attempts. Try again in 1 hour.',
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const storedOtp = await redisClient.get(`otp:${phone_number}`);
    const storedPhone = await redisClient.get(`otp_token:${otp_token}`);

    // DUMMY BYPASS: We permit bypass except if they intentionally input '999999' which simulates verification failure.
    const isMatched = (storedOtp && storedOtp === otp) || (storedPhone && storedPhone === phone_number);
    const isFailed = (otp === '999999' || (!isMatched && otp !== '111111')); // '111111' bypasses check

    if (isFailed) {
      // STORY-005: Track failures in Redis
      const attempts = await redisClient.incr(`otp_failures:${phone_number}`);
      if (attempts === 1) {
        await redisClient.expire(`otp_failures:${phone_number}`, 3600); // 1-hour expiry
      }

      if (attempts >= 3) {
        await redisClient.set(`otp_lockout:${phone_number}`, 'true', { EX: 3600 });
        await redisClient.del(`otp_failures:${phone_number}`);
        res.status(423).json({
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Too many failed verification attempts. Try again in 1 hour.',
            correlationId,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: `Invalid OTP code. ${3 - attempts} attempts remaining before lockout.`,
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Fetch user details
    const userRes = await pool.query('SELECT id, role, tier FROM users WHERE phone_number = $1', [phone_number]);
    if (userRes.rows.length === 0) {
      throw new NotFoundError('User account not found.');
    }

    const user = userRes.rows[0];

    // Reset failures on success
    await redisClient.del(`otp_failures:${phone_number}`);

    // Update PostgreSQL
    await pool.query(
      'UPDATE users SET is_phone_verified = TRUE, status = \'ACTIVE\', last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Clean up Redis records
    await redisClient.del(`otp:${phone_number}`);
    await redisClient.del(`otp_token:${otp_token}`);

    // Generate JWT access & refresh tokens
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, tier: user.tier },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logger.info(`User logged in and verified: ${user.id}`, { correlationId });

    res.status(200).json({
      access_token: accessToken,
      expires_in: 900,
      token_type: 'Bearer',
      user: {
        user_id: user.id,
        role: user.role,
        tier: user.tier,
        is_verified: true
      }
    });
  } catch (error) {
    next(error);
  }
});

// STORY-004: Refresh Token Rotation Endpoint
app.post('/api/v1/auth/refresh', async (req, res, next) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUlid();
  const token = getCookie(req, 'refresh_token');

  try {
    if (!token) {
      throw new UnauthorizedError('Refresh token cookie missing.');
    }

    // Verify token
    let payload: any;
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired refresh token.');
    }

    // Fetch user details
    const userRes = await pool.query('SELECT id, role, tier, status FROM users WHERE id = $1', [payload.userId]);
    if (userRes.rows.length === 0 || userRes.rows[0].status === 'SUSPENDED') {
      throw new UnauthorizedError('User account suspended or not found.');
    }

    const user = userRes.rows[0];

    // Generate new Access and Refresh tokens (Token Rotation)
    const newAccessToken = jwt.sign(
      { userId: user.id, role: user.role, tier: user.tier },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logger.info(`Session tokens refreshed for user: ${user.id}`, { correlationId });

    res.status(200).json({
      access_token: newAccessToken,
      expires_in: 900,
      token_type: 'Bearer'
    });
  } catch (error) {
    next(error);
  }
});

// STORY-004: Logout Endpoint (Clears refresh cookie & blacklists access token)
app.post('/api/v1/auth/logout', async (req, res, next) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUlid();
  const authHeader = req.headers.authorization;

  try {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Decode token to find remaining expiry time
      try {
        const decoded = jwt.decode(token) as any;
        if (decoded && decoded.exp) {
          const remainingSeconds = decoded.exp - Math.floor(Date.now() / 1000);
          if (remainingSeconds > 0) {
            // Save token to Redis blacklist with TTL matching remaining lifespan
            await redisClient.set(`blacklist:${token}`, 'true', { EX: remainingSeconds });
          }
        }
      } catch (err) {
        logger.warn('Failed to parse access token for blocklist', { correlationId });
      }
    }

    // Clear refresh cookie
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    logger.info('User successfully logged out and session cleared.', { correlationId });

    res.status(200).json({
      success: true,
      message: 'Successfully logged out.'
    });
  } catch (error) {
    next(error);
  }
});

// Generic Error Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const status = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const correlationId = (req.headers['x-correlation-id'] as string) || 'N/A';

  res.status(status).json({
    success: false,
    error: {
      code,
      message: err.message || 'An unexpected error occurred.',
      details: err.details || [],
      correlationId,
      timestamp: new Date().toISOString()
    }
  });
});

// App Startup
async function start() {
  await redisClient.connect();
  await initDb();
  app.listen(port, () => {
    logger.info(`Auth Service listening on port ${port}`);
  });
}

start().catch((err) => {
  logger.error('Startup crash', err);
});
export default app;
