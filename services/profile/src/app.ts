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
import axios from 'axios';

const app = express();
app.use(express.json());

const logger = new Logger('profile-service');
const port = process.env.PORT || 3002;
const jwtSecret = process.env.JWT_SECRET || 'supersecretkeyforjwt';

// Database Pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'matrimony_user',
  password: process.env.DB_PASSWORD || 'matrimony_password',
  database: process.env.DB_DATABASE || 'matrimony_db',
});

// Traceability Comment: STORY-010 - Base 32 ULID Generator helper
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

// Authentication Middleware
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

// Database Schema Setup (STORY-010)
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create ENUMs
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
          CREATE TYPE gender_type AS ENUM ('MALE', 'FEMALE');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marital_status_type') THEN
          CREATE TYPE marital_status_type AS ENUM ('NEVER_MARRIED', 'DIVORCED', 'WIDOWED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_status') THEN
          CREATE TYPE profile_status AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'SUSPENDED', 'DELETED');
        END IF;
      END $$;
    `);

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id CHAR(26) PRIMARY KEY,
        user_id CHAR(26) UNIQUE NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        date_of_birth DATE NOT NULL,
        gender gender_type NOT NULL,
        religion VARCHAR(50) NOT NULL,
        caste VARCHAR(50) DEFAULT NULL,
        mother_tongue VARCHAR(50) NOT NULL,
        marital_status marital_status_type NOT NULL,
        height_cm SMALLINT NOT NULL,
        body_type VARCHAR(30) DEFAULT NULL,
        diet VARCHAR(30) DEFAULT NULL,
        smoking VARCHAR(20) DEFAULT NULL,
        drinking VARCHAR(20) DEFAULT NULL,
        education VARCHAR(100) NOT NULL,
        education_detail VARCHAR(200) DEFAULT NULL,
        occupation VARCHAR(100) NOT NULL,
        employer VARCHAR(150) DEFAULT NULL,
        annual_income_inr INTEGER DEFAULT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        country VARCHAR(100) NOT NULL DEFAULT 'India',
        latitude DECIMAL(9,6) DEFAULT NULL,
        longitude DECIMAL(9,6) DEFAULT NULL,
        about_me TEXT DEFAULT NULL,
        avatar_photo_id CHAR(26) DEFAULT NULL,
        completion_percentage SMALLINT NOT NULL DEFAULT 0,
        status profile_status NOT NULL DEFAULT 'DRAFT',
        is_visible BOOLEAN NOT NULL DEFAULT TRUE,
        is_premium BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMPTZ DEFAULT NULL,
        CONSTRAINT ck_profiles_height_range CHECK (height_cm BETWEEN 100 AND 250),
        CONSTRAINT ck_profiles_completion_range CHECK (completion_percentage BETWEEN 0 AND 100)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS family_profiles (
        id CHAR(26) PRIMARY KEY,
        profile_id CHAR(26) UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        father_name VARCHAR(100) DEFAULT NULL,
        father_occupation VARCHAR(100) DEFAULT NULL,
        mother_name VARCHAR(100) DEFAULT NULL,
        mother_occupation VARCHAR(100) DEFAULT NULL,
        siblings_count SMALLINT DEFAULT NULL,
        family_type VARCHAR(30) DEFAULT NULL,
        family_status VARCHAR(30) DEFAULT NULL,
        family_values VARCHAR(30) DEFAULT NULL,
        native_place VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS partner_preferences (
        id CHAR(26) PRIMARY KEY,
        profile_id CHAR(26) UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        age_min SMALLINT NOT NULL DEFAULT 18,
        age_max SMALLINT NOT NULL DEFAULT 60,
        height_min_cm SMALLINT DEFAULT NULL,
        height_max_cm SMALLINT DEFAULT NULL,
        religions TEXT[] DEFAULT NULL,
        castes TEXT[] DEFAULT NULL,
        marital_statuses TEXT[] DEFAULT NULL,
        education_levels TEXT[] DEFAULT NULL,
        locations TEXT[] DEFAULT NULL,
        radius_km SMALLINT DEFAULT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT ck_partner_pref_age_order CHECK (age_min <= age_max),
        CONSTRAINT ck_partner_pref_age_min CHECK (age_min >= 18),
        CONSTRAINT ck_partner_pref_height_order CHECK (height_min_cm <= height_max_cm)
      );
    `);

    // Create Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_profiles_status_visible ON profiles(status, is_visible);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_profiles_city_state ON profiles(city, state);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_profiles_gender_religion ON profiles(gender, religion);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_profiles_dob ON profiles(date_of_birth);');

    await client.query('COMMIT');
    logger.info('Profile database tables and schemas initialized.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    logger.error('Failed to initialize Profile database', err);
  } finally {
    client.release();
  }
}

// Function to calculate and save the completion score (STORY-009 / STORY-010)
async function updateCompletionScore(profileId: string): Promise<number> {
  const profileRes = await pool.query('SELECT * FROM profiles WHERE id = $1', [profileId]);
  if (profileRes.rows.length === 0) return 0;
  const p = profileRes.rows[0];

  const familyRes = await pool.query('SELECT * FROM family_profiles WHERE profile_id = $1', [profileId]);
  const f = familyRes.rows[0];

  const prefRes = await pool.query('SELECT * FROM partner_preferences WHERE profile_id = $1', [profileId]);
  const pr = prefRes.rows[0];

  // Recalculate Basic Info Score (up to 50%)
  // 13 Required columns: first_name, last_name, date_of_birth, gender, religion, mother_tongue, marital_status, height_cm, education, occupation, city, state, country
  // Plus optional basic columns: caste, body_type, diet, smoking, drinking, employer, annual_income_inr, about_me (8 fields)
  let basicScore = 30; // 30 base points for required fields
  const optionalBasicFields = ['caste', 'body_type', 'diet', 'smoking', 'drinking', 'employer', 'annual_income_inr', 'about_me'];
  let filledOptionalBasicCount = 0;
  optionalBasicFields.forEach(field => {
    if (p[field] !== null && p[field] !== undefined && p[field] !== '') {
      filledOptionalBasicCount++;
    }
  });
  basicScore += (filledOptionalBasicCount * 2.5); // 8 * 2.5 = 20 max points

  // Recalculate Family Score (up to 20%)
  let familyScore = 0;
  if (f) {
    const familyFields = ['father_name', 'father_occupation', 'mother_name', 'mother_occupation', 'siblings_count', 'family_type', 'family_status', 'family_values', 'native_place'];
    let filledFamilyCount = 0;
    familyFields.forEach(field => {
      if (f[field] !== null && f[field] !== undefined && f[field] !== '') {
        filledFamilyCount++;
      }
    });
    familyScore = 5 + (filledFamilyCount * 1.66); // base 5 points + 15 points scaled
    if (familyScore > 20) familyScore = 20;
  }

  // Recalculate Preferences Score (up to 20%)
  let prefScore = 0;
  if (pr) {
    const prefFields = ['height_min_cm', 'height_max_cm', 'religions', 'castes', 'marital_statuses', 'education_levels', 'locations', 'radius_km'];
    let filledPrefCount = 0;
    prefFields.forEach(field => {
      if (pr[field] !== null && pr[field] !== undefined && (!Array.isArray(pr[field]) || pr[field].length > 0)) {
        filledPrefCount++;
      }
    });
    prefScore = 4 + (filledPrefCount * 2); // base 4 points + 16 points scaled
    if (prefScore > 20) prefScore = 20;
  }

  // Check photo (STORY-009 / STORY-015)
  let photoScore = 0;
  try {
    const mediaPort = process.env.MEDIA_SERVICE_PORT || 3008;
    const mediaRes = await axios.get(`http://localhost:${mediaPort}/api/v1/media/photos?profile_id=${profileId}`, {
      headers: { Authorization: `Bearer ${jwt.sign({ userId: p.user_id }, jwtSecret)}` }
    });
    if (mediaRes.data && mediaRes.data.data && mediaRes.data.data.length > 0) {
      photoScore = 10;
    }
  } catch (e) {
    // If media service isn't running or check fails, check local avatar_photo_id in profile
    if (p.avatar_photo_id) {
      photoScore = 10;
    }
  }

  let totalScore = Math.round(basicScore + familyScore + prefScore + photoScore);
  if (totalScore > 100) totalScore = 100;
  if (totalScore === 100 && photoScore === 0) {
    // Constraint: Can never reach 100% without photo
    totalScore = 90;
  }

  await pool.query('UPDATE profiles SET completion_percentage = $1 WHERE id = $2', [totalScore, profileId]);
  return totalScore;
}

// 7.1 Create / Onboard Profile (STORY-006 / STORY-010)
app.post('/api/v1/profiles', authenticateToken, async (req, res, next) => {
  const userId = (req as any).user.userId;
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUlid();

  const {
    first_name,
    last_name,
    date_of_birth,
    gender,
    religion,
    caste,
    mother_tongue,
    marital_status,
    height_cm,
    body_type,
    diet,
    smoking,
    drinking,
    education,
    education_detail,
    occupation,
    employer,
    annual_income_inr,
    city,
    state,
    country,
    about_me,
    family,
    preferences,
  } = req.body;

  try {
    // Check if profile already exists
    const existing = await pool.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
    if (existing.rows.length > 0) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Profile already exists for this user.',
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Input Validation
    if (!first_name || first_name.length < 2 || !/^[a-zA-Z\s]+$/.test(first_name)) {
      throw new ValidationError('Invalid first name format.', [{ field: 'first_name', issue: 'Must be alphabetic, min 2 chars' }]);
    }
    if (!last_name || last_name.length < 2 || !/^[a-zA-Z\s]+$/.test(last_name)) {
      throw new ValidationError('Invalid last name format.', [{ field: 'last_name', issue: 'Must be alphabetic, min 2 chars' }]);
    }
    if (!date_of_birth) {
      throw new ValidationError('Date of birth is required.', [{ field: 'date_of_birth', issue: 'Required' }]);
    }

    const birthDate = new Date(date_of_birth);
    const age = new Date().getFullYear() - birthDate.getFullYear();
    if (age < 18) {
      throw new ValidationError('Age must be 18 years or older.', [{ field: 'date_of_birth', issue: 'Underage seeker registration blocked' }]);
    }

    if (!['MALE', 'FEMALE'].includes(gender)) {
      throw new ValidationError('Invalid gender.', [{ field: 'gender', issue: 'Must be MALE or FEMALE' }]);
    }
    if (!religion) {
      throw new ValidationError('Religion is required.', [{ field: 'religion', issue: 'Required' }]);
    }
    if (!['NEVER_MARRIED', 'DIVORCED', 'WIDOWED'].includes(marital_status)) {
      throw new ValidationError('Invalid marital status.', [{ field: 'marital_status', issue: 'Must be NEVER_MARRIED, DIVORCED, or WIDOWED' }]);
    }
    if (!height_cm || height_cm < 100 || height_cm > 250) {
      throw new ValidationError('Height must be between 100 and 250 cm.', [{ field: 'height_cm', issue: 'Must be 100 to 250' }]);
    }
    if (!education) {
      throw new ValidationError('Education level is required.', [{ field: 'education', issue: 'Required' }]);
    }
    if (!occupation) {
      throw new ValidationError('Occupation is required.', [{ field: 'occupation', issue: 'Required' }]);
    }
    if (!city) {
      throw new ValidationError('City is required.', [{ field: 'city', issue: 'Required' }]);
    }
    if (!state) {
      throw new ValidationError('State is required.', [{ field: 'state', issue: 'Required' }]);
    }

    const profileId = generateUlid();
    const familyId = generateUlid();
    const prefId = generateUlid();

    await pool.query('BEGIN');

    await pool.query(
      `INSERT INTO profiles (
        id, user_id, first_name, last_name, date_of_birth, gender, religion, caste, mother_tongue, 
        marital_status, height_cm, body_type, diet, smoking, drinking, education, education_detail, 
        occupation, employer, annual_income_inr, city, state, country, about_me, status, is_visible
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, 'DRAFT', TRUE)`,
      [
        profileId,
        userId,
        first_name,
        last_name,
        date_of_birth,
        gender,
        religion,
        caste || null,
        mother_tongue,
        marital_status,
        height_cm,
        body_type || null,
        diet || null,
        smoking || null,
        drinking || null,
        education,
        education_detail || null,
        occupation,
        employer || null,
        annual_income_inr || null,
        city,
        state,
        country || 'India',
        about_me || null,
      ]
    );

    // Create optional family record
    const f = family || {};
    await pool.query(
      `INSERT INTO family_profiles (
        id, profile_id, father_name, father_occupation, mother_name, mother_occupation, 
        siblings_count, family_type, family_status, family_values, native_place
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        familyId,
        profileId,
        f.father_name || null,
        f.father_occupation || null,
        f.mother_name || null,
        f.mother_occupation || null,
        f.siblings_count || null,
        f.family_type || null,
        f.family_status || null,
        f.family_values || null,
        f.native_place || null,
      ]
    );

    // Create partner preferences record
    const pr = preferences || {};
    await pool.query(
      `INSERT INTO partner_preferences (
        id, profile_id, age_min, age_max, height_min_cm, height_max_cm, 
        religions, castes, marital_statuses, education_levels, locations, radius_km
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        prefId,
        profileId,
        pr.age_min || 18,
        pr.age_max || 60,
        pr.height_min_cm || null,
        pr.height_max_cm || null,
        pr.religions || null,
        pr.castes || null,
        pr.marital_statuses || null,
        pr.education_levels || null,
        pr.locations || null,
        pr.radius_km || null,
      ]
    );

    await pool.query('COMMIT');

    // recalculate score
    const completionPercentage = await updateCompletionScore(profileId);

    res.status(201).json({
      profile_id: profileId,
      user_id: userId,
      completion_percentage: completionPercentage,
      status: 'DRAFT',
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    next(error);
  }
});

// 7.2 Get Own Profile (STORY-010)
app.get('/api/v1/profiles/me', authenticateToken, async (req, res, next) => {
  const userId = (req as any).user.userId;
  try {
    const profileRes = await pool.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    if (profileRes.rows.length === 0) {
      throw new NotFoundError('Profile not found.');
    }
    const profile = profileRes.rows[0];
    const profileId = profile.id;

    const familyRes = await pool.query('SELECT * FROM family_profiles WHERE profile_id = $1', [profileId]);
    const family = familyRes.rows[0] || null;

    const prefRes = await pool.query('SELECT * FROM partner_preferences WHERE profile_id = $1', [profileId]);
    const preferences = prefRes.rows[0] || null;

    // Recalculate age
    const dob = new Date(profile.date_of_birth);
    const age = new Date().getFullYear() - dob.getFullYear();

    // Mock avatar URL
    const avatarUrl = profile.avatar_photo_id 
      ? `https://cdn.matrimony.app/photos/${profile.avatar_photo_id}.jpg`
      : null;

    res.status(200).json({
      profile_id: profile.id,
      user_id: profile.user_id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      date_of_birth: profile.date_of_birth,
      age,
      gender: profile.gender,
      religion: profile.religion,
      caste: profile.caste,
      mother_tongue: profile.mother_tongue,
      marital_status: profile.marital_status,
      height_cm: profile.height_cm,
      body_type: profile.body_type,
      diet: profile.diet,
      smoking: profile.smoking,
      drinking: profile.drinking,
      education: profile.education,
      education_detail: profile.education_detail,
      occupation: profile.occupation,
      employer: profile.employer,
      annual_income_inr: profile.annual_income_inr,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      about_me: profile.about_me,
      completion_percentage: profile.completion_percentage,
      status: profile.status,
      is_visible: profile.is_visible,
      avatar_url: avatarUrl,
      family,
      preferences,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

// 7.4 Update Own Profile (STORY-010)
app.patch('/api/v1/profiles/me', authenticateToken, async (req, res, next) => {
  const userId = (req as any).user.userId;
  const correlationId = (req.headers['x-correlation-id'] as string) || generateUlid();

  try {
    const profileRes = await pool.query('SELECT id, status FROM profiles WHERE user_id = $1', [userId]);
    if (profileRes.rows.length === 0) {
      throw new NotFoundError('Profile not found.');
    }
    const profile = profileRes.rows[0];

    const fields = req.body;
    const immutableFields = ['date_of_birth', 'gender', 'user_id', 'id'];
    immutableFields.forEach(f => {
      if (fields[f] !== undefined) {
        throw new ValidationError(`Field ${f} is immutable.`, [{ field: f, issue: 'Field is immutable post-onboarding' }]);
      }
    });

    const allowedFields = [
      'first_name', 'last_name', 'religion', 'caste', 'mother_tongue', 'marital_status',
      'height_cm', 'body_type', 'diet', 'smoking', 'drinking', 'education', 'education_detail',
      'occupation', 'employer', 'annual_income_inr', 'city', 'state', 'country', 'about_me',
      'avatar_photo_id', 'is_visible', 'status'
    ];

    const updates: string[] = [];
    const values: any[] = [];
    let counter = 1;

    Object.keys(fields).forEach(key => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${counter}`);
        values.push(fields[key]);
        counter++;
      }
    });

    if (updates.length === 0) {
      res.status(200).json({
        profile_id: profile.id,
        message: 'No fields to update.',
        updated_at: new Date().toISOString()
      });
      return;
    }

    values.push(profile.id);
    const query = `UPDATE profiles SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${counter} RETURNING *`;
    
    await pool.query(query, values);
    const updatedScore = await updateCompletionScore(profile.id);

    res.status(200).json({
      profile_id: profile.id,
      completion_percentage: updatedScore,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 7.5 Update Partner Preferences (STORY-012)
app.put('/api/v1/profiles/me/preferences', authenticateToken, async (req, res, next) => {
  const userId = (req as any).user.userId;
  const {
    age_min,
    age_max,
    height_min_cm,
    height_max_cm,
    religions,
    castes,
    marital_statuses,
    education_levels,
    locations,
    radius_km
  } = req.body;

  try {
    const profileRes = await pool.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
    if (profileRes.rows.length === 0) {
      throw new NotFoundError('Profile not found.');
    }
    const profileId = profileRes.rows[0].id;

    // Validation
    if (age_min !== undefined && age_min < 18) {
      throw new ValidationError('Minimum age must be 18 or older.', [{ field: 'age_min', issue: 'Must be >= 18' }]);
    }
    if (age_min !== undefined && age_max !== undefined && age_min > age_max) {
      throw new ValidationError('Minimum age cannot exceed maximum age.', [{ field: 'age_min', issue: 'Must be <= age_max' }]);
    }
    if (height_min_cm !== undefined && height_max_cm !== undefined && height_min_cm > height_max_cm) {
      throw new ValidationError('Minimum height cannot exceed maximum height.', [{ field: 'height_min_cm', issue: 'Must be <= height_max_cm' }]);
    }

    const prefId = generateUlid();
    await pool.query(
      `INSERT INTO partner_preferences (
        id, profile_id, age_min, age_max, height_min_cm, height_max_cm, religions, castes, 
        marital_statuses, education_levels, locations, radius_km
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (profile_id) DO UPDATE SET
        age_min = COALESCE(EXCLUDED.age_min, partner_preferences.age_min),
        age_max = COALESCE(EXCLUDED.age_max, partner_preferences.age_max),
        height_min_cm = EXCLUDED.height_min_cm,
        height_max_cm = EXCLUDED.height_max_cm,
        religions = EXCLUDED.religions,
        castes = EXCLUDED.castes,
        marital_statuses = EXCLUDED.marital_statuses,
        education_levels = EXCLUDED.education_levels,
        locations = EXCLUDED.locations,
        radius_km = EXCLUDED.radius_km,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [
        prefId,
        profileId,
        age_min || 18,
        age_max || 60,
        height_min_cm || null,
        height_max_cm || null,
        religions || null,
        castes || null,
        marital_statuses || null,
        education_levels || null,
        locations || null,
        radius_km || null
      ]
    );

    const updatedScore = await updateCompletionScore(profileId);

    // STORY-013: Dummy trigger of Elasticsearch Sync here
    logger.info(`Elasticsearch cache sync triggered for profile preferences: ${profileId}`);

    res.status(200).json({
      preferences_id: profileId,
      completion_percentage: updatedScore,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// 7.6 Get Partner Preferences (STORY-012)
app.get('/api/v1/profiles/me/preferences', authenticateToken, async (req, res, next) => {
  const userId = (req as any).user.userId;
  try {
    const profileRes = await pool.query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
    if (profileRes.rows.length === 0) {
      throw new NotFoundError('Profile not found.');
    }
    const profileId = profileRes.rows[0].id;

    const prefRes = await pool.query('SELECT * FROM partner_preferences WHERE profile_id = $1', [profileId]);
    if (prefRes.rows.length === 0) {
      res.status(200).json({
        age_min: 18,
        age_max: 60,
        height_min_cm: null,
        height_max_cm: null,
        religions: null,
        castes: null,
        marital_statuses: null,
        education_levels: null,
        locations: null,
        radius_km: null
      });
      return;
    }

    res.status(200).json(prefRes.rows[0]);
  } catch (error) {
    next(error);
  }
});

// 7.7 Profile Completion Status Checklist (STORY-009)
app.get('/api/v1/profiles/me/completion', authenticateToken, async (req, res, next) => {
  const userId = (req as any).user.userId;
  try {
    const profileRes = await pool.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    if (profileRes.rows.length === 0) {
      throw new NotFoundError('Profile not found.');
    }
    const p = profileRes.rows[0];

    const familyRes = await pool.query('SELECT 1 FROM family_profiles WHERE profile_id = $1', [p.id]);
    const prefRes = await pool.query('SELECT 1 FROM partner_preferences WHERE profile_id = $1', [p.id]);

    // Check media
    let hasPhoto = false;
    try {
      const mediaPort = process.env.MEDIA_SERVICE_PORT || 3008;
      const mediaRes = await axios.get(`http://localhost:${mediaPort}/api/v1/media/photos?profile_id=${p.id}`, {
        headers: { Authorization: `Bearer ${jwt.sign({ userId }, jwtSecret)}` }
      });
      if (mediaRes.data && mediaRes.data.data && mediaRes.data.data.length > 0) {
        hasPhoto = true;
      }
    } catch (e) {
      if (p.avatar_photo_id) hasPhoto = true;
    }

    const completedSections: string[] = ['basic_info'];
    const pendingSections: string[] = [];

    if (familyRes.rows.length > 0) {
      completedSections.push('family_details');
    } else {
      pendingSections.push('family_details');
    }

    if (prefRes.rows.length > 0) {
      completedSections.push('preferences');
    } else {
      pendingSections.push('preferences');
    }

    if (hasPhoto) {
      completedSections.push('photos');
    } else {
      pendingSections.push('photos');
    }

    res.status(200).json({
      completion_percentage: p.completion_percentage,
      completed_sections: completedSections,
      pending_sections: pendingSections,
      minimum_to_publish: 70,
      is_publishable: p.completion_percentage >= 70
    });
  } catch (error) {
    next(error);
  }
});

// 7.3 Get Profile by ID (STORY-010)
app.get('/api/v1/profiles/:profile_id', authenticateToken, async (req, res, next) => {
  const targetId = req.params.profile_id;
  try {
    const profileRes = await pool.query('SELECT * FROM profiles WHERE id = $1 AND deleted_at IS NULL', [targetId]);
    if (profileRes.rows.length === 0) {
      throw new NotFoundError('Profile not found.');
    }
    const profile = profileRes.rows[0];

    if (profile.status === 'SUSPENDED') {
      throw new ForbiddenError('Target profile is suspended.');
    }
    if (!profile.is_visible && profile.user_id !== (req as any).user.userId) {
      throw new ForbiddenError('Target profile is hidden.');
    }

    const familyRes = await pool.query('SELECT * FROM family_profiles WHERE profile_id = $1', [targetId]);
    const family = familyRes.rows[0] || null;

    // Recalculate age
    const dob = new Date(profile.date_of_birth);
    const age = new Date().getFullYear() - dob.getFullYear();

    // Mock avatar URL
    const avatarUrl = profile.avatar_photo_id 
      ? `https://cdn.matrimony.app/photos/${profile.avatar_photo_id}.jpg`
      : null;

    res.status(200).json({
      profile_id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      date_of_birth: profile.date_of_birth,
      age,
      gender: profile.gender,
      religion: profile.religion,
      caste: profile.caste,
      mother_tongue: profile.mother_tongue,
      marital_status: profile.marital_status,
      height_cm: profile.height_cm,
      body_type: profile.body_type,
      diet: profile.diet,
      smoking: profile.smoking,
      drinking: profile.drinking,
      education: profile.education,
      education_detail: profile.education_detail,
      occupation: profile.occupation,
      employer: profile.employer,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      about_me: profile.about_me,
      completion_percentage: profile.completion_percentage,
      status: profile.status,
      is_visible: profile.is_visible,
      avatar_url: avatarUrl,
      family,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    });
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
  logger.info(`Profile Service listening on port ${port}`);
  initDb();
});

export default app;
