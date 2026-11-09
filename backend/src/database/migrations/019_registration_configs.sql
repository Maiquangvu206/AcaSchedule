-- 019_registration_configs.sql — per-semester registration open/close configuration

CREATE TABLE IF NOT EXISTS registration_configs (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    semester   varchar(20) NOT NULL UNIQUE,
    is_open    boolean NOT NULL DEFAULT true,
    opened_at  timestamptz,
    closed_at  timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_configs_semester
    ON registration_configs (semester);

DROP TRIGGER IF EXISTS registration_configs_set_updated_at ON registration_configs;
CREATE TRIGGER registration_configs_set_updated_at
    BEFORE UPDATE ON registration_configs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
