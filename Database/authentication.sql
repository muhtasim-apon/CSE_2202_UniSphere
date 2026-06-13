-- ================================================================
-- UNIVERSITY ERP — AUTH SCHEMA (Supabase, Final, No Seed)
-- ================================================================

-- ================================================================
-- EXTENSIONS
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ================================================================
-- ENUMS
-- ================================================================

DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('user','student','teacher','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.gender_val AS ENUM ('Male','Female','Other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.request_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.designation_val AS ENUM (
        'Lecturer','Assistant Professor','Associate Professor',
        'Professor','Adjunct','Visiting'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ================================================================
-- HELPER FUNCTIONS
-- ================================================================

-- BD phone: 01[3-9]XXXXXXXX → stored as +8801XXXXXXXXX
CREATE OR REPLACE FUNCTION public.is_valid_bd_phone(p TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT p ~ '^(\+?880)?0?1[3-9][0-9]{8}$'
$$;

CREATE OR REPLACE FUNCTION public.normalise_bd_phone(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT CASE
        WHEN p ~ '^\+8801[3-9][0-9]{8}$' THEN p
        WHEN p ~ '^8801[3-9][0-9]{8}$'   THEN '+' || p
        WHEN p ~ '^01[3-9][0-9]{8}$'     THEN '+880' || substring(p FROM 2)
        ELSE NULL
    END
$$;

-- Email: proper format, 6–150 chars, no double dots
CREATE OR REPLACE FUNCTION public.is_valid_email(e TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT e ~ '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+[.][a-zA-Z]{2,}$'
       AND LENGTH(e) BETWEEN 6 AND 150
       AND e NOT LIKE '%..%'
$$;

-- Name: 2–60 printable chars, no digits, no leading/trailing space
-- Simplified regex — no Unicode escapes (those caused the syntax error)
CREATE OR REPLACE FUNCTION public.is_valid_name(n TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
    RETURN
        LENGTH(TRIM(n)) BETWEEN 2 AND 60
        AND TRIM(n) NOT LIKE '%  %'          -- no double spaces
        AND TRIM(n) !~ '[0-9]'               -- no digits
        AND TRIM(n) !~ '[!@#$%^&*()_=+\[\]{}<>?/\\|]'; -- no special chars
END;
$$;


-- ================================================================
-- CORE STUB TABLES  (FK targets — add full columns later)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.department (
    dept_id     SERIAL      PRIMARY KEY,
    dept_name   TEXT        NOT NULL UNIQUE
                            CHECK (LENGTH(TRIM(dept_name)) BETWEEN 2 AND 100),
    dept_code   TEXT        NOT NULL UNIQUE
                            CHECK (dept_code ~ '^[A-Z]{2,10}$'),
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.program (
    program_id      SERIAL          PRIMARY KEY,
    dept_id         INT             NOT NULL
                                    REFERENCES public.department(dept_id)
                                    ON DELETE RESTRICT ON UPDATE CASCADE,
    program_name    TEXT            NOT NULL
                                    CHECK (LENGTH(TRIM(program_name)) BETWEEN 3 AND 150),
    program_code    TEXT            NOT NULL UNIQUE
                                    CHECK (program_code ~ '^[A-Z0-9-]{2,20}$'),
    degree_level    TEXT            NOT NULL
                                    CHECK (degree_level IN (
                                        'Certificate','Diploma','Associate',
                                        'Bachelor','Master','PhD'
                                    )),
    duration_years  NUMERIC(3,1)    NOT NULL
                                    CHECK (duration_years BETWEEN 0.5 AND 8),
    total_credits   SMALLINT        NOT NULL
                                    CHECK (total_credits BETWEEN 1 AND 300),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ================================================================
-- PROFILES  (extends auth.users — auto-created by trigger)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id              UUID                NOT NULL PRIMARY KEY
                                        REFERENCES auth.users(id)
                                        ON DELETE CASCADE,

    role            public.app_role     NOT NULL DEFAULT 'user',
    is_active       BOOLEAN             NOT NULL DEFAULT TRUE,

    first_name      TEXT                NOT NULL DEFAULT ''
                                        CHECK (
                                            first_name = ''
                                            OR public.is_valid_name(first_name)
                                        ),
    last_name       TEXT                NOT NULL DEFAULT ''
                                        CHECK (
                                            last_name = ''
                                            OR public.is_valid_name(last_name)
                                        ),
    display_name    TEXT                GENERATED ALWAYS AS (
                                            TRIM(first_name || ' ' || last_name)
                                        ) STORED,

    phone           TEXT                UNIQUE
                                        CHECK (
                                            phone IS NULL
                                            OR public.is_valid_bd_phone(phone)
                                        ),

    avatar_url      TEXT                CHECK (
                                            avatar_url IS NULL
                                            OR avatar_url ~ '^https?://.{3,}'
                                        ),

    -- populated after approval; mutually exclusive
    student_id      INT                 UNIQUE,
    instructor_id   INT                 UNIQUE,

    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT profiles_one_link CHECK (
        NOT (student_id IS NOT NULL AND instructor_id IS NOT NULL)
    ),
    CONSTRAINT profiles_admin_no_link CHECK (
        role NOT IN ('admin','user')
        OR (student_id IS NULL AND instructor_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_profiles_role       ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active     ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_student    ON public.profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_instructor ON public.profiles(instructor_id);


-- ================================================================
-- STUDENT
-- ================================================================

CREATE TABLE IF NOT EXISTS public.student (
    student_id      SERIAL          PRIMARY KEY,

    profile_id      UUID            UNIQUE
                                    REFERENCES public.profiles(id)
                                    ON DELETE CASCADE ON UPDATE CASCADE,

    program_id      INT             NOT NULL
                                    REFERENCES public.program(program_id)
                                    ON DELETE RESTRICT ON UPDATE CASCADE,

    first_name      TEXT            NOT NULL
                                    CHECK (public.is_valid_name(first_name)),
    last_name       TEXT            NOT NULL
                                    CHECK (public.is_valid_name(last_name)),

    gender          public.gender_val,

    date_of_birth   DATE            NOT NULL
                                    CHECK (
                                        date_of_birth < CURRENT_DATE
                                        AND date_of_birth > (CURRENT_DATE - INTERVAL '80 years')
                                        AND date_of_birth <= (CURRENT_DATE - INTERVAL '15 years')
                                    ),

    phone           TEXT            CHECK (
                                        phone IS NULL
                                        OR public.is_valid_bd_phone(phone)
                                    ),

    address         TEXT            CHECK (
                                        address IS NULL
                                        OR LENGTH(TRIM(address)) BETWEEN 5 AND 300
                                    ),

    student_roll    TEXT            NOT NULL UNIQUE
                                    CHECK (student_roll ~ '^[0-9]{4}-[A-Z]{2,10}-[0-9]{3,6}$'),

    batch_year      SMALLINT        NOT NULL
                                    CHECK (
                                        batch_year BETWEEN 2000
                                        AND EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT + 1
                                    ),

    current_semester SMALLINT       NOT NULL DEFAULT 1
                                    CHECK (current_semester BETWEEN 1 AND 20),

    cgpa            NUMERIC(4,2)    NOT NULL DEFAULT 0.00
                                    CHECK (cgpa BETWEEN 0.00 AND 4.00),

    total_credits   SMALLINT        NOT NULL DEFAULT 0
                                    CHECK (total_credits >= 0),

    emergency_contact_name  TEXT    CHECK (
                                        emergency_contact_name IS NULL
                                        OR public.is_valid_name(emergency_contact_name)
                                    ),
    emergency_contact_phone TEXT    CHECK (
                                        emergency_contact_phone IS NULL
                                        OR public.is_valid_bd_phone(emergency_contact_phone)
                                    ),

    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_program ON public.student(program_id);
CREATE INDEX IF NOT EXISTS idx_student_batch   ON public.student(batch_year);
CREATE INDEX IF NOT EXISTS idx_student_roll    ON public.student(student_roll);


-- ================================================================
-- INSTRUCTOR
-- ================================================================

CREATE TABLE IF NOT EXISTS public.instructor (
    instructor_id   SERIAL              PRIMARY KEY,

    profile_id      UUID                UNIQUE
                                        REFERENCES public.profiles(id)
                                        ON DELETE CASCADE ON UPDATE CASCADE,

    dept_id         INT                 NOT NULL
                                        REFERENCES public.department(dept_id)
                                        ON DELETE RESTRICT ON UPDATE CASCADE,

    first_name      TEXT                NOT NULL
                                        CHECK (public.is_valid_name(first_name)),
    last_name       TEXT                NOT NULL
                                        CHECK (public.is_valid_name(last_name)),

    gender          public.gender_val,

    date_of_birth   DATE                CHECK (
                                            date_of_birth IS NULL OR (
                                                date_of_birth < CURRENT_DATE
                                                AND date_of_birth > (CURRENT_DATE - INTERVAL '80 years')
                                                AND date_of_birth <= (CURRENT_DATE - INTERVAL '22 years')
                                            )
                                        ),

    phone           TEXT                CHECK (
                                            phone IS NULL
                                            OR public.is_valid_bd_phone(phone)
                                        ),

    office_location TEXT                CHECK (
                                            office_location IS NULL
                                            OR LENGTH(TRIM(office_location)) BETWEEN 2 AND 100
                                        ),

    employee_id     TEXT                NOT NULL UNIQUE
                                        CHECK (employee_id ~ '^EMP-[0-9]{3,6}$'),

    hire_date       DATE                NOT NULL DEFAULT CURRENT_DATE
                                        CHECK (hire_date <= CURRENT_DATE),

    designation     public.designation_val  NOT NULL DEFAULT 'Lecturer',

    specialization  TEXT                CHECK (
                                            specialization IS NULL
                                            OR LENGTH(TRIM(specialization)) BETWEEN 2 AND 200
                                        ),

    bio             TEXT                CHECK (
                                            bio IS NULL
                                            OR LENGTH(TRIM(bio)) BETWEEN 10 AND 2000
                                        ),

    is_active       BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instructor_dept ON public.instructor(dept_id);


-- ================================================================
-- ADD FKs FROM profiles → student / instructor
-- (tables now exist so safe to add)
-- ================================================================

DO $$ BEGIN
    ALTER TABLE public.profiles
        ADD CONSTRAINT fk_profiles_student
        FOREIGN KEY (student_id)
        REFERENCES public.student(student_id)
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.profiles
        ADD CONSTRAINT fk_profiles_instructor
        FOREIGN KEY (instructor_id)
        REFERENCES public.instructor(instructor_id)
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ================================================================
-- REGISTRATION_REQUEST
-- ================================================================

CREATE TABLE IF NOT EXISTS public.registration_request (
    request_id          SERIAL                  PRIMARY KEY,

    role_requested      public.app_role         NOT NULL
                                                CHECK (role_requested IN ('student','teacher')),

    email               TEXT                    NOT NULL
                                                CHECK (public.is_valid_email(email)),

    first_name          TEXT                    NOT NULL
                                                CHECK (public.is_valid_name(first_name)),
    last_name           TEXT                    NOT NULL
                                                CHECK (public.is_valid_name(last_name)),

    phone               TEXT                    CHECK (
                                                    phone IS NULL
                                                    OR public.is_valid_bd_phone(phone)
                                                ),

    gender              public.gender_val,

    date_of_birth       DATE                    CHECK (
                                                    date_of_birth IS NULL OR (
                                                        date_of_birth < CURRENT_DATE
                                                        AND date_of_birth > (CURRENT_DATE - INTERVAL '80 years')
                                                        AND date_of_birth <= (CURRENT_DATE - INTERVAL '15 years')
                                                    )
                                                ),

    -- student only
    program_id          INT                     REFERENCES public.program(program_id)
                                                ON DELETE RESTRICT ON UPDATE CASCADE,
    batch_year          SMALLINT                CHECK (
                                                    batch_year IS NULL OR (
                                                        batch_year BETWEEN 2000
                                                        AND EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT + 1
                                                    )
                                                ),

    -- teacher only
    dept_id             INT                     REFERENCES public.department(dept_id)
                                                ON DELETE RESTRICT ON UPDATE CASCADE,
    designation         public.designation_val,
    specialization      TEXT                    CHECK (
                                                    specialization IS NULL
                                                    OR LENGTH(TRIM(specialization)) BETWEEN 2 AND 200
                                                ),

    -- verification
    email_verified      BOOLEAN                 NOT NULL DEFAULT FALSE,
    verification_token  TEXT                    UNIQUE
                                                CHECK (
                                                    verification_token IS NULL
                                                    OR LENGTH(verification_token) = 64
                                                ),
    token_expires_at    TIMESTAMPTZ,

    -- workflow
    status              public.request_status   NOT NULL DEFAULT 'pending',
    reviewed_by         UUID                    REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,
    rejection_reason    TEXT                    CHECK (
                                                    rejection_reason IS NULL
                                                    OR LENGTH(TRIM(rejection_reason)) BETWEEN 5 AND 500
                                                ),

    submitted_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT rr_email_lowercase       CHECK (email = LOWER(email)),
    CONSTRAINT rr_student_fields        CHECK (
        role_requested <> 'student'
        OR (program_id IS NOT NULL AND batch_year IS NOT NULL AND date_of_birth IS NOT NULL)
    ),
    CONSTRAINT rr_teacher_fields        CHECK (
        role_requested <> 'teacher'
        OR (dept_id IS NOT NULL AND designation IS NOT NULL)
    ),
    CONSTRAINT rr_no_cross_fields       CHECK (
        NOT (role_requested = 'student' AND (dept_id IS NOT NULL OR designation IS NOT NULL))
        AND NOT (role_requested = 'teacher' AND (program_id IS NOT NULL OR batch_year IS NOT NULL))
    ),
    CONSTRAINT rr_reviewed_when_decided CHECK (status = 'pending' OR reviewed_at IS NOT NULL),
    CONSTRAINT rr_reason_only_on_reject CHECK (status = 'rejected' OR rejection_reason IS NULL),
    CONSTRAINT rr_token_expiry_paired   CHECK (
        (verification_token IS NULL) = (token_expires_at IS NULL)
    )
);

-- One pending request per email at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_email_pending
    ON public.registration_request(email) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_rr_status    ON public.registration_request(status);
CREATE INDEX IF NOT EXISTS idx_rr_submitted ON public.registration_request(submitted_at DESC);


-- ================================================================
-- LOGIN_ATTEMPT
-- ================================================================

CREATE TABLE IF NOT EXISTS public.login_attempt (
    attempt_id      BIGSERIAL       PRIMARY KEY,
    email           TEXT            NOT NULL
                                    CHECK (LENGTH(email) BETWEEN 6 AND 150),
    ip_address      INET,
    attempted_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    success         BOOLEAN         NOT NULL DEFAULT FALSE,
    failure_reason  TEXT            CHECK (failure_reason IN (
                                        'USER_NOT_FOUND','ACCOUNT_INACTIVE',
                                        'EMAIL_NOT_VERIFIED','ROLE_NOT_PERMITTED'
                                    )),
    CONSTRAINT la_success_no_reason  CHECK (NOT success OR failure_reason IS NULL),
    CONSTRAINT la_failure_has_reason CHECK (success OR failure_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_la_ip_failures
    ON public.login_attempt(ip_address, attempted_at DESC)
    WHERE success = FALSE;


-- ================================================================
-- TRIGGERS
-- ================================================================

-- updated_at for all tables
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_student_updated
    BEFORE UPDATE ON public.student
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_instructor_updated
    BEFORE UPDATE ON public.instructor
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_rr_updated
    BEFORE UPDATE ON public.registration_request
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Phone normalisation (shared for all tables)
CREATE OR REPLACE FUNCTION public.normalise_phone_field()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.phone IS NOT NULL THEN
        NEW.phone := public.normalise_bd_phone(NEW.phone);
        IF NEW.phone IS NULL THEN
            RAISE EXCEPTION 'INVALID_BD_PHONE: use 01[3-9]XXXXXXXX format';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_phone
    BEFORE INSERT OR UPDATE OF phone ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.normalise_phone_field();

CREATE TRIGGER trg_student_phone
    BEFORE INSERT OR UPDATE OF phone ON public.student
    FOR EACH ROW EXECUTE FUNCTION public.normalise_phone_field();

CREATE TRIGGER trg_instructor_phone
    BEFORE INSERT OR UPDATE OF phone ON public.instructor
    FOR EACH ROW EXECUTE FUNCTION public.normalise_phone_field();

CREATE TRIGGER trg_rr_phone
    BEFORE INSERT OR UPDATE OF phone ON public.registration_request
    FOR EACH ROW EXECUTE FUNCTION public.normalise_phone_field();


-- Emergency contact phone (student)
CREATE OR REPLACE FUNCTION public.normalise_emergency_phone()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.emergency_contact_phone IS NOT NULL THEN
        NEW.emergency_contact_phone :=
            public.normalise_bd_phone(NEW.emergency_contact_phone);
        IF NEW.emergency_contact_phone IS NULL THEN
            RAISE EXCEPTION 'INVALID_EMERGENCY_PHONE: use 01[3-9]XXXXXXXX format';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_student_emerg_phone
    BEFORE INSERT OR UPDATE OF emergency_contact_phone ON public.student
    FOR EACH ROW EXECUTE FUNCTION public.normalise_emergency_phone();


-- Auto-create profile row on new auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role  public.app_role := 'user';
    v_fname TEXT := '';
    v_lname TEXT := '';
    v_phone TEXT;
BEGIN
    IF NEW.raw_user_meta_data ? 'role' THEN
        BEGIN
            v_role := (NEW.raw_user_meta_data ->> 'role')::public.app_role;
        EXCEPTION WHEN invalid_text_representation THEN
            v_role := 'user';
        END;
    END IF;

    v_fname := TRIM(COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''));
    v_lname := TRIM(COALESCE(NEW.raw_user_meta_data ->> 'last_name',  ''));

    IF NEW.raw_user_meta_data ? 'phone' THEN
        v_phone := public.normalise_bd_phone(
            TRIM(NEW.raw_user_meta_data ->> 'phone')
        );
    END IF;

    INSERT INTO public.profiles (id, role, first_name, last_name, phone)
    VALUES (NEW.id, v_role, v_fname, v_lname, v_phone)
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ================================================================
-- FUNCTIONS
-- ================================================================

-- Submit signup request
CREATE OR REPLACE FUNCTION public.fn_submit_signup_request(
    p_role           TEXT,
    p_email          TEXT,
    p_first_name     TEXT,
    p_last_name      TEXT,
    p_phone          TEXT        DEFAULT NULL,
    p_gender         TEXT        DEFAULT NULL,
    p_dob            DATE        DEFAULT NULL,
    p_program_id     INT         DEFAULT NULL,
    p_batch_year     SMALLINT    DEFAULT NULL,
    p_dept_id        INT         DEFAULT NULL,
    p_designation    TEXT        DEFAULT NULL,
    p_specialization TEXT        DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_token  TEXT;
    v_req_id INT;
    v_count  INT;
    v_email  TEXT := LOWER(TRIM(p_email));
    v_phone  TEXT;
BEGIN
    IF p_role NOT IN ('student','teacher') THEN
        RAISE EXCEPTION 'INVALID_ROLE';
    END IF;
    IF NOT public.is_valid_email(v_email) THEN
        RAISE EXCEPTION 'INVALID_EMAIL';
    END IF;
    IF NOT public.is_valid_name(TRIM(p_first_name)) THEN
        RAISE EXCEPTION 'INVALID_FIRST_NAME';
    END IF;
    IF NOT public.is_valid_name(TRIM(p_last_name)) THEN
        RAISE EXCEPTION 'INVALID_LAST_NAME';
    END IF;

    IF p_phone IS NOT NULL THEN
        v_phone := public.normalise_bd_phone(TRIM(p_phone));
        IF v_phone IS NULL THEN
            RAISE EXCEPTION 'INVALID_BD_PHONE: use 01[3-9]XXXXXXXX';
        END IF;
    END IF;

    IF p_dob IS NOT NULL THEN
        IF p_dob >= (CURRENT_DATE - INTERVAL '15 years') THEN
            RAISE EXCEPTION 'DOB: must be at least 15 years old';
        END IF;
        IF p_dob <= (CURRENT_DATE - INTERVAL '80 years') THEN
            RAISE EXCEPTION 'DOB: implausible date';
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.registration_request
        WHERE email = v_email AND status = 'pending';
    IF v_count > 0 THEN RAISE EXCEPTION 'REQUEST_ALREADY_PENDING'; END IF;

    SELECT COUNT(*) INTO v_count FROM auth.users WHERE email = v_email;
    IF v_count > 0 THEN RAISE EXCEPTION 'EMAIL_ALREADY_REGISTERED'; END IF;

    IF v_phone IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM public.registration_request
            WHERE phone = v_phone AND status = 'pending';
        IF v_count > 0 THEN RAISE EXCEPTION 'PHONE_IN_PENDING_REQUEST'; END IF;

        SELECT COUNT(*) INTO v_count FROM public.profiles WHERE phone = v_phone;
        IF v_count > 0 THEN RAISE EXCEPTION 'PHONE_ALREADY_REGISTERED'; END IF;
    END IF;

    IF p_role = 'student' THEN
        IF p_program_id IS NULL THEN RAISE EXCEPTION 'REQUIRED: program_id'; END IF;
        IF p_batch_year IS NULL  THEN RAISE EXCEPTION 'REQUIRED: batch_year'; END IF;
        IF p_dob IS NULL         THEN RAISE EXCEPTION 'REQUIRED: date_of_birth'; END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.program WHERE program_id = p_program_id AND is_active
        ) THEN RAISE EXCEPTION 'INVALID_PROGRAM_ID'; END IF;
    END IF;

    IF p_role = 'teacher' THEN
        IF p_dept_id IS NULL     THEN RAISE EXCEPTION 'REQUIRED: dept_id'; END IF;
        IF p_designation IS NULL THEN RAISE EXCEPTION 'REQUIRED: designation'; END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.department WHERE dept_id = p_dept_id AND is_active
        ) THEN RAISE EXCEPTION 'INVALID_DEPT_ID'; END IF;
    END IF;

    v_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO public.registration_request (
        role_requested, email, first_name, last_name,
        phone, gender, date_of_birth,
        program_id, batch_year,
        dept_id, designation, specialization,
        verification_token, token_expires_at
    ) VALUES (
        p_role::public.app_role,
        v_email,
        TRIM(p_first_name), TRIM(p_last_name),
        v_phone,
        p_gender::public.gender_val,
        p_dob,
        p_program_id, p_batch_year,
        p_dept_id,
        p_designation::public.designation_val,
        NULLIF(TRIM(p_specialization), ''),
        v_token, NOW() + INTERVAL '48 hours'
    )
    RETURNING request_id INTO v_req_id;

    RETURN v_req_id;
END;
$$;


-- Verify email token
CREATE OR REPLACE FUNCTION public.fn_verify_email_token(p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
        RETURN 'TOKEN_INVALID_FORMAT';
    END IF;

    UPDATE public.registration_request
    SET email_verified = TRUE
    WHERE verification_token = p_token
      AND token_expires_at   > NOW()
      AND email_verified     = FALSE
      AND status             = 'pending';

    IF NOT FOUND THEN RETURN 'TOKEN_INVALID_OR_EXPIRED'; END IF;
    RETURN 'OK';
END;
$$;


-- Approve request (call AFTER Edge Fn sends invite)
CREATE OR REPLACE FUNCTION public.fn_approve_request(
    p_request_id   INT,
    p_admin_id     UUID,
    p_student_roll TEXT DEFAULT NULL,
    p_employee_id  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    r               public.registration_request%ROWTYPE;
    v_user_id       UUID;
    v_student_id    INT;
    v_instructor_id INT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_admin_id AND role = 'admin' AND is_active
    ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

    SELECT * INTO r FROM public.registration_request
    WHERE request_id = p_request_id AND status = 'pending'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND_OR_PROCESSED'; END IF;

    SELECT id INTO v_user_id FROM auth.users WHERE email = r.email;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_USER_NOT_CREATED: send invite first';
    END IF;

    IF r.role_requested = 'student' THEN
        IF TRIM(COALESCE(p_student_roll, '')) = '' THEN
            RAISE EXCEPTION 'STUDENT_ROLL_REQUIRED';
        END IF;
        IF p_student_roll !~ '^[0-9]{4}-[A-Z]{2,10}-[0-9]{3,6}$' THEN
            RAISE EXCEPTION 'INVALID_STUDENT_ROLL: format YYYY-DEPT-NNN';
        END IF;
        INSERT INTO public.student (
            profile_id, program_id, first_name, last_name,
            gender, date_of_birth, phone, student_roll, batch_year
        ) VALUES (
            v_user_id, r.program_id, r.first_name, r.last_name,
            r.gender, r.date_of_birth, r.phone,
            p_student_roll, r.batch_year
        ) RETURNING student_id INTO v_student_id;

    ELSIF r.role_requested = 'teacher' THEN
        IF TRIM(COALESCE(p_employee_id, '')) = '' THEN
            RAISE EXCEPTION 'EMPLOYEE_ID_REQUIRED';
        END IF;
        IF p_employee_id !~ '^EMP-[0-9]{3,6}$' THEN
            RAISE EXCEPTION 'INVALID_EMPLOYEE_ID: format EMP-XXXXXX';
        END IF;
        INSERT INTO public.instructor (
            profile_id, dept_id, first_name, last_name,
            gender, date_of_birth, phone,
            employee_id, designation, specialization
        ) VALUES (
            v_user_id, r.dept_id, r.first_name, r.last_name,
            r.gender, r.date_of_birth, r.phone,
            p_employee_id, r.designation, r.specialization
        ) RETURNING instructor_id INTO v_instructor_id;
    END IF;

    INSERT INTO public.profiles (
        id, role, first_name, last_name, phone,
        student_id, instructor_id
    ) VALUES (
        v_user_id, r.role_requested,
        r.first_name, r.last_name, r.phone,
        v_student_id, v_instructor_id
    )
    ON CONFLICT (id) DO UPDATE SET
        role          = EXCLUDED.role,
        first_name    = EXCLUDED.first_name,
        last_name     = EXCLUDED.last_name,
        phone         = EXCLUDED.phone,
        student_id    = EXCLUDED.student_id,
        instructor_id = EXCLUDED.instructor_id,
        updated_at    = NOW();

    UPDATE public.registration_request SET
        status      = 'approved',
        reviewed_by = p_admin_id,
        reviewed_at = NOW()
    WHERE request_id = p_request_id;

    RETURN jsonb_build_object(
        'user_id',       v_user_id,
        'role',          r.role_requested,
        'student_id',    v_student_id,
        'instructor_id', v_instructor_id
    );
END;
$$;


-- Reject request
CREATE OR REPLACE FUNCTION public.fn_reject_request(
    p_request_id INT,
    p_admin_id   UUID,
    p_reason     TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_admin_id AND role = 'admin' AND is_active
    ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

    IF p_reason IS NOT NULL AND LENGTH(TRIM(p_reason)) < 5 THEN
        RAISE EXCEPTION 'REJECTION_REASON_TOO_SHORT';
    END IF;

    UPDATE public.registration_request SET
        status           = 'rejected',
        reviewed_by      = p_admin_id,
        reviewed_at      = NOW(),
        rejection_reason = NULLIF(TRIM(p_reason), '')
    WHERE request_id = p_request_id AND status = 'pending';

    IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND_OR_PROCESSED'; END IF;
END;
$$;


-- Change role (server-side only)
CREATE OR REPLACE FUNCTION public.fn_change_role(
    p_admin_id  UUID,
    p_target_id UUID,
    p_new_role  public.app_role
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_old_role public.app_role;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_admin_id AND role = 'admin' AND is_active
    ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

    IF p_admin_id = p_target_id THEN
        RAISE EXCEPTION 'CANNOT_CHANGE_OWN_ROLE';
    END IF;

    SELECT role INTO v_old_role FROM public.profiles WHERE id = p_target_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;

    IF v_old_role = 'admin' AND p_new_role <> 'admin' THEN
        IF (SELECT COUNT(*) FROM public.profiles
            WHERE role = 'admin' AND is_active) <= 1
        THEN
            RAISE EXCEPTION 'CANNOT_REMOVE_LAST_ADMIN';
        END IF;
    END IF;

    UPDATE public.profiles SET role = p_new_role WHERE id = p_target_id;
END;
$$;


-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempt        ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_own_select"
    ON public.profiles FOR SELECT TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "profiles_admin_select"
    ON public.profiles FOR SELECT TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "profiles_own_update"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        role          = (SELECT role          FROM public.profiles WHERE id = auth.uid())
        AND is_active = (SELECT is_active     FROM public.profiles WHERE id = auth.uid())
        AND student_id    IS NOT DISTINCT FROM
            (SELECT student_id    FROM public.profiles WHERE id = auth.uid())
        AND instructor_id IS NOT DISTINCT FROM
            (SELECT instructor_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "profiles_admin_update"
    ON public.profiles FOR UPDATE TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "profiles_no_insert"
    ON public.profiles FOR INSERT TO authenticated, anon
    WITH CHECK (FALSE);

CREATE POLICY "profiles_no_delete"
    ON public.profiles FOR DELETE TO authenticated
    USING (FALSE);

-- student
CREATE POLICY "student_own_select"
    ON public.student FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

CREATE POLICY "student_teacher_admin_select"
    ON public.student FOR SELECT TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('teacher','admin')
    );

-- instructor
CREATE POLICY "instructor_own_select"
    ON public.instructor FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

CREATE POLICY "instructor_all_auth_select"
    ON public.instructor FOR SELECT TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid())
        IN ('student','teacher','admin')
    );

-- registration_request
CREATE POLICY "rr_anon_insert"
    ON public.registration_request FOR INSERT TO anon, authenticated
    WITH CHECK (role_requested IN ('student','teacher') AND status = 'pending');

CREATE POLICY "rr_admin_select"
    ON public.registration_request FOR SELECT TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "rr_admin_update"
    ON public.registration_request FOR UPDATE TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "rr_no_delete"
    ON public.registration_request FOR DELETE TO authenticated
    USING (FALSE);

-- login_attempt
CREATE POLICY "la_admin_select"
    ON public.login_attempt FOR SELECT TO authenticated
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "la_no_write"
    ON public.login_attempt FOR INSERT TO authenticated, anon
    WITH CHECK (FALSE);


-- ================================================================
-- VIEWS
-- ================================================================

CREATE OR REPLACE VIEW public.v_pending_requests AS
SELECT
    r.request_id,
    r.role_requested,
    r.email,
    r.first_name || ' ' || r.last_name AS full_name,
    r.phone,
    r.gender,
    r.date_of_birth,
    r.email_verified,
    prog.program_name,
    d.dept_name,
    r.designation,
    r.batch_year,
    r.submitted_at,
    NOW() - r.submitted_at             AS waiting_for
FROM public.registration_request r
LEFT JOIN public.program    prog ON prog.program_id = r.program_id
LEFT JOIN public.department d    ON d.dept_id       = r.dept_id
WHERE r.status = 'pending'
ORDER BY r.email_verified DESC, r.submitted_at ASC;

CREATE OR REPLACE VIEW public.v_suspicious_logins AS
SELECT
    ip_address,
    COUNT(*)                  AS failed_count,
    MAX(attempted_at)         AS last_seen,
    array_agg(DISTINCT email) AS emails_tried
FROM public.login_attempt
WHERE success = FALSE
  AND attempted_at > NOW() - INTERVAL '15 minutes'
  AND ip_address IS NOT NULL
GROUP BY ip_address
HAVING COUNT(*) >= 5
ORDER BY failed_count DESC;


-- ================================================================
-- BOOTSTRAP FIRST ADMIN
-- ================================================================
/*
UPDATE public.profiles
SET role = 'admin', first_name = 'System', last_name = 'Administrator'
WHERE id = 'paste-uuid-here';
*/