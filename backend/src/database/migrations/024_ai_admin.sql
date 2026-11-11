-- 024_ai_admin.sql — admin-managed AI providers, API keys and usage tracking.
--
-- * ai_settings        : one row (id = 1) with the kill switch, provider order,
--                        model names and the default daily quota per student.
-- * ai_provider_keys    : Gemini / OpenRouter keys, AES-256-GCM encrypted by the
--                        backend (AI_KEYS_SECRET). Never stored in plain text.
-- * ai_usage_logs       : one row per AI request, used for per-user statistics
--                        and for enforcing the daily quota.
-- * users.ai_daily_limit: optional per-student override (NULL = use default).

CREATE TABLE IF NOT EXISTS ai_settings (
    id                   smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    is_enabled           boolean NOT NULL DEFAULT true,
    provider_order       varchar(64) NOT NULL DEFAULT 'gemini,openrouter',
    gemini_model         varchar(120) NOT NULL DEFAULT 'gemini-1.5-flash',
    openrouter_model     varchar(160) NOT NULL DEFAULT 'google/gemini-2.0-flash-001',
    daily_limit_per_user integer NOT NULL DEFAULT 0 CHECK (daily_limit_per_user >= 0),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ai_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_provider_keys (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider      varchar(32) NOT NULL CHECK (provider IN ('gemini', 'openrouter')),
    label         varchar(80) NOT NULL DEFAULT '',
    encrypted_key text NOT NULL,
    key_hint      varchar(16) NOT NULL DEFAULT '',
    is_active     boolean NOT NULL DEFAULT true,
    priority      integer NOT NULL DEFAULT 100,
    last_used_at  timestamptz,
    last_error    text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_keys_pool
    ON ai_provider_keys (provider, is_active, priority, created_at);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id            bigserial PRIMARY KEY,
    user_id       uuid REFERENCES users (id) ON DELETE SET NULL,
    endpoint      varchar(64) NOT NULL,
    provider      varchar(32) NOT NULL DEFAULT 'fallback',
    used_fallback boolean NOT NULL DEFAULT false,
    latency_ms    integer NOT NULL DEFAULT 0,
    status_code   smallint,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created
    ON ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created
    ON ai_usage_logs (user_id, created_at DESC);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ai_daily_limit integer;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_ai_daily_limit_check;
ALTER TABLE users
    ADD CONSTRAINT users_ai_daily_limit_check
    CHECK (ai_daily_limit IS NULL OR ai_daily_limit >= 0);

DROP TRIGGER IF EXISTS ai_settings_set_updated_at ON ai_settings;
CREATE TRIGGER ai_settings_set_updated_at
    BEFORE UPDATE ON ai_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS ai_provider_keys_set_updated_at ON ai_provider_keys;
CREATE TRIGGER ai_provider_keys_set_updated_at
    BEFORE UPDATE ON ai_provider_keys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
