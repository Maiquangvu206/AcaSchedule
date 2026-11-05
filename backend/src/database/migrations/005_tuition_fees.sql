-- 005_tuition_fees.sql — học phí theo từng học kỳ (được admin setup)

CREATE TABLE tuition_fees (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    semester     varchar(20) NOT NULL UNIQUE,
    fee_per_credit integer NOT NULL DEFAULT 1500000 CHECK (fee_per_credit >= 0),
    currency     varchar(10) NOT NULL DEFAULT 'VND',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tuition_fees_set_updated_at
    BEFORE UPDATE ON tuition_fees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE tuition_fees IS 'Học phí theo từng học kỳ, do admin setup';
