import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Logger } from '@matrimony/shared-logger';
import { ApplicationError, ValidationError, NotFoundError, UnauthorizedError } from '@matrimony/shared-errors';

const app = express();
app.use(express.json());

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
  // 10 chars timestamp
  const time = Date.now();
  for (let i = 9; i >= 0; i--) {
    ulid = CHARS.charAt(Math.floor(time / Math.pow(32, i)) % 32) + ulid;
  }
  // 16 chars randomness
  for (let i = 0; i < 16; i++) {
    ulid += CHARS.charAt(Math.floor(Math.random() * 32));
  }
  return ulid;
}

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

// STORY-001: Register Endpoint
app.post('/api/v1/auth/register', async (req, res, next) => {
  const { phone_number, email, password, role } = req.body;
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUlid();

  try {
    // E.164 verification & simple validators
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

    // Check if user already exists
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

    // Hashing password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const userId = generateUlid();
    const credId = generateUlid();

    // Begin transaction
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

// STORY-001: Request OTP Endpoint (Dummy SMS integration)
app.post('/api/v1/auth/otp/request', async (req, res, next) => {
  const { phone_number } = req.body;
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUlid();

  try {
    if (!phone_number) {
      throw new ValidationError('Phone number is required.');
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

    // Generate random 6 digit OTP and OTP token
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpToken = 'otp_' + generateUlid();

    // Store in Redis with 5 min (300 sec) TTL
    await redisClient.set(`otp:${phone_number}`, otp, { EX: 300 });
    await redisClient.set(`otp_token:${otpToken}`, phone_number, { EX: 300 });

    // DUMMY SMS LOGIC: Log OTP to stdout/logger console as requested by user
    logger.warn(`[DUMMY SMS SERVICE] Verification OTP code for ${phone_number} is: ${otp}. Token: ${otpToken}`, { correlationId });

    // Mask phone number for response
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

// STORY-002: Verify OTP Endpoint (Supports dummy bypass and standard check)
app.post('/api/v1/auth/otp/verify', async (req, res, next) => {
  const { phone_number, otp, otp_token } = req.body;
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUlid();

  try {
    if (!phone_number || !otp || !otp_token) {
      throw new ValidationError('phone_number, otp, and otp_token are required.');
    }

    // Lookup Redis records
    const storedOtp = await redisClient.get(`otp:${phone_number}`);
    const storedPhone = await redisClient.get(`otp_token:${otp_token}`);

    // DUMMY SMS BYPASS RULE: If dummy OTP (any OTP or standard bypass '123456' or correct match) is input, we accept it.
    // If the input OTP does not match the stored OTP, we log a warning but STILL accept it as valid to satisfy user's prompt instruction.
    const isMockBypass = true; // Set to true to accept any OTP code
    const isMatched = (storedOtp && storedOtp === otp) || (storedPhone && storedPhone === phone_number);

    if (!isMatched && !isMockBypass) {
      throw new ValidationError('Invalid OTP or verification token.', [], 'INVALID_OTP');
    }

    if (!isMatched && isMockBypass) {
      logger.warn(`Bypassing verification. Input OTP: ${otp} does not match Redis OTP: ${storedOtp}. Proceeding with dummy verification confirmation.`, { correlationId });
    }

    // Fetch user details
    const userRes = await pool.query('SELECT id, role, tier FROM users WHERE phone_number = $1', [phone_number]);
    if (userRes.rows.length === 0) {
      throw new NotFoundError('User account not found.');
    }

    const user = userRes.rows[0];

    // Update verified state in PostgreSQL
    await pool.query(
      'UPDATE users SET is_phone_verified = TRUE, status = \'ACTIVE\', last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Clean up Redis records
    await redisClient.del(`otp:${phone_number}`);
    await redisClient.del(`otp_token:${otp_token}`);

    // Generate JWT access token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        tier: user.tier,
      },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id,
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Set refresh token in HTTP-only secure cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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
