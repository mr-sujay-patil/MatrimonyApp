import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { Logger } from '@matrimony/shared-logger';
import {
  ApplicationError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from '@matrimony/shared-errors';

const app = express();
app.use(express.json());

const logger = new Logger('media-service');
const port = process.env.PORT || 3008;
const jwtSecret = process.env.JWT_SECRET || 'supersecretkeyforjwt';

// Database Pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'matrimony_user',
  password: process.env.DB_PASSWORD || 'matrimony_password',
  database: process.env.DB_DATABASE || 'matrimony_db',
});

// Traceability Comment: STORY-015 - Base 32 ULID Generator helper
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

function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token is missing or invalid.');
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtSecret) as any;
    (req as any).user = decoded;
    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired token.'));
  }
}

// Database Schema Setup (STORY-015)
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create ENUMs
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_visibility') THEN
          CREATE TYPE photo_visibility AS ENUM ('PUBLIC', 'MATCHES_ONLY', 'PRIVATE');
        END IF;
      END $$;
    `);

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS photos (
        id CHAR(26) PRIMARY KEY,
        profile_id CHAR(26) NOT NULL,
        s3_bucket VARCHAR(100) NOT NULL,
        s3_key VARCHAR(500) UNIQUE NOT NULL,
        cdn_url VARCHAR(500) NOT NULL,
        thumbnail_key VARCHAR(500) DEFAULT NULL,
        thumbnail_url VARCHAR(500) DEFAULT NULL,
        file_size_bytes INTEGER NOT NULL,
        mime_type VARCHAR(50) NOT NULL,
        width_px SMALLINT DEFAULT NULL,
        height_px SMALLINT DEFAULT NULL,
        visibility photo_visibility NOT NULL DEFAULT 'PUBLIC',
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order SMALLINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        CONSTRAINT ck_photos_file_size CHECK (file_size_bytes BETWEEN 1 AND 5242880)
      );
    `);

    // Create Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_photos_profile_id ON photos(profile_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_photos_profile_id_primary ON photos(profile_id, is_primary);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_photos_profile_id_visibility ON photos(profile_id, visibility);');

    await client.query('COMMIT');
    logger.info('Media database tables and schemas initialized.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    logger.error('Failed to initialize Media database', err);
  } finally {
    client.release();
  }
}

// 8.1 Upload Photo (or fetch presigned upload destination) (STORY-015)
app.post('/api/v1/media/upload-url', authenticateToken, async (req, res, next) => {
  const { profile_id, mime_type, file_size_bytes } = req.body;
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUlid();

  try {
    if (!profile_id) {
      throw new ValidationError('profile_id is required.', [{ field: 'profile_id', issue: 'Required' }]);
    }
    if (!mime_type || !['image/jpeg', 'image/png', 'image/webp'].includes(mime_type)) {
      throw new ValidationError('Invalid mime type.', [{ field: 'mime_type', issue: 'Must be image/jpeg, image/png, or image/webp' }]);
    }
    if (!file_size_bytes || file_size_bytes > 5242880) {
      throw new ValidationError('Invalid file size.', [{ field: 'file_size_bytes', issue: 'Must be between 1 and 5MB' }]);
    }

    const photoId = generateUlid();
    const s3Bucket = 'matrimony-media-bucket';
    const s3Key = `photos/${profile_id}/${photoId}.${mime_type.split('/')[1]}`;
    const cdnUrl = `https://cdn.matrimony.app/${s3Key}`;
    const thumbnailUrl = `https://cdn.matrimony.app/photos/${profile_id}/${photoId}_thumb.jpg`;

    // Insert metadata in DB as PENDING/PUBLIC
    await pool.query(
      `INSERT INTO photos (
        id, profile_id, s3_bucket, s3_key, cdn_url, thumbnail_key, thumbnail_url, 
        file_size_bytes, mime_type, visibility, is_primary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PUBLIC', FALSE)`,
      [
        photoId,
        profile_id,
        s3Bucket,
        s3Key,
        cdnUrl,
        `photos/${profile_id}/${photoId}_thumb.jpg`,
        thumbnailUrl,
        file_size_bytes,
        mime_type
      ]
    );

    // Return locally mocked upload URL
    res.status(200).json({
      upload_url: `http://localhost:${port}/api/v1/media/upload-mock`,
      photo_id: photoId,
      cdn_url: cdnUrl,
      thumbnail_url: thumbnailUrl,
      fields: {
        key: s3Key,
        bucket: s3Bucket,
        'Content-Type': mime_type
      }
    });
  } catch (error) {
    next(error);
  }
});

// Mock Upload endpoint (STORY-015)
app.post('/api/v1/media/upload-mock', async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'File uploaded successfully to mock S3 storage.'
  });
});

// 8.1 Upload Photo via Multipart form-data (mocked using simpler fields)
app.post('/api/v1/media/photos', authenticateToken, async (req, res, next) => {
  const { profile_id, visibility, is_primary, filename, size, mime } = req.body;
  try {
    const photoId = generateUlid();
    const bucket = 'matrimony-media-bucket';
    const key = `photos/${profile_id || 'unknown'}/${photoId}.jpg`;
    const cdnUrl = `https://cdn.matrimony.app/${key}`;
    const thumbUrl = `https://cdn.matrimony.app/photos/${profile_id || 'unknown'}/${photoId}_thumb.jpg`;

    await pool.query(
      `INSERT INTO photos (
        id, profile_id, s3_bucket, s3_key, cdn_url, thumbnail_key, thumbnail_url, 
        file_size_bytes, mime_type, visibility, is_primary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        photoId,
        profile_id || 'unknown',
        bucket,
        key,
        cdnUrl,
        key.replace('.jpg', '_thumb.jpg'),
        thumbUrl,
        size || 100000,
        mime || 'image/jpeg',
        visibility || 'PUBLIC',
        is_primary || false
      ]
    );

    res.status(201).json({
      photo_id: photoId,
      profile_id: profile_id,
      cdn_url: cdnUrl,
      thumbnail_url: thumbUrl,
      visibility: visibility || 'PUBLIC',
      is_primary: is_primary || false,
      uploaded_at: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// 8.5 Get Profile Photos (STORY-016)
app.get('/api/v1/media/photos', async (req, res, next) => {
  const profileId = req.query.profile_id as string;
  try {
    if (!profileId) {
      throw new ValidationError('profile_id query parameter is required.');
    }

    const photosRes = await pool.query(
      'SELECT id as photo_id, cdn_url, thumbnail_url, visibility, is_primary FROM photos WHERE profile_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC, created_at DESC',
      [profileId]
    );

    res.status(200).json({
      data: photosRes.rows
    });
  } catch (error) {
    next(error);
  }
});

// 8.3 Set Primary Photo (STORY-016)
app.patch('/api/v1/media/photos/:photo_id/primary', authenticateToken, async (req, res, next) => {
  const photoId = req.params.photo_id;
  try {
    const photoRes = await pool.query('SELECT profile_id FROM photos WHERE id = $1 AND deleted_at IS NULL', [photoId]);
    if (photoRes.rows.length === 0) {
      throw new NotFoundError('Photo not found.');
    }
    const profileId = photoRes.rows[0].profile_id;

    await pool.query('BEGIN');
    // Clear existing primary
    await pool.query('UPDATE photos SET is_primary = FALSE WHERE profile_id = $1', [profileId]);
    // Set new primary
    await pool.query('UPDATE photos SET is_primary = TRUE WHERE id = $1', [photoId]);
    await pool.query('COMMIT');

    // Return success
    res.status(200).json({
      photo_id: photoId,
      is_primary: true,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    next(error);
  }
});

// 8.4 Update Photo Visibility (STORY-016)
app.patch('/api/v1/media/photos/:photo_id/visibility', authenticateToken, async (req, res, next) => {
  const photoId = req.params.photo_id;
  const { visibility } = req.body;

  try {
    if (!visibility || !['PUBLIC', 'MATCHES_ONLY', 'PRIVATE'].includes(visibility)) {
      throw new ValidationError('Invalid visibility value.', [{ field: 'visibility', issue: 'Must be PUBLIC, MATCHES_ONLY, or PRIVATE' }]);
    }

    const photoRes = await pool.query('UPDATE photos SET visibility = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND deleted_at IS NULL RETURNING *', [visibility, photoId]);
    if (photoRes.rows.length === 0) {
      throw new NotFoundError('Photo not found.');
    }

    res.status(200).json({
      photo_id: photoId,
      visibility,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 8.2 Delete Photo
app.delete('/api/v1/media/photos/:photo_id', authenticateToken, async (req, res, next) => {
  const photoId = req.params.photo_id;
  try {
    const result = await pool.query('UPDATE photos SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *', [photoId]);
    if (result.rows.length === 0) {
      throw new NotFoundError('Photo not found.');
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err.message || 'Internal Error', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    status,
    code: err.code || 'INTERNAL_ERROR',
    message: err.message || 'An unexpected error occurred.',
    details: err.details || [],
    correlationId: (req.headers['x-correlation-id'] as string) || 'none',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  logger.info(`Media Service listening on port ${port}`);
  initDb();
});

export default app;
