CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  birth_date DATE,
  phone TEXT,
  profile_photo_file_id UUID,
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('customer', 'provider')),
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((role = 'provider' AND password_hash IS NOT NULL) OR role = 'customer')
);

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_file_id UUID;

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_codes_user_id_idx ON email_verification_codes(user_id);

CREATE TABLE IF NOT EXISTS provider_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  province TEXT NOT NULL,
  profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_profiles_category_idx ON provider_profiles(category);

CREATE TABLE IF NOT EXISTS provider_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_kind TEXT NOT NULL CHECK (file_kind IN ('profile_photo', 'portfolio_photo', 'identity_document', 'certificate')),
  object_key TEXT NOT NULL UNIQUE,
  encrypted_at_rest BOOLEAN NOT NULL DEFAULT false,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_files_user_kind_idx ON provider_files(user_id, file_kind);

CREATE TABLE IF NOT EXISTS provider_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, customer_id)
);

CREATE INDEX IF NOT EXISTS provider_reviews_provider_idx ON provider_reviews(provider_id, created_at DESC);
