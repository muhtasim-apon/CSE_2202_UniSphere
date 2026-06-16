


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'user',
    'student',
    'teacher',
    'admin'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."attachment_file_type" AS ENUM (
    'image',
    'pdf',
    'doc',
    'markdown',
    'mp4',
    'mp3',
    'audio',
    'other'
);


ALTER TYPE "public"."attachment_file_type" OWNER TO "postgres";


CREATE TYPE "public"."designation_val" AS ENUM (
    'Lecturer',
    'Assistant Professor',
    'Associate Professor',
    'Professor',
    'Adjunct',
    'Visiting'
);


ALTER TYPE "public"."designation_val" OWNER TO "postgres";


CREATE TYPE "public"."gender_val" AS ENUM (
    'Male',
    'Female',
    'Other'
);


ALTER TYPE "public"."gender_val" OWNER TO "postgres";


CREATE TYPE "public"."notice_audience_type" AS ENUM (
    'all',
    'students',
    'teachers'
);


ALTER TYPE "public"."notice_audience_type" OWNER TO "postgres";


CREATE TYPE "public"."notice_category" AS ENUM (
    'academics_exams',
    'general',
    'hall_info',
    'transport',
    'emergency',
    'upcoming_events'
);


ALTER TYPE "public"."notice_category" OWNER TO "postgres";


CREATE TYPE "public"."reaction_type" AS ENUM (
    'like',
    'love',
    'haha',
    'wow',
    'sad',
    'angry',
    'fire',
    'clap',
    'think',
    'party'
);


ALTER TYPE "public"."reaction_type" OWNER TO "postgres";


CREATE TYPE "public"."request_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."request_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_bd_phone"("p" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $_$
      SELECT p ~ '^(\+?880)?0?1[3-9][0-9]{8}$'
  $_$;


ALTER FUNCTION "public"."is_valid_bd_phone"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_name"("n" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    AS $_$
BEGIN
    RETURN
        LENGTH(TRIM(n)) BETWEEN 2 AND 60
        AND TRIM(n) NOT LIKE '%  %'          -- no double spaces
        AND TRIM(n) !~ '[0-9]'               -- no digits
        AND TRIM(n) !~ '[!@#$%^&*()_=+\[\]{}<>?/\\|]'; -- no special chars
END;
$_$;


ALTER FUNCTION "public"."is_valid_name"("n" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "public"."app_role" DEFAULT 'user'::"public"."app_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "first_name" "text" DEFAULT ''::"text" NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL,
    "display_name" "text" GENERATED ALWAYS AS (TRIM(BOTH FROM (("first_name" || ' '::"text") || "last_name"))) STORED,
    "phone" "text",
    "avatar_url" "text",
    "student_id" integer,
    "instructor_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_admin_no_link" CHECK ((("role" <> ALL (ARRAY['admin'::"public"."app_role", 'user'::"public"."app_role"])) OR (("student_id" IS NULL) AND ("instructor_id" IS NULL)))),
    CONSTRAINT "profiles_avatar_url_check" CHECK ((("avatar_url" IS NULL) OR ("avatar_url" ~ '^https?://.{3,}'::"text"))),
    CONSTRAINT "profiles_first_name_check" CHECK ((("first_name" = ''::"text") OR "public"."is_valid_name"("first_name"))),
    CONSTRAINT "profiles_last_name_check" CHECK ((("last_name" = ''::"text") OR "public"."is_valid_name"("last_name"))),
    CONSTRAINT "profiles_one_link" CHECK ((NOT (("student_id" IS NOT NULL) AND ("instructor_id" IS NOT NULL)))),
    CONSTRAINT "profiles_phone_check" CHECK ((("phone" IS NULL) OR "public"."is_valid_bd_phone"("phone")))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_profile"() RETURNS "public"."profiles"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT * FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."current_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_instructor_profile_restrictions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF NEW.profile_id   IS DISTINCT FROM OLD.profile_id
       OR NEW.dept_id        <> OLD.dept_id
       OR NEW.employee_id    <> OLD.employee_id
       OR NEW.hire_date      <> OLD.hire_date
       OR NEW.designation    <> OLD.designation
       OR NEW.is_active      <> OLD.is_active
    THEN
        RAISE EXCEPTION 'PROFILE_FIELD_LOCKED: cannot modify restricted instructor fields';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_instructor_profile_restrictions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_single_choice_vote"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_is_multiple BOOLEAN;
BEGIN
  SELECT is_multiple INTO v_is_multiple FROM notice_board_poll WHERE id = NEW.poll_id;
  IF NOT v_is_multiple THEN
    DELETE FROM notice_board_poll_vote
    WHERE poll_id = NEW.poll_id AND user_id = NEW.user_id AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_single_choice_vote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_student_profile_restrictions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF NEW.profile_id      IS DISTINCT FROM OLD.profile_id
       OR NEW.program_id        <> OLD.program_id
       OR NEW.student_roll      <> OLD.student_roll
       OR NEW.batch_year        <> OLD.batch_year
       OR NEW.current_semester  <> OLD.current_semester
       OR NEW.cgpa              <> OLD.cgpa
       OR NEW.total_credits     <> OLD.total_credits
       OR NEW.is_active         <> OLD.is_active
    THEN
        RAISE EXCEPTION 'PROFILE_FIELD_LOCKED: cannot modify restricted student fields';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_student_profile_restrictions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_approve_request"("p_request_id" integer, "p_admin_id" "uuid", "p_student_roll" "text" DEFAULT NULL::"text", "p_employee_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."fn_approve_request"("p_request_id" integer, "p_admin_id" "uuid", "p_student_roll" "text", "p_employee_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_change_role"("p_admin_id" "uuid", "p_target_id" "uuid", "p_new_role" "public"."app_role") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."fn_change_role"("p_admin_id" "uuid", "p_target_id" "uuid", "p_new_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_reject_request"("p_request_id" integer, "p_admin_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."fn_reject_request"("p_request_id" integer, "p_admin_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_submit_signup_request"("p_role" "text", "p_email" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text" DEFAULT NULL::"text", "p_gender" "text" DEFAULT NULL::"text", "p_dob" "date" DEFAULT NULL::"date", "p_program_id" integer DEFAULT NULL::integer, "p_batch_year" smallint DEFAULT NULL::smallint, "p_dept_id" integer DEFAULT NULL::integer, "p_designation" "text" DEFAULT NULL::"text", "p_specialization" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."fn_submit_signup_request"("p_role" "text", "p_email" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_gender" "text", "p_dob" "date", "p_program_id" integer, "p_batch_year" smallint, "p_dept_id" integer, "p_designation" "text", "p_specialization" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_verify_email_token"("p_token" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."fn_verify_email_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_email"("e" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $_$
    SELECT e ~ '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+[.][a-zA-Z]{2,}$'
       AND LENGTH(e) BETWEEN 6 AND 150
       AND e NOT LIKE '%..%'
$_$;


ALTER FUNCTION "public"."is_valid_email"("e" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalise_bd_phone"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $_$
      SELECT CASE
          WHEN p ~ '^\+8801[3-9][0-9]{8}$' THEN p
          WHEN p ~ '^8801[3-9][0-9]{8}$'   THEN '+' || p
          WHEN p ~ '^01[3-9][0-9]{8}$'     THEN '+880' || substring(p FROM 2)
          ELSE NULL
      END 
  $_$;


ALTER FUNCTION "public"."normalise_bd_phone"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalise_emergency_phone"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."normalise_emergency_phone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalise_phone_field"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."normalise_phone_field"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_from_instructor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE public.profiles
    SET first_name = NEW.first_name,
        last_name  = NEW.last_name,
        avatar_url = NEW.profile_photo
    WHERE id = NEW.profile_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_profile_from_instructor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_from_student"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE public.profiles
    SET first_name = NEW.first_name,
        last_name  = NEW.last_name,
        avatar_url = NEW.profile_photo
    WHERE id = NEW.profile_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_profile_from_student"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notice_board_post_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  IF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
    NEW.is_edited = TRUE;
    NEW.edited_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_notice_board_post_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department" (
    "dept_id" integer NOT NULL,
    "dept_name" "text" NOT NULL,
    "dept_code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "department_dept_code_check" CHECK (("dept_code" ~ '^[A-Z]{2,10}$'::"text")),
    CONSTRAINT "department_dept_name_check" CHECK ((("length"(TRIM(BOTH FROM "dept_name")) >= 2) AND ("length"(TRIM(BOTH FROM "dept_name")) <= 100)))
);


ALTER TABLE "public"."department" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."department_dept_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."department_dept_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."department_dept_id_seq" OWNED BY "public"."department"."dept_id";



CREATE TABLE IF NOT EXISTS "public"."instructor" (
    "instructor_id" integer NOT NULL,
    "profile_id" "uuid",
    "dept_id" integer NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "gender" "public"."gender_val",
    "date_of_birth" "date",
    "phone" "text",
    "office_location" "text",
    "employee_id" "text" NOT NULL,
    "hire_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "designation" "public"."designation_val" DEFAULT 'Lecturer'::"public"."designation_val" NOT NULL,
    "specialization" "text",
    "bio" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_photo" "text",
    CONSTRAINT "instructor_bio_check" CHECK ((("bio" IS NULL) OR (("length"(TRIM(BOTH FROM "bio")) >= 10) AND ("length"(TRIM(BOTH FROM "bio")) <= 2000)))),
    CONSTRAINT "instructor_date_of_birth_check" CHECK ((("date_of_birth" IS NULL) OR (("date_of_birth" < CURRENT_DATE) AND ("date_of_birth" > (CURRENT_DATE - '80 years'::interval)) AND ("date_of_birth" <= (CURRENT_DATE - '22 years'::interval))))),
    CONSTRAINT "instructor_employee_id_check" CHECK (("employee_id" ~ '^EMP-[0-9]{3,6}$'::"text")),
    CONSTRAINT "instructor_first_name_check" CHECK ("public"."is_valid_name"("first_name")),
    CONSTRAINT "instructor_hire_date_check" CHECK (("hire_date" <= CURRENT_DATE)),
    CONSTRAINT "instructor_last_name_check" CHECK ("public"."is_valid_name"("last_name")),
    CONSTRAINT "instructor_office_location_check" CHECK ((("office_location" IS NULL) OR (("length"(TRIM(BOTH FROM "office_location")) >= 2) AND ("length"(TRIM(BOTH FROM "office_location")) <= 100)))),
    CONSTRAINT "instructor_phone_check" CHECK ((("phone" IS NULL) OR "public"."is_valid_bd_phone"("phone"))),
    CONSTRAINT "instructor_profile_photo_check" CHECK ((("profile_photo" IS NULL) OR ("profile_photo" ~ '^https?://.{3,}'::"text"))),
    CONSTRAINT "instructor_specialization_check" CHECK ((("specialization" IS NULL) OR (("length"(TRIM(BOTH FROM "specialization")) >= 2) AND ("length"(TRIM(BOTH FROM "specialization")) <= 200))))
);


ALTER TABLE "public"."instructor" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."instructor_instructor_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."instructor_instructor_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."instructor_instructor_id_seq" OWNED BY "public"."instructor"."instructor_id";



CREATE TABLE IF NOT EXISTS "public"."login_attempt" (
    "attempt_id" bigint NOT NULL,
    "email" "text" NOT NULL,
    "ip_address" "inet",
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "success" boolean DEFAULT false NOT NULL,
    "failure_reason" "text",
    CONSTRAINT "la_failure_has_reason" CHECK (("success" OR ("failure_reason" IS NOT NULL))),
    CONSTRAINT "la_success_no_reason" CHECK (((NOT "success") OR ("failure_reason" IS NULL))),
    CONSTRAINT "login_attempt_email_check" CHECK ((("length"("email") >= 6) AND ("length"("email") <= 150))),
    CONSTRAINT "login_attempt_failure_reason_check" CHECK (("failure_reason" = ANY (ARRAY['USER_NOT_FOUND'::"text", 'ACCOUNT_INACTIVE'::"text", 'EMAIL_NOT_VERIFIED'::"text", 'ROLE_NOT_PERMITTED'::"text"])))
);


ALTER TABLE "public"."login_attempt" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."login_attempt_attempt_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."login_attempt_attempt_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."login_attempt_attempt_id_seq" OWNED BY "public"."login_attempt"."attempt_id";



CREATE TABLE IF NOT EXISTS "public"."notice_board_attachment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "file_type" "public"."attachment_file_type" DEFAULT 'other'::"public"."attachment_file_type" NOT NULL,
    "file_size" bigint,
    "mime_type" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notice_board_attachment_file_size_check" CHECK (("file_size" > 0))
);


ALTER TABLE "public"."notice_board_attachment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notice_board_poll" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "is_multiple" boolean DEFAULT false NOT NULL,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notice_board_poll_question_check" CHECK (("char_length"(TRIM(BOTH FROM "question")) > 0))
);


ALTER TABLE "public"."notice_board_poll" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notice_board_poll_option" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid" NOT NULL,
    "option_text" "text" NOT NULL,
    "display_order" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notice_board_poll_option_option_text_check" CHECK (("char_length"(TRIM(BOTH FROM "option_text")) > 0))
);


ALTER TABLE "public"."notice_board_poll_option" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notice_board_poll_vote" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notice_board_poll_vote" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notice_board_post" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "category" "public"."notice_category" DEFAULT 'general'::"public"."notice_category" NOT NULL,
    "audience" "public"."notice_audience_type" DEFAULT 'all'::"public"."notice_audience_type" NOT NULL,
    "title" character varying(255) NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "is_edited" boolean DEFAULT false NOT NULL,
    "edited_at" timestamp with time zone,
    "has_poll" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notice_board_post_title_check" CHECK (("char_length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."notice_board_post" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notice_board_reaction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction" "public"."reaction_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notice_board_reaction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program" (
    "program_id" integer NOT NULL,
    "dept_id" integer NOT NULL,
    "program_name" "text" NOT NULL,
    "program_code" "text" NOT NULL,
    "degree_level" "text" NOT NULL,
    "duration_years" numeric(3,1) NOT NULL,
    "total_credits" smallint NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "program_degree_level_check" CHECK (("degree_level" = ANY (ARRAY['Certificate'::"text", 'Diploma'::"text", 'Associate'::"text", 'Bachelor'::"text", 'Master'::"text", 'PhD'::"text"]))),
    CONSTRAINT "program_duration_years_check" CHECK ((("duration_years" >= 0.5) AND ("duration_years" <= (8)::numeric))),
    CONSTRAINT "program_program_code_check" CHECK (("program_code" ~ '^[A-Z0-9-]{2,20}$'::"text")),
    CONSTRAINT "program_program_name_check" CHECK ((("length"(TRIM(BOTH FROM "program_name")) >= 3) AND ("length"(TRIM(BOTH FROM "program_name")) <= 150))),
    CONSTRAINT "program_total_credits_check" CHECK ((("total_credits" >= 1) AND ("total_credits" <= 300)))
);


ALTER TABLE "public"."program" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."program_program_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."program_program_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."program_program_id_seq" OWNED BY "public"."program"."program_id";



CREATE TABLE IF NOT EXISTS "public"."registration_request" (
    "request_id" integer NOT NULL,
    "role_requested" "public"."app_role" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "phone" "text",
    "gender" "public"."gender_val",
    "date_of_birth" "date",
    "program_id" integer,
    "batch_year" smallint,
    "dept_id" integer,
    "designation" "public"."designation_val",
    "specialization" "text",
    "email_verified" boolean DEFAULT false NOT NULL,
    "verification_token" "text",
    "token_expires_at" timestamp with time zone,
    "status" "public"."request_status" DEFAULT 'pending'::"public"."request_status" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "registration_request_batch_year_check" CHECK ((("batch_year" IS NULL) OR (("batch_year" >= 2000) AND ("batch_year" <= ((EXTRACT(year FROM CURRENT_DATE))::smallint + 1))))),
    CONSTRAINT "registration_request_date_of_birth_check" CHECK ((("date_of_birth" IS NULL) OR (("date_of_birth" < CURRENT_DATE) AND ("date_of_birth" > (CURRENT_DATE - '80 years'::interval)) AND ("date_of_birth" <= (CURRENT_DATE - '15 years'::interval))))),
    CONSTRAINT "registration_request_email_check" CHECK ("public"."is_valid_email"("email")),
    CONSTRAINT "registration_request_first_name_check" CHECK ("public"."is_valid_name"("first_name")),
    CONSTRAINT "registration_request_last_name_check" CHECK ("public"."is_valid_name"("last_name")),
    CONSTRAINT "registration_request_phone_check" CHECK ((("phone" IS NULL) OR "public"."is_valid_bd_phone"("phone"))),
    CONSTRAINT "registration_request_rejection_reason_check" CHECK ((("rejection_reason" IS NULL) OR (("length"(TRIM(BOTH FROM "rejection_reason")) >= 5) AND ("length"(TRIM(BOTH FROM "rejection_reason")) <= 500)))),
    CONSTRAINT "registration_request_role_requested_check" CHECK (("role_requested" = ANY (ARRAY['student'::"public"."app_role", 'teacher'::"public"."app_role"]))),
    CONSTRAINT "registration_request_specialization_check" CHECK ((("specialization" IS NULL) OR (("length"(TRIM(BOTH FROM "specialization")) >= 2) AND ("length"(TRIM(BOTH FROM "specialization")) <= 200)))),
    CONSTRAINT "registration_request_verification_token_check" CHECK ((("verification_token" IS NULL) OR ("length"("verification_token") = 64))),
    CONSTRAINT "rr_email_lowercase" CHECK (("email" = "lower"("email"))),
    CONSTRAINT "rr_no_cross_fields" CHECK (((NOT (("role_requested" = 'student'::"public"."app_role") AND (("dept_id" IS NOT NULL) OR ("designation" IS NOT NULL)))) AND (NOT (("role_requested" = 'teacher'::"public"."app_role") AND (("program_id" IS NOT NULL) OR ("batch_year" IS NOT NULL)))))),
    CONSTRAINT "rr_reason_only_on_reject" CHECK ((("status" = 'rejected'::"public"."request_status") OR ("rejection_reason" IS NULL))),
    CONSTRAINT "rr_reviewed_when_decided" CHECK ((("status" = 'pending'::"public"."request_status") OR ("reviewed_at" IS NOT NULL))),
    CONSTRAINT "rr_student_fields" CHECK ((("role_requested" <> 'student'::"public"."app_role") OR (("program_id" IS NOT NULL) AND ("batch_year" IS NOT NULL) AND ("date_of_birth" IS NOT NULL)))),
    CONSTRAINT "rr_teacher_fields" CHECK ((("role_requested" <> 'teacher'::"public"."app_role") OR (("dept_id" IS NOT NULL) AND ("designation" IS NOT NULL)))),
    CONSTRAINT "rr_token_expiry_paired" CHECK ((("verification_token" IS NULL) = ("token_expires_at" IS NULL)))
);


ALTER TABLE "public"."registration_request" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."registration_request_request_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."registration_request_request_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."registration_request_request_id_seq" OWNED BY "public"."registration_request"."request_id";



CREATE TABLE IF NOT EXISTS "public"."student" (
    "student_id" integer NOT NULL,
    "profile_id" "uuid",
    "program_id" integer NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "gender" "public"."gender_val",
    "date_of_birth" "date" NOT NULL,
    "phone" "text",
    "address" "text",
    "student_roll" "text" NOT NULL,
    "batch_year" smallint NOT NULL,
    "current_semester" smallint DEFAULT 1 NOT NULL,
    "cgpa" numeric(4,2) DEFAULT 0.00 NOT NULL,
    "total_credits" smallint DEFAULT 0 NOT NULL,
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_photo" "text",
    CONSTRAINT "student_address_check" CHECK ((("address" IS NULL) OR (("length"(TRIM(BOTH FROM "address")) >= 5) AND ("length"(TRIM(BOTH FROM "address")) <= 300)))),
    CONSTRAINT "student_batch_year_check" CHECK ((("batch_year" >= 2000) AND ("batch_year" <= ((EXTRACT(year FROM CURRENT_DATE))::smallint + 1)))),
    CONSTRAINT "student_cgpa_check" CHECK ((("cgpa" >= 0.00) AND ("cgpa" <= 4.00))),
    CONSTRAINT "student_current_semester_check" CHECK ((("current_semester" >= 1) AND ("current_semester" <= 20))),
    CONSTRAINT "student_date_of_birth_check" CHECK ((("date_of_birth" < CURRENT_DATE) AND ("date_of_birth" > (CURRENT_DATE - '80 years'::interval)) AND ("date_of_birth" <= (CURRENT_DATE - '15 years'::interval)))),
    CONSTRAINT "student_emergency_contact_name_check" CHECK ((("emergency_contact_name" IS NULL) OR "public"."is_valid_name"("emergency_contact_name"))),
    CONSTRAINT "student_emergency_contact_phone_check" CHECK ((("emergency_contact_phone" IS NULL) OR "public"."is_valid_bd_phone"("emergency_contact_phone"))),
    CONSTRAINT "student_first_name_check" CHECK ("public"."is_valid_name"("first_name")),
    CONSTRAINT "student_last_name_check" CHECK ("public"."is_valid_name"("last_name")),
    CONSTRAINT "student_phone_check" CHECK ((("phone" IS NULL) OR "public"."is_valid_bd_phone"("phone"))),
    CONSTRAINT "student_profile_photo_check" CHECK ((("profile_photo" IS NULL) OR ("profile_photo" ~ '^https?://.{3,}'::"text"))),
    CONSTRAINT "student_student_roll_check" CHECK (("student_roll" ~ '^[0-9]{4,20}$'::"text")),
    CONSTRAINT "student_total_credits_check" CHECK (("total_credits" >= 0))
);


ALTER TABLE "public"."student" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."student_student_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."student_student_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."student_student_id_seq" OWNED BY "public"."student"."student_id";



CREATE OR REPLACE VIEW "public"."v_my_instructor_profile" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "profile_id",
    "p"."role",
    "p"."created_at" AS "account_created_at",
    "i"."instructor_id",
    "i"."first_name",
    "i"."last_name",
    "i"."gender",
    "i"."date_of_birth",
    "i"."phone",
    "i"."office_location",
    "i"."employee_id",
    "i"."hire_date",
    "i"."designation",
    "i"."specialization",
    "i"."bio",
    "i"."profile_photo",
    "i"."is_active",
    "i"."updated_at",
    "d"."dept_id",
    "d"."dept_name",
    "d"."dept_code"
   FROM (("public"."profiles" "p"
     JOIN "public"."instructor" "i" ON (("i"."profile_id" = "p"."id")))
     JOIN "public"."department" "d" ON (("d"."dept_id" = "i"."dept_id")));


ALTER VIEW "public"."v_my_instructor_profile" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_my_student_profile" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "profile_id",
    "p"."role",
    "p"."created_at" AS "account_created_at",
    "s"."student_id",
    "s"."first_name",
    "s"."last_name",
    "s"."gender",
    "s"."date_of_birth",
    "s"."phone",
    "s"."address",
    "s"."student_roll",
    "s"."batch_year",
    "s"."current_semester",
    "s"."cgpa",
    "s"."total_credits",
    "s"."profile_photo",
    "s"."emergency_contact_name",
    "s"."emergency_contact_phone",
    "s"."is_active",
    "s"."updated_at",
    "prog"."program_id",
    "prog"."program_name",
    "prog"."program_code",
    "prog"."degree_level",
    "d"."dept_id",
    "d"."dept_name",
    "d"."dept_code"
   FROM ((("public"."profiles" "p"
     JOIN "public"."student" "s" ON (("s"."profile_id" = "p"."id")))
     JOIN "public"."program" "prog" ON (("prog"."program_id" = "s"."program_id")))
     JOIN "public"."department" "d" ON (("d"."dept_id" = "prog"."dept_id")));


ALTER VIEW "public"."v_my_student_profile" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_notice_board_posts" AS
 SELECT "p"."id",
    "p"."author_id",
    (("pr"."first_name" || ' '::"text") || "pr"."last_name") AS "author_name",
    "pr"."avatar_url" AS "author_avatar",
    "pr"."role" AS "author_role",
    "p"."category",
    "p"."audience",
    "p"."title",
    "p"."content",
    "p"."is_edited",
    "p"."edited_at",
    "p"."has_poll",
    "p"."created_at",
    "p"."updated_at",
    ( SELECT "count"(*) AS "count"
           FROM "public"."notice_board_attachment" "a"
          WHERE ("a"."post_id" = "p"."id")) AS "attachment_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."notice_board_reaction" "r"
          WHERE ("r"."post_id" = "p"."id")) AS "reaction_count"
   FROM ("public"."notice_board_post" "p"
     JOIN "public"."profiles" "pr" ON (("pr"."id" = "p"."author_id")));


ALTER VIEW "public"."v_notice_board_posts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pending_requests" AS
 SELECT "r"."request_id",
    "r"."role_requested",
    "r"."email",
    (("r"."first_name" || ' '::"text") || "r"."last_name") AS "full_name",
    "r"."phone",
    "r"."gender",
    "r"."date_of_birth",
    "r"."email_verified",
    "prog"."program_name",
    "d"."dept_name",
    "r"."designation",
    "r"."batch_year",
    "r"."submitted_at",
    ("now"() - "r"."submitted_at") AS "waiting_for"
   FROM (("public"."registration_request" "r"
     LEFT JOIN "public"."program" "prog" ON (("prog"."program_id" = "r"."program_id")))
     LEFT JOIN "public"."department" "d" ON (("d"."dept_id" = "r"."dept_id")))
  WHERE ("r"."status" = 'pending'::"public"."request_status")
  ORDER BY "r"."email_verified" DESC, "r"."submitted_at";


ALTER VIEW "public"."v_pending_requests" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_suspicious_logins" AS
 SELECT "ip_address",
    "count"(*) AS "failed_count",
    "max"("attempted_at") AS "last_seen",
    "array_agg"(DISTINCT "email") AS "emails_tried"
   FROM "public"."login_attempt"
  WHERE (("success" = false) AND ("attempted_at" > ("now"() - '00:15:00'::interval)) AND ("ip_address" IS NOT NULL))
  GROUP BY "ip_address"
 HAVING ("count"(*) >= 5)
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."v_suspicious_logins" OWNER TO "postgres";


ALTER TABLE ONLY "public"."department" ALTER COLUMN "dept_id" SET DEFAULT "nextval"('"public"."department_dept_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."instructor" ALTER COLUMN "instructor_id" SET DEFAULT "nextval"('"public"."instructor_instructor_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."login_attempt" ALTER COLUMN "attempt_id" SET DEFAULT "nextval"('"public"."login_attempt_attempt_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."program" ALTER COLUMN "program_id" SET DEFAULT "nextval"('"public"."program_program_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."registration_request" ALTER COLUMN "request_id" SET DEFAULT "nextval"('"public"."registration_request_request_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."student" ALTER COLUMN "student_id" SET DEFAULT "nextval"('"public"."student_student_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."department"
    ADD CONSTRAINT "department_dept_code_key" UNIQUE ("dept_code");



ALTER TABLE ONLY "public"."department"
    ADD CONSTRAINT "department_dept_name_key" UNIQUE ("dept_name");



ALTER TABLE ONLY "public"."department"
    ADD CONSTRAINT "department_pkey" PRIMARY KEY ("dept_id");



ALTER TABLE ONLY "public"."instructor"
    ADD CONSTRAINT "instructor_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."instructor"
    ADD CONSTRAINT "instructor_pkey" PRIMARY KEY ("instructor_id");



ALTER TABLE ONLY "public"."instructor"
    ADD CONSTRAINT "instructor_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."login_attempt"
    ADD CONSTRAINT "login_attempt_pkey" PRIMARY KEY ("attempt_id");



ALTER TABLE ONLY "public"."notice_board_attachment"
    ADD CONSTRAINT "notice_board_attachment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notice_board_poll_option"
    ADD CONSTRAINT "notice_board_poll_option_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notice_board_poll"
    ADD CONSTRAINT "notice_board_poll_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notice_board_poll"
    ADD CONSTRAINT "notice_board_poll_post_id_key" UNIQUE ("post_id");



ALTER TABLE ONLY "public"."notice_board_poll_vote"
    ADD CONSTRAINT "notice_board_poll_vote_option_id_user_id_key" UNIQUE ("option_id", "user_id");



ALTER TABLE ONLY "public"."notice_board_poll_vote"
    ADD CONSTRAINT "notice_board_poll_vote_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notice_board_post"
    ADD CONSTRAINT "notice_board_post_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notice_board_reaction"
    ADD CONSTRAINT "notice_board_reaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notice_board_reaction"
    ADD CONSTRAINT "notice_board_reaction_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_instructor_id_key" UNIQUE ("instructor_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_student_id_key" UNIQUE ("student_id");



ALTER TABLE ONLY "public"."program"
    ADD CONSTRAINT "program_pkey" PRIMARY KEY ("program_id");



ALTER TABLE ONLY "public"."program"
    ADD CONSTRAINT "program_program_code_key" UNIQUE ("program_code");



ALTER TABLE ONLY "public"."registration_request"
    ADD CONSTRAINT "registration_request_pkey" PRIMARY KEY ("request_id");



ALTER TABLE ONLY "public"."registration_request"
    ADD CONSTRAINT "registration_request_verification_token_key" UNIQUE ("verification_token");



ALTER TABLE ONLY "public"."student"
    ADD CONSTRAINT "student_pkey" PRIMARY KEY ("student_id");



ALTER TABLE ONLY "public"."student"
    ADD CONSTRAINT "student_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."student"
    ADD CONSTRAINT "student_student_roll_key" UNIQUE ("student_roll");



CREATE INDEX "idx_instructor_dept" ON "public"."instructor" USING "btree" ("dept_id");



CREATE INDEX "idx_la_ip_failures" ON "public"."login_attempt" USING "btree" ("ip_address", "attempted_at" DESC) WHERE ("success" = false);



CREATE INDEX "idx_nba_post" ON "public"."notice_board_attachment" USING "btree" ("post_id");



CREATE INDEX "idx_nbp_author" ON "public"."notice_board_post" USING "btree" ("author_id");



CREATE INDEX "idx_nbp_category" ON "public"."notice_board_post" USING "btree" ("category");



CREATE INDEX "idx_nbp_created" ON "public"."notice_board_post" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_nbpv_poll" ON "public"."notice_board_poll_vote" USING "btree" ("poll_id");



CREATE INDEX "idx_nbr_post" ON "public"."notice_board_reaction" USING "btree" ("post_id");



CREATE INDEX "idx_nbr_user" ON "public"."notice_board_reaction" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_active" ON "public"."profiles" USING "btree" ("is_active");



CREATE INDEX "idx_profiles_instructor" ON "public"."profiles" USING "btree" ("instructor_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_student" ON "public"."profiles" USING "btree" ("student_id");



CREATE UNIQUE INDEX "idx_rr_email_pending" ON "public"."registration_request" USING "btree" ("email") WHERE ("status" = 'pending'::"public"."request_status");



CREATE INDEX "idx_rr_status" ON "public"."registration_request" USING "btree" ("status");



CREATE INDEX "idx_rr_submitted" ON "public"."registration_request" USING "btree" ("submitted_at" DESC);



CREATE INDEX "idx_student_batch" ON "public"."student" USING "btree" ("batch_year");



CREATE INDEX "idx_student_program" ON "public"."student" USING "btree" ("program_id");



CREATE INDEX "idx_student_roll" ON "public"."student" USING "btree" ("student_roll");



CREATE OR REPLACE TRIGGER "trg_instructor_phone" BEFORE INSERT OR UPDATE OF "phone" ON "public"."instructor" FOR EACH ROW EXECUTE FUNCTION "public"."normalise_phone_field"();



CREATE OR REPLACE TRIGGER "trg_instructor_profile_guard" BEFORE UPDATE ON "public"."instructor" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_instructor_profile_restrictions"();



CREATE OR REPLACE TRIGGER "trg_instructor_sync_profile" AFTER UPDATE OF "first_name", "last_name", "profile_photo" ON "public"."instructor" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_from_instructor"();



CREATE OR REPLACE TRIGGER "trg_instructor_updated" BEFORE UPDATE ON "public"."instructor" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_nbp_updated_at" BEFORE UPDATE ON "public"."notice_board_post" FOR EACH ROW EXECUTE FUNCTION "public"."update_notice_board_post_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_phone" BEFORE INSERT OR UPDATE OF "phone" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."normalise_phone_field"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rr_phone" BEFORE INSERT OR UPDATE OF "phone" ON "public"."registration_request" FOR EACH ROW EXECUTE FUNCTION "public"."normalise_phone_field"();



CREATE OR REPLACE TRIGGER "trg_rr_updated" BEFORE UPDATE ON "public"."registration_request" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_single_choice_vote" AFTER INSERT ON "public"."notice_board_poll_vote" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_single_choice_vote"();



CREATE OR REPLACE TRIGGER "trg_student_emerg_phone" BEFORE INSERT OR UPDATE OF "emergency_contact_phone" ON "public"."student" FOR EACH ROW EXECUTE FUNCTION "public"."normalise_emergency_phone"();



CREATE OR REPLACE TRIGGER "trg_student_phone" BEFORE INSERT OR UPDATE OF "phone" ON "public"."student" FOR EACH ROW EXECUTE FUNCTION "public"."normalise_phone_field"();



CREATE OR REPLACE TRIGGER "trg_student_profile_guard" BEFORE UPDATE ON "public"."student" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_student_profile_restrictions"();



CREATE OR REPLACE TRIGGER "trg_student_sync_profile" AFTER UPDATE OF "first_name", "last_name", "profile_photo" ON "public"."student" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_from_student"();



CREATE OR REPLACE TRIGGER "trg_student_updated" BEFORE UPDATE ON "public"."student" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "fk_profiles_instructor" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor"("instructor_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "fk_profiles_student" FOREIGN KEY ("student_id") REFERENCES "public"."student"("student_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."instructor"
    ADD CONSTRAINT "instructor_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "public"."department"("dept_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."instructor"
    ADD CONSTRAINT "instructor_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notice_board_attachment"
    ADD CONSTRAINT "notice_board_attachment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."notice_board_post"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notice_board_poll_option"
    ADD CONSTRAINT "notice_board_poll_option_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."notice_board_poll"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notice_board_poll"
    ADD CONSTRAINT "notice_board_poll_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."notice_board_post"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notice_board_poll_vote"
    ADD CONSTRAINT "notice_board_poll_vote_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."notice_board_poll_option"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notice_board_poll_vote"
    ADD CONSTRAINT "notice_board_poll_vote_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."notice_board_poll"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notice_board_poll_vote"
    ADD CONSTRAINT "notice_board_poll_vote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notice_board_post"
    ADD CONSTRAINT "notice_board_post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notice_board_reaction"
    ADD CONSTRAINT "notice_board_reaction_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."notice_board_post"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notice_board_reaction"
    ADD CONSTRAINT "notice_board_reaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program"
    ADD CONSTRAINT "program_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "public"."department"("dept_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."registration_request"
    ADD CONSTRAINT "registration_request_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "public"."department"("dept_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."registration_request"
    ADD CONSTRAINT "registration_request_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."program"("program_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."registration_request"
    ADD CONSTRAINT "registration_request_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student"
    ADD CONSTRAINT "student_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student"
    ADD CONSTRAINT "student_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."program"("program_id") ON UPDATE CASCADE ON DELETE RESTRICT;



CREATE POLICY "attachments_delete" ON "public"."notice_board_attachment" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."notice_board_post" "p"
  WHERE (("p"."id" = "notice_board_attachment"."post_id") AND ("p"."author_id" = "auth"."uid"())))));



CREATE POLICY "attachments_insert" ON "public"."notice_board_attachment" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."notice_board_post" "p"
  WHERE (("p"."id" = "notice_board_attachment"."post_id") AND ("p"."author_id" = "auth"."uid"())))));



CREATE POLICY "attachments_select" ON "public"."notice_board_attachment" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."notice_board_post" "p"
  WHERE (("p"."id" = "notice_board_attachment"."post_id") AND (("p"."audience" = ANY (ARRAY['all'::"public"."notice_audience_type", 'students'::"public"."notice_audience_type"])) OR (("p"."audience" = 'teachers'::"public"."notice_audience_type") AND ("public"."current_user_role"() = 'teacher'::"text")))))));



ALTER TABLE "public"."department" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "department_auth_select" ON "public"."department" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."instructor" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "instructor_all_auth_select" ON "public"."instructor" FOR SELECT TO "authenticated" USING ((("public"."current_profile"())."role" = ANY (ARRAY['student'::"public"."app_role", 'teacher'::"public"."app_role", 'admin'::"public"."app_role"])));



CREATE POLICY "instructor_own_select" ON "public"."instructor" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "instructor_own_update" ON "public"."instructor" FOR UPDATE TO "authenticated" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "la_admin_select" ON "public"."login_attempt" FOR SELECT TO "authenticated" USING ((("public"."current_profile"())."role" = 'admin'::"public"."app_role"));



CREATE POLICY "la_no_write" ON "public"."login_attempt" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



ALTER TABLE "public"."login_attempt" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notice_board_attachment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notice_board_poll" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notice_board_poll_option" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notice_board_poll_vote" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notice_board_post" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notice_board_reaction" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notices_delete" ON "public"."notice_board_post" FOR DELETE TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "notices_insert" ON "public"."notice_board_post" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "notices_select" ON "public"."notice_board_post" FOR SELECT TO "authenticated" USING ((("audience" = 'all'::"public"."notice_audience_type") OR (("audience" = 'students'::"public"."notice_audience_type") AND ("public"."current_user_role"() = 'student'::"text")) OR (("audience" = 'teachers'::"public"."notice_audience_type") AND ("public"."current_user_role"() = 'teacher'::"text"))));



CREATE POLICY "notices_update" ON "public"."notice_board_post" FOR UPDATE TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "poll_insert" ON "public"."notice_board_poll" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."notice_board_post" "p"
  WHERE (("p"."id" = "notice_board_poll"."post_id") AND ("p"."author_id" = "auth"."uid"())))));



CREATE POLICY "poll_option_insert" ON "public"."notice_board_poll_option" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."notice_board_poll" "po"
     JOIN "public"."notice_board_post" "p" ON (("p"."id" = "po"."post_id")))
  WHERE (("po"."id" = "notice_board_poll_option"."poll_id") AND ("p"."author_id" = "auth"."uid"())))));



CREATE POLICY "poll_option_select" ON "public"."notice_board_poll_option" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "poll_select" ON "public"."notice_board_poll" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "poll_vote_delete" ON "public"."notice_board_poll_vote" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "poll_vote_insert" ON "public"."notice_board_poll_vote" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "poll_vote_select" ON "public"."notice_board_poll_vote" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("public"."current_profile"())."role" = 'admin'::"public"."app_role"));



CREATE POLICY "profiles_admin_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("public"."current_profile"())."role" = 'admin'::"public"."app_role"));



CREATE POLICY "profiles_no_delete" ON "public"."profiles" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "profiles_no_insert" ON "public"."profiles" FOR INSERT TO "authenticated", "anon" WITH CHECK (false);



CREATE POLICY "profiles_own_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_own_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK ((("role" = ("public"."current_profile"())."role") AND ("is_active" = ("public"."current_profile"())."is_active") AND (NOT ("student_id" IS DISTINCT FROM ("public"."current_profile"())."student_id")) AND (NOT ("instructor_id" IS DISTINCT FROM ("public"."current_profile"())."instructor_id"))));



ALTER TABLE "public"."program" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "program_auth_select" ON "public"."program" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "reactions_delete" ON "public"."notice_board_reaction" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "reactions_insert" ON "public"."notice_board_reaction" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "reactions_select" ON "public"."notice_board_reaction" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "reactions_update" ON "public"."notice_board_reaction" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."registration_request" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rr_admin_select" ON "public"."registration_request" FOR SELECT TO "authenticated" USING ((("public"."current_profile"())."role" = 'admin'::"public"."app_role"));



CREATE POLICY "rr_admin_update" ON "public"."registration_request" FOR UPDATE TO "authenticated" USING ((("public"."current_profile"())."role" = 'admin'::"public"."app_role"));



CREATE POLICY "rr_anon_insert" ON "public"."registration_request" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("role_requested" = ANY (ARRAY['student'::"public"."app_role", 'teacher'::"public"."app_role"])) AND ("status" = 'pending'::"public"."request_status")));



CREATE POLICY "rr_no_delete" ON "public"."registration_request" FOR DELETE TO "authenticated" USING (false);



ALTER TABLE "public"."student" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_own_select" ON "public"."student" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "student_own_update" ON "public"."student" FOR UPDATE TO "authenticated" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "student_teacher_admin_select" ON "public"."student" FOR SELECT TO "authenticated" USING ((("public"."current_profile"())."role" = ANY (ARRAY['teacher'::"public"."app_role", 'admin'::"public"."app_role"])));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notice_board_post";



REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."is_valid_bd_phone"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_bd_phone"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_bd_phone"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_name"("n" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_name"("n" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_name"("n" "text") TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "anon";



GRANT ALL ON FUNCTION "public"."current_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_instructor_profile_restrictions"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_instructor_profile_restrictions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_instructor_profile_restrictions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_single_choice_vote"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_single_choice_vote"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_single_choice_vote"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_student_profile_restrictions"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_student_profile_restrictions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_student_profile_restrictions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_approve_request"("p_request_id" integer, "p_admin_id" "uuid", "p_student_roll" "text", "p_employee_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_approve_request"("p_request_id" integer, "p_admin_id" "uuid", "p_student_roll" "text", "p_employee_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_approve_request"("p_request_id" integer, "p_admin_id" "uuid", "p_student_roll" "text", "p_employee_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_change_role"("p_admin_id" "uuid", "p_target_id" "uuid", "p_new_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_change_role"("p_admin_id" "uuid", "p_target_id" "uuid", "p_new_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_change_role"("p_admin_id" "uuid", "p_target_id" "uuid", "p_new_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_reject_request"("p_request_id" integer, "p_admin_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_reject_request"("p_request_id" integer, "p_admin_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_reject_request"("p_request_id" integer, "p_admin_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_submit_signup_request"("p_role" "text", "p_email" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_gender" "text", "p_dob" "date", "p_program_id" integer, "p_batch_year" smallint, "p_dept_id" integer, "p_designation" "text", "p_specialization" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_submit_signup_request"("p_role" "text", "p_email" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_gender" "text", "p_dob" "date", "p_program_id" integer, "p_batch_year" smallint, "p_dept_id" integer, "p_designation" "text", "p_specialization" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_submit_signup_request"("p_role" "text", "p_email" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_gender" "text", "p_dob" "date", "p_program_id" integer, "p_batch_year" smallint, "p_dept_id" integer, "p_designation" "text", "p_specialization" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_verify_email_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_verify_email_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_verify_email_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_email"("e" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_email"("e" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_email"("e" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalise_bd_phone"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalise_bd_phone"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalise_bd_phone"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalise_emergency_phone"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalise_emergency_phone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalise_emergency_phone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalise_phone_field"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalise_phone_field"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalise_phone_field"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_from_instructor"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_from_instructor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_from_instructor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_from_student"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_from_student"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_from_student"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notice_board_post_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_notice_board_post_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notice_board_post_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."department" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."department" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."department" TO "anon";



GRANT ALL ON SEQUENCE "public"."department_dept_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."department_dept_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."department_dept_id_seq" TO "anon";



GRANT ALL ON TABLE "public"."instructor" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."instructor" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."instructor" TO "anon";



GRANT ALL ON SEQUENCE "public"."instructor_instructor_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."instructor_instructor_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."instructor_instructor_id_seq" TO "anon";



GRANT ALL ON TABLE "public"."login_attempt" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."login_attempt" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."login_attempt" TO "anon";



GRANT ALL ON SEQUENCE "public"."login_attempt_attempt_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."login_attempt_attempt_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."login_attempt_attempt_id_seq" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_attachment" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_attachment" TO "authenticated";
GRANT ALL ON TABLE "public"."notice_board_attachment" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_poll" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_poll" TO "authenticated";
GRANT ALL ON TABLE "public"."notice_board_poll" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_poll_option" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_poll_option" TO "authenticated";
GRANT ALL ON TABLE "public"."notice_board_poll_option" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_poll_vote" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_poll_vote" TO "authenticated";
GRANT ALL ON TABLE "public"."notice_board_poll_vote" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_post" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_post" TO "authenticated";
GRANT ALL ON TABLE "public"."notice_board_post" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_reaction" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notice_board_reaction" TO "authenticated";
GRANT ALL ON TABLE "public"."notice_board_reaction" TO "service_role";



GRANT ALL ON TABLE "public"."program" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."program" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."program" TO "anon";



GRANT ALL ON SEQUENCE "public"."program_program_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."program_program_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."program_program_id_seq" TO "anon";



GRANT ALL ON TABLE "public"."registration_request" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."registration_request" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."registration_request" TO "anon";



GRANT ALL ON SEQUENCE "public"."registration_request_request_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."registration_request_request_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."registration_request_request_id_seq" TO "anon";



GRANT ALL ON TABLE "public"."student" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."student" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."student" TO "anon";



GRANT ALL ON SEQUENCE "public"."student_student_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."student_student_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."student_student_id_seq" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_my_instructor_profile" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_my_instructor_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."v_my_instructor_profile" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_my_student_profile" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_my_student_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."v_my_student_profile" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_notice_board_posts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_notice_board_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."v_notice_board_posts" TO "service_role";



GRANT ALL ON TABLE "public"."v_pending_requests" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_pending_requests" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_pending_requests" TO "anon";



GRANT ALL ON TABLE "public"."v_suspicious_logins" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_suspicious_logins" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."v_suspicious_logins" TO "anon";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




























