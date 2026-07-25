


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






CREATE TYPE "public"."achievement_content_type" AS ENUM (
    'project',
    'certificate',
    'research_paper',
    'hackathon'
);


ALTER TYPE "public"."achievement_content_type" OWNER TO "postgres";


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


CREATE TYPE "public"."chat_request_status" AS ENUM (
    'pending',
    'accepted',
    'declined'
);


ALTER TYPE "public"."chat_request_status" OWNER TO "postgres";


CREATE TYPE "public"."chat_room_type" AS ENUM (
    'direct',
    'advisor',
    'group'
);


ALTER TYPE "public"."chat_room_type" OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."auto_assign_grade"("p_marks" numeric, "p_total" numeric) RETURNS TABLE("grade" character varying, "grade_points" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    pct NUMERIC;
BEGIN
    IF p_total IS NULL OR p_total <= 0 THEN
        RETURN QUERY SELECT 'F'::VARCHAR, 0.00::NUMERIC; RETURN;
    END IF;
    pct := (p_marks / p_total) * 100;
    IF    pct >= 80 THEN RETURN QUERY SELECT 'A+'::VARCHAR, 4.00::NUMERIC;
    ELSIF pct >= 75 THEN RETURN QUERY SELECT 'A'::VARCHAR,  3.75::NUMERIC;
    ELSIF pct >= 70 THEN RETURN QUERY SELECT 'A-'::VARCHAR, 3.50::NUMERIC;
    ELSIF pct >= 65 THEN RETURN QUERY SELECT 'B+'::VARCHAR, 3.25::NUMERIC;
    ELSIF pct >= 60 THEN RETURN QUERY SELECT 'B'::VARCHAR,  3.00::NUMERIC;
    ELSIF pct >= 55 THEN RETURN QUERY SELECT 'B-'::VARCHAR, 2.75::NUMERIC;
    ELSIF pct >= 50 THEN RETURN QUERY SELECT 'C+'::VARCHAR, 2.50::NUMERIC;
    ELSIF pct >= 45 THEN RETURN QUERY SELECT 'C'::VARCHAR,  2.25::NUMERIC;
    ELSIF pct >= 40 THEN RETURN QUERY SELECT 'D'::VARCHAR,  2.00::NUMERIC;
    ELSE                  RETURN QUERY SELECT 'F'::VARCHAR,  0.00::NUMERIC;
    END IF;
END;
$$;


ALTER FUNCTION "public"."auto_assign_grade"("p_marks" numeric, "p_total" numeric) OWNER TO "postgres";


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
    -- Service role (backend) bypasses all restrictions
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Only lock the identity link and admin-controlled status.
    -- student_roll, batch_year, current_semester, program_id
    -- are now self-editable by the student.
    -- cgpa and total_credits are auto-calculated by the backend.
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id
       OR NEW.is_active <> OLD.is_active
    THEN
        RAISE EXCEPTION 'PROFILE_FIELD_LOCKED: cannot modify restricted student fields';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_student_profile_restrictions"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."fn_get_or_create_direct_room"("p_other_profile_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_room_id UUID;
  v_my_id   UUID := auth.uid();
BEGIN
  -- Find existing direct room shared by both users
  SELECT crm1.room_id INTO v_room_id
  FROM public.chat_room_member crm1
  JOIN public.chat_room_member crm2 ON crm1.room_id = crm2.room_id
  JOIN public.chat_room cr ON cr.id = crm1.room_id
  WHERE crm1.profile_id = v_my_id
    AND crm2.profile_id = p_other_profile_id
    AND cr.type = 'direct'
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  -- Create new direct room
  INSERT INTO public.chat_room (type, created_by)
  VALUES ('direct', v_my_id)
  RETURNING id INTO v_room_id;

  INSERT INTO public.chat_room_member (room_id, profile_id, member_role) VALUES
    (v_room_id, v_my_id, 'owner'),
    (v_room_id, p_other_profile_id, 'member');

  RETURN v_room_id;
END;
$$;


ALTER FUNCTION "public"."fn_get_or_create_direct_room"("p_other_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_get_or_create_direct_room"("p_other_profile_id" "uuid", "p_my_profile_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DECLARE
    v_room_id UUID;
    v_my_id   UUID := COALESCE(p_my_profile_id, auth.uid());
  BEGIN
    SELECT crm1.room_id INTO v_room_id
    FROM public.chat_room_member crm1
    JOIN public.chat_room_member crm2 ON crm1.room_id =
  crm2.room_id
    JOIN public.chat_room cr ON cr.id = crm1.room_id
    WHERE crm1.profile_id = v_my_id
      AND crm2.profile_id = p_other_profile_id
      AND cr.type = 'direct'
    LIMIT 1;

    IF v_room_id IS NOT NULL THEN
      RETURN v_room_id;
    END IF;

    INSERT INTO public.chat_room (type, created_by)
    VALUES ('direct', v_my_id)
    RETURNING id INTO v_room_id;

    INSERT INTO public.chat_room_member (room_id, profile_id,
  member_role) VALUES
      (v_room_id, v_my_id, 'owner'),
      (v_room_id, p_other_profile_id, 'member');

    RETURN v_room_id;
  END;
  $$;


ALTER FUNCTION "public"."fn_get_or_create_direct_room"("p_other_profile_id" "uuid", "p_my_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_hash_password"("p_password" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'extensions', 'public'
    AS $$
  SELECT extensions.crypt(p_password, extensions.gen_salt('bf'));
$$;


ALTER FUNCTION "public"."fn_hash_password"("p_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_join_room_by_code"("p_code" "text", "p_password" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'extensions', 'public'
    AS $$
DECLARE
  v_room    public.chat_room%ROWTYPE;
  v_my_id   UUID := auth.uid();
BEGIN
  SELECT * INTO v_room FROM public.chat_room WHERE room_code = p_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found for code: %', p_code;
  END IF;

  IF v_room.password_hash IS NOT NULL THEN
    IF p_password IS NULL OR extensions.crypt(p_password, v_room.password_hash) <> v_room.password_hash THEN
      RAISE EXCEPTION 'Incorrect password';
    END IF;
  END IF;

  -- Add member (ignore if already a member)
  INSERT INTO public.chat_room_member (room_id, profile_id, member_role)
  VALUES (v_room.id, v_my_id, 'member')
  ON CONFLICT (room_id, profile_id) DO NOTHING;

  RETURN v_room.id;
END;
$$;


ALTER FUNCTION "public"."fn_join_room_by_code"("p_code" "text", "p_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_join_room_by_code"("p_code" "text", "p_password" "text" DEFAULT NULL::"text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'extensions', 'public'
    AS $$
  DECLARE
    v_room    public.chat_room%ROWTYPE;
    v_my_id   UUID := COALESCE(p_user_id, auth.uid());
  BEGIN
    SELECT * INTO v_room FROM public.chat_room WHERE room_code = p_code;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Room not found for code: %', p_code;
    END IF;

    IF v_room.password_hash IS NOT NULL THEN
      IF p_password IS NULL OR extensions.crypt(p_password, v_room.password_hash) <>
  v_room.password_hash THEN
        RAISE EXCEPTION 'Incorrect password';
      END IF;
    END IF;

    INSERT INTO public.chat_room_member (room_id, profile_id, member_role)
    VALUES (v_room.id, v_my_id, 'member')
    ON CONFLICT (room_id, profile_id) DO NOTHING;

    RETURN v_room.id;
  END;
  $$;


ALTER FUNCTION "public"."fn_join_room_by_code"("p_code" "text", "p_password" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_profile_id_by_email"("p_email" "text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
    SELECT id FROM auth.users WHERE email = lower(p_email) LIMIT 1;
  $$;


ALTER FUNCTION "public"."fn_profile_id_by_email"("p_email" "text") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."is_room_member"("p_room_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_member
    WHERE room_id = p_room_id AND profile_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_room_member"("p_room_id" "uuid") OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."achievement_comment" (
    "comment_id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_type" "public"."achievement_content_type" NOT NULL,
    "target_id" integer NOT NULL,
    "parent_comment_id" integer,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "achievement_comment_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 1000)))
);


ALTER TABLE "public"."achievement_comment" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."achievement_comment_comment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."achievement_comment_comment_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."achievement_comment_comment_id_seq" OWNED BY "public"."achievement_comment"."comment_id";



CREATE TABLE IF NOT EXISTS "public"."achievement_rating" (
    "rating_id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_type" "public"."achievement_content_type" NOT NULL,
    "target_id" integer NOT NULL,
    "rating" smallint NOT NULL,
    "rated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "achievement_rating_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."achievement_rating" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."achievement_rating_rating_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."achievement_rating_rating_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."achievement_rating_rating_id_seq" OWNED BY "public"."achievement_rating"."rating_id";



CREATE TABLE IF NOT EXISTS "public"."achievement_reaction" (
    "reaction_id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_type" "public"."achievement_content_type" NOT NULL,
    "target_id" integer NOT NULL,
    "emoji" character varying(10) NOT NULL,
    "reacted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "achievement_reaction_emoji_check" CHECK ((("emoji")::"text" = ANY ((ARRAY['👍'::character varying, '❤️'::character varying, '🔥'::character varying, '🎉'::character varying, '🤩'::character varying, '💡'::character varying, '👏'::character varying, '😮'::character varying, '🏆'::character varying, '💪'::character varying])::"text"[])))
);


ALTER TABLE "public"."achievement_reaction" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."achievement_reaction_reaction_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."achievement_reaction_reaction_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."achievement_reaction_reaction_id_seq" OWNED BY "public"."achievement_reaction"."reaction_id";



CREATE TABLE IF NOT EXISTS "public"."advisor" (
    "id" bigint NOT NULL,
    "student_id" integer NOT NULL,
    "advisor_instructor_id" integer NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."advisor" OWNER TO "postgres";


ALTER TABLE "public"."advisor" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."advisor_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."attendance_record" (
    "record_id" integer NOT NULL,
    "session_id" integer NOT NULL,
    "student_id" integer NOT NULL,
    "status" character varying(10) DEFAULT 'Present'::character varying NOT NULL,
    "remarks" character varying(200),
    "marked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "attendance_record_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Present'::character varying, 'Absent'::character varying, 'Late'::character varying, 'Excused'::character varying])::"text"[])))
);


ALTER TABLE "public"."attendance_record" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."attendance_record_record_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."attendance_record_record_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."attendance_record_record_id_seq" OWNED BY "public"."attendance_record"."record_id";



CREATE TABLE IF NOT EXISTS "public"."attendance_session" (
    "session_id" integer NOT NULL,
    "manual_course_id" integer NOT NULL,
    "instructor_id" integer NOT NULL,
    "session_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "session_title" character varying(255),
    "topic" character varying(255),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attendance_session" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."attendance_session_session_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."attendance_session_session_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."attendance_session_session_id_seq" OWNED BY "public"."attendance_session"."session_id";



CREATE TABLE IF NOT EXISTS "public"."certificate" (
    "certificate_id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "cert_name" character varying(255) NOT NULL,
    "issuing_org" character varying(255) NOT NULL,
    "issue_month" smallint,
    "issue_year" smallint NOT NULL,
    "expiry_month" smallint,
    "expiry_year" smallint,
    "credential_id" character varying(255),
    "credential_url" character varying(500),
    "is_published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "certificate_check" CHECK ((("expiry_year" IS NULL) OR ("expiry_year" > "issue_year") OR (("expiry_year" = "issue_year") AND (("expiry_month" IS NULL) OR ("issue_month" IS NULL) OR ("expiry_month" >= "issue_month"))))),
    CONSTRAINT "certificate_expiry_month_check" CHECK ((("expiry_month" >= 1) AND ("expiry_month" <= 12))),
    CONSTRAINT "certificate_expiry_year_check" CHECK ((("expiry_year" >= 2000) AND ("expiry_year" <= 2100))),
    CONSTRAINT "certificate_issue_month_check" CHECK ((("issue_month" >= 1) AND ("issue_month" <= 12))),
    CONSTRAINT "certificate_issue_year_check" CHECK ((("issue_year" >= 2000) AND ("issue_year" <= 2100)))
);


ALTER TABLE "public"."certificate" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."certificate_certificate_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."certificate_certificate_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."certificate_certificate_id_seq" OWNED BY "public"."certificate"."certificate_id";



CREATE TABLE IF NOT EXISTS "public"."certificate_media" (
    "media_id" integer NOT NULL,
    "certificate_id" integer NOT NULL,
    "file_url" character varying(500) NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "file_type" character varying(50) NOT NULL,
    "file_size_bytes" bigint NOT NULL,
    "mime_type" character varying(100),
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "certificate_media_file_size_bytes_check" CHECK ((("file_size_bytes" > 0) AND ("file_size_bytes" <= 52428800))),
    CONSTRAINT "certificate_media_file_type_check" CHECK ((("file_type")::"text" = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'audio'::character varying, 'document'::character varying, 'presentation'::character varying, 'site'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."certificate_media" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."certificate_media_media_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."certificate_media_media_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."certificate_media_media_id_seq" OWNED BY "public"."certificate_media"."media_id";



CREATE TABLE IF NOT EXISTS "public"."certificate_skill" (
    "certificate_id" integer NOT NULL,
    "skill_id" integer NOT NULL
);


ALTER TABLE "public"."certificate_skill" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cgpa_record" (
    "record_id" integer NOT NULL,
    "student_id" integer NOT NULL,
    "cgpa" numeric(4,2) NOT NULL,
    "total_credits" numeric(6,1) DEFAULT 0 NOT NULL,
    "total_points" numeric(8,2) DEFAULT 0 NOT NULL,
    "exam_count" integer DEFAULT 0 NOT NULL,
    "semester" character varying(50),
    "source" character varying(20) DEFAULT 'exam_marks'::character varying NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cgpa_record_cgpa_check" CHECK ((("cgpa" >= (0)::numeric) AND ("cgpa" <= (4)::numeric))),
    CONSTRAINT "cgpa_record_source_check" CHECK ((("source")::"text" = ANY ((ARRAY['exam_marks'::character varying, 'manual'::character varying])::"text"[])))
);


ALTER TABLE "public"."cgpa_record" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cgpa_record_record_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cgpa_record_record_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cgpa_record_record_id_seq" OWNED BY "public"."cgpa_record"."record_id";



CREATE TABLE IF NOT EXISTS "public"."chat_message" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body" "text",
    "reply_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone
);


ALTER TABLE "public"."chat_message" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_message_attachment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "file_type" "public"."attachment_file_type" DEFAULT 'other'::"public"."attachment_file_type" NOT NULL,
    "file_size" bigint,
    "mime_type" character varying(100)
);


ALTER TABLE "public"."chat_message_attachment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_message_reaction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction" "public"."reaction_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_message_reaction" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_request" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_id" "uuid" NOT NULL,
    "to_id" "uuid" NOT NULL,
    "status" "public"."chat_request_status" DEFAULT 'pending'::"public"."chat_request_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    "room_id" "uuid",
    "room_title" "text",
    CONSTRAINT "chat_request_no_self" CHECK (("from_id" <> "to_id"))
);


ALTER TABLE "public"."chat_request" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_room" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "public"."chat_room_type" NOT NULL,
    "title" "text",
    "room_code" "text",
    "password_hash" "text",
    "is_ephemeral" boolean DEFAULT false NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text"
);


ALTER TABLE "public"."chat_room" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_room_member" (
    "room_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "member_role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone,
    "nickname" "text",
    CONSTRAINT "chat_room_member_member_role_check" CHECK (("member_role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."chat_room_member" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_invite" (
    "invite_id" integer NOT NULL,
    "manual_course_id" integer NOT NULL,
    "student_id" integer NOT NULL,
    "invited_by" integer NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "message" character varying(500),
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "course_invite_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'dismissed'::character varying])::"text"[])))
);


ALTER TABLE "public"."course_invite" OWNER TO "postgres";


COMMENT ON TABLE "public"."course_invite" IS 'Teacher-initiated invite to a student. One row per course-student pair; UPSERT on resend.';



CREATE SEQUENCE IF NOT EXISTS "public"."course_invite_invite_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."course_invite_invite_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."course_invite_invite_id_seq" OWNED BY "public"."course_invite"."invite_id";



CREATE TABLE IF NOT EXISTS "public"."course_resource" (
    "resource_id" integer NOT NULL,
    "manual_course_id" integer NOT NULL,
    "uploaded_by" integer NOT NULL,
    "title" character varying(500) NOT NULL,
    "description" "text",
    "resource_type" character varying(20) NOT NULL,
    "file_url" character varying(1000),
    "file_name" character varying(500),
    "file_size_bytes" bigint,
    "mime_type" character varying(100),
    "storage_path" character varying(1000),
    "external_url" character varying(1000),
    "is_published" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "download_count" integer DEFAULT 0 NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "course_resource_download_count_check" CHECK (("download_count" >= 0)),
    CONSTRAINT "course_resource_file_size_bytes_check" CHECK (("file_size_bytes" >= 0)),
    CONSTRAINT "course_resource_resource_type_check" CHECK ((("resource_type")::"text" = ANY ((ARRAY['pdf'::character varying, 'image'::character varying, 'video'::character varying, 'audio'::character varying, 'document'::character varying, 'presentation'::character varying, 'drive_link'::character varying, 'external_link'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."course_resource" OWNER TO "postgres";


COMMENT ON COLUMN "public"."course_resource"."file_size_bytes" IS 'Up to 2 GB (2147483648 bytes) — enforced at application layer.';



CREATE SEQUENCE IF NOT EXISTS "public"."course_resource_resource_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."course_resource_resource_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."course_resource_resource_id_seq" OWNED BY "public"."course_resource"."resource_id";



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



CREATE TABLE IF NOT EXISTS "public"."exam" (
    "exam_id" integer NOT NULL,
    "manual_course_id" integer,
    "exam_name" character varying(255) NOT NULL,
    "exam_type" character varying(30) DEFAULT 'Midterm'::character varying NOT NULL,
    "total_marks" numeric(6,2) NOT NULL,
    "credit_hours" numeric(3,1) DEFAULT 3.0,
    "exam_date" "date",
    "semester" character varying(50),
    "academic_year" character varying(20),
    "description" "text",
    "is_published" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "exam_credit_hours_check" CHECK (("credit_hours" > (0)::numeric)),
    CONSTRAINT "exam_exam_type_check" CHECK ((("exam_type")::"text" = ANY ((ARRAY['Midterm'::character varying, 'Final'::character varying, 'Quiz'::character varying, 'Assignment'::character varying, 'Lab'::character varying, 'Viva'::character varying, 'Presentation'::character varying, 'Other'::character varying])::"text"[]))),
    CONSTRAINT "exam_total_marks_check" CHECK (("total_marks" > (0)::numeric))
);


ALTER TABLE "public"."exam" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."exam_exam_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."exam_exam_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exam_exam_id_seq" OWNED BY "public"."exam"."exam_id";



CREATE TABLE IF NOT EXISTS "public"."exam_mark" (
    "mark_id" integer NOT NULL,
    "exam_id" integer NOT NULL,
    "student_id" integer NOT NULL,
    "marks_obtained" numeric(6,2) NOT NULL,
    "grade" character varying(5),
    "grade_points" numeric(3,2),
    "remarks" "text",
    "entered_by" "uuid" NOT NULL,
    "entered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "exam_mark_grade_check" CHECK ((("grade")::"text" = ANY ((ARRAY['A+'::character varying, 'A'::character varying, 'A-'::character varying, 'B+'::character varying, 'B'::character varying, 'B-'::character varying, 'C+'::character varying, 'C'::character varying, 'D'::character varying, 'F'::character varying])::"text"[]))),
    CONSTRAINT "exam_mark_grade_points_check" CHECK ((("grade_points" >= (0)::numeric) AND ("grade_points" <= (4)::numeric))),
    CONSTRAINT "exam_mark_marks_obtained_check" CHECK (("marks_obtained" >= (0)::numeric))
);


ALTER TABLE "public"."exam_mark" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."exam_mark_mark_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."exam_mark_mark_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exam_mark_mark_id_seq" OWNED BY "public"."exam_mark"."mark_id";



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



CREATE TABLE IF NOT EXISTS "public"."manual_course" (
    "manual_course_id" integer NOT NULL,
    "instructor_id" integer NOT NULL,
    "dept_id" integer,
    "course_name" character varying(255) NOT NULL,
    "course_code" character varying(50),
    "description" "text",
    "credit_hours" numeric(3,1) DEFAULT 3.0,
    "enroll_code" character varying(20) NOT NULL,
    "semester" character varying(50),
    "academic_year" character varying(20),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "join_link_token" character varying(32) DEFAULT "encode"("extensions"."gen_random_bytes"(16), 'hex'::"text") NOT NULL,
    "semester_number" smallint,
    CONSTRAINT "manual_course_credit_hours_check" CHECK (("credit_hours" > (0)::numeric)),
    CONSTRAINT "manual_course_semester_number_check" CHECK ((("semester_number" >= 1) AND ("semester_number" <= 8)))
);


ALTER TABLE "public"."manual_course" OWNER TO "postgres";


COMMENT ON COLUMN "public"."manual_course"."join_link_token" IS 'URL-safe hex token for shareable join link. Unique per course, immutable after creation.';



COMMENT ON COLUMN "public"."manual_course"."semester_number" IS '1=Y1S1, 2=Y1S2, 3=Y2S1, 4=Y2S2, 5=Y3S1, 6=Y3S2, 7=Y4S1, 8=Y4S2';



CREATE SEQUENCE IF NOT EXISTS "public"."manual_course_manual_course_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."manual_course_manual_course_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."manual_course_manual_course_id_seq" OWNED BY "public"."manual_course"."manual_course_id";



CREATE TABLE IF NOT EXISTS "public"."manual_enrollment" (
    "enrollment_id" integer NOT NULL,
    "manual_course_id" integer NOT NULL,
    "student_id" integer NOT NULL,
    "enrolled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."manual_enrollment" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."manual_enrollment_enrollment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."manual_enrollment_enrollment_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."manual_enrollment_enrollment_id_seq" OWNED BY "public"."manual_enrollment"."enrollment_id";



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


CREATE TABLE IF NOT EXISTS "public"."notification" (
    "notification_id" integer NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "notif_type" character varying(60) NOT NULL,
    "title" character varying(255) NOT NULL,
    "body" "text",
    "achievement_type" "public"."achievement_content_type",
    "target_id" integer,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_notif_type_check" CHECK ((("notif_type")::"text" = ANY ((ARRAY['new_project'::character varying, 'new_certificate'::character varying, 'new_research_paper'::character varying, 'new_comment'::character varying, 'new_reaction'::character varying, 'new_rating'::character varying, 'new_notice'::character varying, 'new_event'::character varying, 'general'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."notification" REPLICA IDENTITY FULL;


ALTER TABLE "public"."notification" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notification_notification_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notification_notification_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notification_notification_id_seq" OWNED BY "public"."notification"."notification_id";



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



CREATE TABLE IF NOT EXISTS "public"."project" (
    "project_id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "thumbnail_url" character varying(500),
    "github_url" character varying(500),
    "live_demo_url" character varying(500),
    "start_month" smallint,
    "start_year" smallint,
    "end_month" smallint,
    "end_year" smallint,
    "is_current" boolean DEFAULT false NOT NULL,
    "associated_with" character varying(200),
    "is_published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "advisor_name" character varying(120),
    "advisor_user_id" integer,
    CONSTRAINT "project_check" CHECK ((("is_current" = true) OR ("end_year" IS NOT NULL))),
    CONSTRAINT "project_description_check" CHECK (("char_length"("description") <= 2000)),
    CONSTRAINT "project_end_month_check" CHECK ((("end_month" >= 1) AND ("end_month" <= 12))),
    CONSTRAINT "project_end_year_check" CHECK ((("end_year" >= 2000) AND ("end_year" <= 2100))),
    CONSTRAINT "project_start_month_check" CHECK ((("start_month" >= 1) AND ("start_month" <= 12))),
    CONSTRAINT "project_start_year_check" CHECK ((("start_year" >= 2000) AND ("start_year" <= 2100)))
);


ALTER TABLE "public"."project" OWNER TO "postgres";


COMMENT ON COLUMN "public"."project"."advisor_name" IS 'External advisor name (not in system). Use this OR advisor_user_id, not both.';



COMMENT ON COLUMN "public"."project"."advisor_user_id" IS 'Internal advisor — references instructor table.';



CREATE TABLE IF NOT EXISTS "public"."project_contributor" (
    "contrib_id" integer NOT NULL,
    "project_id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(100),
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_contributor" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."project_contributor_contrib_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."project_contributor_contrib_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."project_contributor_contrib_id_seq" OWNED BY "public"."project_contributor"."contrib_id";



CREATE TABLE IF NOT EXISTS "public"."project_media" (
    "media_id" integer NOT NULL,
    "project_id" integer NOT NULL,
    "file_url" character varying(500) NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "file_type" character varying(50) NOT NULL,
    "file_size_bytes" bigint NOT NULL,
    "mime_type" character varying(100),
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_media_file_size_bytes_check" CHECK ((("file_size_bytes" > 0) AND ("file_size_bytes" <= 52428800))),
    CONSTRAINT "project_media_file_type_check" CHECK ((("file_type")::"text" = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'audio'::character varying, 'document'::character varying, 'presentation'::character varying, 'site'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."project_media" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."project_media_media_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."project_media_media_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."project_media_media_id_seq" OWNED BY "public"."project_media"."media_id";



CREATE SEQUENCE IF NOT EXISTS "public"."project_project_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."project_project_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."project_project_id_seq" OWNED BY "public"."project"."project_id";



CREATE TABLE IF NOT EXISTS "public"."project_skill" (
    "project_id" integer NOT NULL,
    "skill_id" integer NOT NULL
);


ALTER TABLE "public"."project_skill" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."research_paper" (
    "paper_id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(500) NOT NULL,
    "abstract" "text",
    "journal_name" character varying(300),
    "conference_name" character varying(300),
    "doi" character varying(255),
    "paper_url" character varying(500),
    "scholar_url" character varying(500),
    "publish_month" smallint,
    "publish_year" smallint,
    "citation_count" integer DEFAULT 0 NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "research_paper_citation_count_check" CHECK (("citation_count" >= 0)),
    CONSTRAINT "research_paper_publish_month_check" CHECK ((("publish_month" >= 1) AND ("publish_month" <= 12))),
    CONSTRAINT "research_paper_publish_year_check" CHECK ((("publish_year" >= 2000) AND ("publish_year" <= 2100)))
);


ALTER TABLE "public"."research_paper" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."research_paper_author" (
    "author_id" integer NOT NULL,
    "paper_id" integer NOT NULL,
    "user_id" "uuid",
    "author_name" character varying(120) NOT NULL,
    "author_order" smallint DEFAULT 1 NOT NULL,
    "is_corresponding" boolean DEFAULT false NOT NULL,
    CONSTRAINT "research_paper_author_author_order_check" CHECK (("author_order" > 0))
);


ALTER TABLE "public"."research_paper_author" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."research_paper_author_author_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."research_paper_author_author_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."research_paper_author_author_id_seq" OWNED BY "public"."research_paper_author"."author_id";



CREATE TABLE IF NOT EXISTS "public"."research_paper_keyword" (
    "paper_id" integer NOT NULL,
    "skill_id" integer NOT NULL
);


ALTER TABLE "public"."research_paper_keyword" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."research_paper_media" (
    "media_id" integer NOT NULL,
    "paper_id" integer NOT NULL,
    "file_url" character varying(500) NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "file_type" character varying(50) NOT NULL,
    "file_size_bytes" bigint NOT NULL,
    "mime_type" character varying(100),
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "research_paper_media_file_size_bytes_check" CHECK ((("file_size_bytes" > 0) AND ("file_size_bytes" <= 52428800))),
    CONSTRAINT "research_paper_media_file_type_check" CHECK ((("file_type")::"text" = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'audio'::character varying, 'document'::character varying, 'presentation'::character varying, 'site'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."research_paper_media" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."research_paper_media_media_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."research_paper_media_media_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."research_paper_media_media_id_seq" OWNED BY "public"."research_paper_media"."media_id";



CREATE SEQUENCE IF NOT EXISTS "public"."research_paper_paper_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."research_paper_paper_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."research_paper_paper_id_seq" OWNED BY "public"."research_paper"."paper_id";



CREATE TABLE IF NOT EXISTS "public"."skill" (
    "skill_id" integer NOT NULL,
    "skill_name" character varying(100) NOT NULL,
    "category" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."skill" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."skill_skill_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."skill_skill_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."skill_skill_id_seq" OWNED BY "public"."skill"."skill_id";



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


ALTER TABLE ONLY "public"."achievement_comment" ALTER COLUMN "comment_id" SET DEFAULT "nextval"('"public"."achievement_comment_comment_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."achievement_rating" ALTER COLUMN "rating_id" SET DEFAULT "nextval"('"public"."achievement_rating_rating_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."achievement_reaction" ALTER COLUMN "reaction_id" SET DEFAULT "nextval"('"public"."achievement_reaction_reaction_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."attendance_record" ALTER COLUMN "record_id" SET DEFAULT "nextval"('"public"."attendance_record_record_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."attendance_session" ALTER COLUMN "session_id" SET DEFAULT "nextval"('"public"."attendance_session_session_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."certificate" ALTER COLUMN "certificate_id" SET DEFAULT "nextval"('"public"."certificate_certificate_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."certificate_media" ALTER COLUMN "media_id" SET DEFAULT "nextval"('"public"."certificate_media_media_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cgpa_record" ALTER COLUMN "record_id" SET DEFAULT "nextval"('"public"."cgpa_record_record_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."course_invite" ALTER COLUMN "invite_id" SET DEFAULT "nextval"('"public"."course_invite_invite_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."course_resource" ALTER COLUMN "resource_id" SET DEFAULT "nextval"('"public"."course_resource_resource_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."department" ALTER COLUMN "dept_id" SET DEFAULT "nextval"('"public"."department_dept_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exam" ALTER COLUMN "exam_id" SET DEFAULT "nextval"('"public"."exam_exam_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exam_mark" ALTER COLUMN "mark_id" SET DEFAULT "nextval"('"public"."exam_mark_mark_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."instructor" ALTER COLUMN "instructor_id" SET DEFAULT "nextval"('"public"."instructor_instructor_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."manual_course" ALTER COLUMN "manual_course_id" SET DEFAULT "nextval"('"public"."manual_course_manual_course_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."manual_enrollment" ALTER COLUMN "enrollment_id" SET DEFAULT "nextval"('"public"."manual_enrollment_enrollment_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notification" ALTER COLUMN "notification_id" SET DEFAULT "nextval"('"public"."notification_notification_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."program" ALTER COLUMN "program_id" SET DEFAULT "nextval"('"public"."program_program_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."project" ALTER COLUMN "project_id" SET DEFAULT "nextval"('"public"."project_project_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."project_contributor" ALTER COLUMN "contrib_id" SET DEFAULT "nextval"('"public"."project_contributor_contrib_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."project_media" ALTER COLUMN "media_id" SET DEFAULT "nextval"('"public"."project_media_media_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."research_paper" ALTER COLUMN "paper_id" SET DEFAULT "nextval"('"public"."research_paper_paper_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."research_paper_author" ALTER COLUMN "author_id" SET DEFAULT "nextval"('"public"."research_paper_author_author_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."research_paper_media" ALTER COLUMN "media_id" SET DEFAULT "nextval"('"public"."research_paper_media_media_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."skill" ALTER COLUMN "skill_id" SET DEFAULT "nextval"('"public"."skill_skill_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."student" ALTER COLUMN "student_id" SET DEFAULT "nextval"('"public"."student_student_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."achievement_comment"
    ADD CONSTRAINT "achievement_comment_pkey" PRIMARY KEY ("comment_id");



ALTER TABLE ONLY "public"."achievement_rating"
    ADD CONSTRAINT "achievement_rating_pkey" PRIMARY KEY ("rating_id");



ALTER TABLE ONLY "public"."achievement_rating"
    ADD CONSTRAINT "achievement_rating_user_id_achievement_type_target_id_key" UNIQUE ("user_id", "achievement_type", "target_id");



ALTER TABLE ONLY "public"."achievement_reaction"
    ADD CONSTRAINT "achievement_reaction_pkey" PRIMARY KEY ("reaction_id");



ALTER TABLE ONLY "public"."achievement_reaction"
    ADD CONSTRAINT "achievement_reaction_user_id_achievement_type_target_id_emo_key" UNIQUE ("user_id", "achievement_type", "target_id", "emoji");



ALTER TABLE ONLY "public"."advisor"
    ADD CONSTRAINT "advisor_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advisor"
    ADD CONSTRAINT "advisor_student_unique" UNIQUE ("student_id");



ALTER TABLE ONLY "public"."attendance_record"
    ADD CONSTRAINT "attendance_record_pkey" PRIMARY KEY ("record_id");



ALTER TABLE ONLY "public"."attendance_record"
    ADD CONSTRAINT "attendance_record_session_id_student_id_key" UNIQUE ("session_id", "student_id");



ALTER TABLE ONLY "public"."attendance_session"
    ADD CONSTRAINT "attendance_session_pkey" PRIMARY KEY ("session_id");



ALTER TABLE ONLY "public"."certificate_media"
    ADD CONSTRAINT "certificate_media_pkey" PRIMARY KEY ("media_id");



ALTER TABLE ONLY "public"."certificate"
    ADD CONSTRAINT "certificate_pkey" PRIMARY KEY ("certificate_id");



ALTER TABLE ONLY "public"."certificate_skill"
    ADD CONSTRAINT "certificate_skill_pkey" PRIMARY KEY ("certificate_id", "skill_id");



ALTER TABLE ONLY "public"."cgpa_record"
    ADD CONSTRAINT "cgpa_record_pkey" PRIMARY KEY ("record_id");



ALTER TABLE ONLY "public"."chat_message_attachment"
    ADD CONSTRAINT "chat_message_attachment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_message"
    ADD CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_message_reaction"
    ADD CONSTRAINT "chat_message_reaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_message_reaction"
    ADD CONSTRAINT "chat_message_reaction_unique" UNIQUE ("message_id", "user_id", "reaction");



ALTER TABLE ONLY "public"."chat_request"
    ADD CONSTRAINT "chat_request_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_room_member"
    ADD CONSTRAINT "chat_room_member_pkey" PRIMARY KEY ("room_id", "profile_id");



ALTER TABLE ONLY "public"."chat_room"
    ADD CONSTRAINT "chat_room_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_room"
    ADD CONSTRAINT "chat_room_room_code_key" UNIQUE ("room_code");



ALTER TABLE ONLY "public"."course_invite"
    ADD CONSTRAINT "course_invite_manual_course_id_student_id_key" UNIQUE ("manual_course_id", "student_id");



ALTER TABLE ONLY "public"."course_invite"
    ADD CONSTRAINT "course_invite_pkey" PRIMARY KEY ("invite_id");



ALTER TABLE ONLY "public"."course_resource"
    ADD CONSTRAINT "course_resource_pkey" PRIMARY KEY ("resource_id");



ALTER TABLE ONLY "public"."department"
    ADD CONSTRAINT "department_dept_code_key" UNIQUE ("dept_code");



ALTER TABLE ONLY "public"."department"
    ADD CONSTRAINT "department_dept_name_key" UNIQUE ("dept_name");



ALTER TABLE ONLY "public"."department"
    ADD CONSTRAINT "department_pkey" PRIMARY KEY ("dept_id");



ALTER TABLE ONLY "public"."exam_mark"
    ADD CONSTRAINT "exam_mark_exam_id_student_id_key" UNIQUE ("exam_id", "student_id");



ALTER TABLE ONLY "public"."exam_mark"
    ADD CONSTRAINT "exam_mark_pkey" PRIMARY KEY ("mark_id");



ALTER TABLE ONLY "public"."exam"
    ADD CONSTRAINT "exam_pkey" PRIMARY KEY ("exam_id");



ALTER TABLE ONLY "public"."instructor"
    ADD CONSTRAINT "instructor_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."instructor"
    ADD CONSTRAINT "instructor_pkey" PRIMARY KEY ("instructor_id");



ALTER TABLE ONLY "public"."instructor"
    ADD CONSTRAINT "instructor_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."manual_course"
    ADD CONSTRAINT "manual_course_enroll_code_key" UNIQUE ("enroll_code");



ALTER TABLE ONLY "public"."manual_course"
    ADD CONSTRAINT "manual_course_pkey" PRIMARY KEY ("manual_course_id");



ALTER TABLE ONLY "public"."manual_enrollment"
    ADD CONSTRAINT "manual_enrollment_manual_course_id_student_id_key" UNIQUE ("manual_course_id", "student_id");



ALTER TABLE ONLY "public"."manual_enrollment"
    ADD CONSTRAINT "manual_enrollment_pkey" PRIMARY KEY ("enrollment_id");



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



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_pkey" PRIMARY KEY ("notification_id");



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



ALTER TABLE ONLY "public"."project_contributor"
    ADD CONSTRAINT "project_contributor_pkey" PRIMARY KEY ("contrib_id");



ALTER TABLE ONLY "public"."project_contributor"
    ADD CONSTRAINT "project_contributor_project_id_user_id_key" UNIQUE ("project_id", "user_id");



ALTER TABLE ONLY "public"."project_media"
    ADD CONSTRAINT "project_media_pkey" PRIMARY KEY ("media_id");



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "project_pkey" PRIMARY KEY ("project_id");



ALTER TABLE ONLY "public"."project_skill"
    ADD CONSTRAINT "project_skill_pkey" PRIMARY KEY ("project_id", "skill_id");



ALTER TABLE ONLY "public"."research_paper_author"
    ADD CONSTRAINT "research_paper_author_paper_id_author_order_key" UNIQUE ("paper_id", "author_order");



ALTER TABLE ONLY "public"."research_paper_author"
    ADD CONSTRAINT "research_paper_author_pkey" PRIMARY KEY ("author_id");



ALTER TABLE ONLY "public"."research_paper"
    ADD CONSTRAINT "research_paper_doi_key" UNIQUE ("doi");



ALTER TABLE ONLY "public"."research_paper_keyword"
    ADD CONSTRAINT "research_paper_keyword_pkey" PRIMARY KEY ("paper_id", "skill_id");



ALTER TABLE ONLY "public"."research_paper_media"
    ADD CONSTRAINT "research_paper_media_pkey" PRIMARY KEY ("media_id");



ALTER TABLE ONLY "public"."research_paper"
    ADD CONSTRAINT "research_paper_pkey" PRIMARY KEY ("paper_id");



ALTER TABLE ONLY "public"."skill"
    ADD CONSTRAINT "skill_pkey" PRIMARY KEY ("skill_id");



ALTER TABLE ONLY "public"."skill"
    ADD CONSTRAINT "skill_skill_name_key" UNIQUE ("skill_name");



ALTER TABLE ONLY "public"."student"
    ADD CONSTRAINT "student_pkey" PRIMARY KEY ("student_id");



ALTER TABLE ONLY "public"."student"
    ADD CONSTRAINT "student_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."student"
    ADD CONSTRAINT "student_student_roll_key" UNIQUE ("student_roll");



CREATE INDEX "chat_message_room_created_idx" ON "public"."chat_message" USING "btree" ("room_id", "created_at" DESC);



CREATE UNIQUE INDEX "chat_request_direct_unique" ON "public"."chat_request" USING "btree" ("from_id", "to_id") WHERE ("room_id" IS NULL);



CREATE UNIQUE INDEX "chat_request_group_unique" ON "public"."chat_request" USING "btree" ("from_id", "to_id", "room_id") WHERE ("room_id" IS NOT NULL);



CREATE INDEX "idx_achievement_comment_target" ON "public"."achievement_comment" USING "btree" ("achievement_type", "target_id");



CREATE INDEX "idx_achievement_rating_target" ON "public"."achievement_rating" USING "btree" ("achievement_type", "target_id");



CREATE INDEX "idx_achievement_reaction_target" ON "public"."achievement_reaction" USING "btree" ("achievement_type", "target_id");



CREATE INDEX "idx_attendance_record_session" ON "public"."attendance_record" USING "btree" ("session_id");



CREATE INDEX "idx_attendance_record_student" ON "public"."attendance_record" USING "btree" ("student_id");



CREATE INDEX "idx_attendance_session_course" ON "public"."attendance_session" USING "btree" ("manual_course_id");



CREATE INDEX "idx_attendance_session_date" ON "public"."attendance_session" USING "btree" ("session_date");



CREATE INDEX "idx_certificate_published" ON "public"."certificate" USING "btree" ("is_published", "created_at" DESC);



CREATE INDEX "idx_certificate_user" ON "public"."certificate" USING "btree" ("user_id");



CREATE INDEX "idx_cgpa_record_student" ON "public"."cgpa_record" USING "btree" ("student_id");



CREATE INDEX "idx_exam_course" ON "public"."exam" USING "btree" ("manual_course_id");



CREATE INDEX "idx_exam_created_by" ON "public"."exam" USING "btree" ("created_by");



CREATE INDEX "idx_exam_mark_exam" ON "public"."exam_mark" USING "btree" ("exam_id");



CREATE INDEX "idx_exam_mark_student" ON "public"."exam_mark" USING "btree" ("student_id");



CREATE INDEX "idx_instructor_dept" ON "public"."instructor" USING "btree" ("dept_id");



CREATE INDEX "idx_invite_course" ON "public"."course_invite" USING "btree" ("manual_course_id");



CREATE INDEX "idx_invite_student" ON "public"."course_invite" USING "btree" ("student_id");



CREATE INDEX "idx_invite_student_pending" ON "public"."course_invite" USING "btree" ("student_id", "status") WHERE (("status")::"text" = 'pending'::"text");



CREATE INDEX "idx_manual_course_enroll_code" ON "public"."manual_course" USING "btree" ("enroll_code");



CREATE INDEX "idx_manual_course_instructor" ON "public"."manual_course" USING "btree" ("instructor_id");



CREATE UNIQUE INDEX "idx_manual_course_join_token" ON "public"."manual_course" USING "btree" ("join_link_token");



CREATE INDEX "idx_manual_enrollment_course" ON "public"."manual_enrollment" USING "btree" ("manual_course_id");



CREATE INDEX "idx_manual_enrollment_student" ON "public"."manual_enrollment" USING "btree" ("student_id");



CREATE INDEX "idx_nba_post" ON "public"."notice_board_attachment" USING "btree" ("post_id");



CREATE INDEX "idx_nbp_author" ON "public"."notice_board_post" USING "btree" ("author_id");



CREATE INDEX "idx_nbp_category" ON "public"."notice_board_post" USING "btree" ("category");



CREATE INDEX "idx_nbp_created" ON "public"."notice_board_post" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_nbpv_poll" ON "public"."notice_board_poll_vote" USING "btree" ("poll_id");



CREATE INDEX "idx_nbr_post" ON "public"."notice_board_reaction" USING "btree" ("post_id");



CREATE INDEX "idx_nbr_user" ON "public"."notice_board_reaction" USING "btree" ("user_id");



CREATE INDEX "idx_notification_recipient" ON "public"."notification" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "idx_notification_unread" ON "public"."notification" USING "btree" ("recipient_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_profiles_active" ON "public"."profiles" USING "btree" ("is_active");



CREATE INDEX "idx_profiles_instructor" ON "public"."profiles" USING "btree" ("instructor_id");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_student" ON "public"."profiles" USING "btree" ("student_id");



CREATE INDEX "idx_project_published" ON "public"."project" USING "btree" ("is_published", "created_at" DESC);



CREATE INDEX "idx_project_user" ON "public"."project" USING "btree" ("user_id");



CREATE INDEX "idx_research_paper_published" ON "public"."research_paper" USING "btree" ("is_published", "created_at" DESC);



CREATE INDEX "idx_research_paper_user" ON "public"."research_paper" USING "btree" ("user_id");



CREATE INDEX "idx_resource_course" ON "public"."course_resource" USING "btree" ("manual_course_id");



CREATE INDEX "idx_resource_published" ON "public"."course_resource" USING "btree" ("manual_course_id", "is_published");



CREATE INDEX "idx_resource_type" ON "public"."course_resource" USING "btree" ("resource_type");



CREATE INDEX "idx_student_batch" ON "public"."student" USING "btree" ("batch_year");



CREATE INDEX "idx_student_program" ON "public"."student" USING "btree" ("program_id");



CREATE INDEX "idx_student_roll" ON "public"."student" USING "btree" ("student_roll");



CREATE OR REPLACE TRIGGER "trg_achievement_comment_updated_at" BEFORE UPDATE ON "public"."achievement_comment" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_certificate_updated_at" BEFORE UPDATE ON "public"."certificate" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_exam_mark_updated_at" BEFORE UPDATE ON "public"."exam_mark" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_exam_updated_at" BEFORE UPDATE ON "public"."exam" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_instructor_phone" BEFORE INSERT OR UPDATE OF "phone" ON "public"."instructor" FOR EACH ROW EXECUTE FUNCTION "public"."normalise_phone_field"();



CREATE OR REPLACE TRIGGER "trg_instructor_profile_guard" BEFORE UPDATE ON "public"."instructor" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_instructor_profile_restrictions"();



CREATE OR REPLACE TRIGGER "trg_instructor_sync_profile" AFTER UPDATE OF "first_name", "last_name", "profile_photo" ON "public"."instructor" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_from_instructor"();



CREATE OR REPLACE TRIGGER "trg_instructor_updated" BEFORE UPDATE ON "public"."instructor" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_manual_course_updated_at" BEFORE UPDATE ON "public"."manual_course" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_nbp_updated_at" BEFORE UPDATE ON "public"."notice_board_post" FOR EACH ROW EXECUTE FUNCTION "public"."update_notice_board_post_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_phone" BEFORE INSERT OR UPDATE OF "phone" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."normalise_phone_field"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_project_updated_at" BEFORE UPDATE ON "public"."project" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_research_paper_updated_at" BEFORE UPDATE ON "public"."research_paper" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_resource_updated_at" BEFORE UPDATE ON "public"."course_resource" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_single_choice_vote" AFTER INSERT ON "public"."notice_board_poll_vote" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_single_choice_vote"();



CREATE OR REPLACE TRIGGER "trg_student_emerg_phone" BEFORE INSERT OR UPDATE OF "emergency_contact_phone" ON "public"."student" FOR EACH ROW EXECUTE FUNCTION "public"."normalise_emergency_phone"();



CREATE OR REPLACE TRIGGER "trg_student_phone" BEFORE INSERT OR UPDATE OF "phone" ON "public"."student" FOR EACH ROW EXECUTE FUNCTION "public"."normalise_phone_field"();



CREATE OR REPLACE TRIGGER "trg_student_profile_guard" BEFORE UPDATE ON "public"."student" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_student_profile_restrictions"();



CREATE OR REPLACE TRIGGER "trg_student_sync_profile" AFTER UPDATE OF "first_name", "last_name", "profile_photo" ON "public"."student" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_from_student"();



CREATE OR REPLACE TRIGGER "trg_student_updated" BEFORE UPDATE ON "public"."student" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."achievement_comment"
    ADD CONSTRAINT "achievement_comment_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."achievement_comment"("comment_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."achievement_comment"
    ADD CONSTRAINT "achievement_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."achievement_rating"
    ADD CONSTRAINT "achievement_rating_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."achievement_reaction"
    ADD CONSTRAINT "achievement_reaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advisor"
    ADD CONSTRAINT "advisor_advisor_instructor_id_fkey" FOREIGN KEY ("advisor_instructor_id") REFERENCES "public"."instructor"("instructor_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advisor"
    ADD CONSTRAINT "advisor_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."student"("student_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_record"
    ADD CONSTRAINT "attendance_record_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_session"("session_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_record"
    ADD CONSTRAINT "attendance_record_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."student"("student_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_session"
    ADD CONSTRAINT "attendance_session_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor"("instructor_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance_session"
    ADD CONSTRAINT "attendance_session_manual_course_id_fkey" FOREIGN KEY ("manual_course_id") REFERENCES "public"."manual_course"("manual_course_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certificate_media"
    ADD CONSTRAINT "certificate_media_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificate"("certificate_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certificate_skill"
    ADD CONSTRAINT "certificate_skill_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificate"("certificate_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certificate_skill"
    ADD CONSTRAINT "certificate_skill_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("skill_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certificate"
    ADD CONSTRAINT "certificate_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cgpa_record"
    ADD CONSTRAINT "cgpa_record_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."student"("student_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_attachment"
    ADD CONSTRAINT "chat_message_attachment_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_reaction"
    ADD CONSTRAINT "chat_message_reaction_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_message"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_reaction"
    ADD CONSTRAINT "chat_message_reaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."chat_message"
    ADD CONSTRAINT "chat_message_reply_to_fkey" FOREIGN KEY ("reply_to") REFERENCES "public"."chat_message"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_message"
    ADD CONSTRAINT "chat_message_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_room"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message"
    ADD CONSTRAINT "chat_message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."chat_request"
    ADD CONSTRAINT "chat_request_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_request"
    ADD CONSTRAINT "chat_request_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_room"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_request"
    ADD CONSTRAINT "chat_request_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_room"
    ADD CONSTRAINT "chat_room_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."chat_room_member"
    ADD CONSTRAINT "chat_room_member_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_room_member"
    ADD CONSTRAINT "chat_room_member_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_room"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_invite"
    ADD CONSTRAINT "course_invite_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."instructor"("instructor_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."course_invite"
    ADD CONSTRAINT "course_invite_manual_course_id_fkey" FOREIGN KEY ("manual_course_id") REFERENCES "public"."manual_course"("manual_course_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_invite"
    ADD CONSTRAINT "course_invite_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."student"("student_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_resource"
    ADD CONSTRAINT "course_resource_manual_course_id_fkey" FOREIGN KEY ("manual_course_id") REFERENCES "public"."manual_course"("manual_course_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_resource"
    ADD CONSTRAINT "course_resource_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."instructor"("instructor_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."exam"
    ADD CONSTRAINT "exam_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."exam"
    ADD CONSTRAINT "exam_manual_course_id_fkey" FOREIGN KEY ("manual_course_id") REFERENCES "public"."manual_course"("manual_course_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_mark"
    ADD CONSTRAINT "exam_mark_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."exam_mark"
    ADD CONSTRAINT "exam_mark_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exam"("exam_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_mark"
    ADD CONSTRAINT "exam_mark_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."student"("student_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "fk_profiles_instructor" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor"("instructor_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "fk_profiles_student" FOREIGN KEY ("student_id") REFERENCES "public"."student"("student_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."instructor"
    ADD CONSTRAINT "instructor_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "public"."department"("dept_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."instructor"
    ADD CONSTRAINT "instructor_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manual_course"
    ADD CONSTRAINT "manual_course_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "public"."department"("dept_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."manual_course"
    ADD CONSTRAINT "manual_course_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructor"("instructor_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."manual_enrollment"
    ADD CONSTRAINT "manual_enrollment_manual_course_id_fkey" FOREIGN KEY ("manual_course_id") REFERENCES "public"."manual_course"("manual_course_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."manual_enrollment"
    ADD CONSTRAINT "manual_enrollment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."student"("student_id") ON UPDATE CASCADE ON DELETE RESTRICT;



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



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program"
    ADD CONSTRAINT "program_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "public"."department"("dept_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "project_advisor_user_id_fkey" FOREIGN KEY ("advisor_user_id") REFERENCES "public"."instructor"("instructor_id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_contributor"
    ADD CONSTRAINT "project_contributor_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("project_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_contributor"
    ADD CONSTRAINT "project_contributor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_media"
    ADD CONSTRAINT "project_media_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("project_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_skill"
    ADD CONSTRAINT "project_skill_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("project_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_skill"
    ADD CONSTRAINT "project_skill_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("skill_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "project_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."research_paper_author"
    ADD CONSTRAINT "research_paper_author_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."research_paper"("paper_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."research_paper_author"
    ADD CONSTRAINT "research_paper_author_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."research_paper_keyword"
    ADD CONSTRAINT "research_paper_keyword_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."research_paper"("paper_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."research_paper_keyword"
    ADD CONSTRAINT "research_paper_keyword_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("skill_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."research_paper_media"
    ADD CONSTRAINT "research_paper_media_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."research_paper"("paper_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."research_paper"
    ADD CONSTRAINT "research_paper_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student"
    ADD CONSTRAINT "student_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student"
    ADD CONSTRAINT "student_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."program"("program_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE "public"."achievement_comment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."achievement_rating" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."achievement_reaction" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."advisor" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "advisor_select_own" ON "public"."advisor" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."student" "s"
  WHERE (("s"."student_id" = "advisor"."student_id") AND ("s"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."instructor" "i"
  WHERE (("i"."instructor_id" = "advisor"."advisor_instructor_id") AND ("i"."profile_id" = "auth"."uid"())))) OR ("public"."current_user_role"() = 'admin'::"text")));



CREATE POLICY "ar_select" ON "public"."attendance_record" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "as_select" ON "public"."attendance_session" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "attachments_delete" ON "public"."notice_board_attachment" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."notice_board_post" "p"
  WHERE (("p"."id" = "notice_board_attachment"."post_id") AND ("p"."author_id" = "auth"."uid"())))));



CREATE POLICY "attachments_insert" ON "public"."notice_board_attachment" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."notice_board_post" "p"
  WHERE (("p"."id" = "notice_board_attachment"."post_id") AND ("p"."author_id" = "auth"."uid"())))));



CREATE POLICY "attachments_select" ON "public"."notice_board_attachment" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."notice_board_post" "p"
  WHERE (("p"."id" = "notice_board_attachment"."post_id") AND (("p"."audience" = ANY (ARRAY['all'::"public"."notice_audience_type", 'students'::"public"."notice_audience_type"])) OR (("p"."audience" = 'teachers'::"public"."notice_audience_type") AND ("public"."current_user_role"() = 'teacher'::"text")))))));



ALTER TABLE "public"."attendance_record" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_session" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."certificate" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "certificate_delete" ON "public"."certificate" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "certificate_insert" ON "public"."certificate" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."certificate_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "certificate_media_delete" ON "public"."certificate_media" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."certificate" "c"
  WHERE (("c"."certificate_id" = "certificate_media"."certificate_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "certificate_media_insert" ON "public"."certificate_media" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."certificate" "c"
  WHERE (("c"."certificate_id" = "certificate_media"."certificate_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "certificate_media_select" ON "public"."certificate_media" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "certificate_select" ON "public"."certificate" FOR SELECT TO "authenticated" USING ((("is_published" = true) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."certificate_skill" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "certificate_skill_delete" ON "public"."certificate_skill" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."certificate" "c"
  WHERE (("c"."certificate_id" = "certificate_skill"."certificate_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "certificate_skill_insert" ON "public"."certificate_skill" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."certificate" "c"
  WHERE (("c"."certificate_id" = "certificate_skill"."certificate_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "certificate_skill_select" ON "public"."certificate_skill" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "certificate_update" ON "public"."certificate" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."cgpa_record" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cgpa_select" ON "public"."cgpa_record" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."student" "s"
  WHERE (("s"."student_id" = "cgpa_record"."student_id") AND ("s"."profile_id" = "auth"."uid"())))));



ALTER TABLE "public"."chat_message" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_message_attachment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_message_attachment_delete" ON "public"."chat_message_attachment" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."chat_message" "m"
  WHERE (("m"."id" = "chat_message_attachment"."message_id") AND ("m"."sender_id" = "auth"."uid"())))));



CREATE POLICY "chat_message_attachment_insert" ON "public"."chat_message_attachment" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chat_message" "m"
  WHERE (("m"."id" = "chat_message_attachment"."message_id") AND "public"."is_room_member"("m"."room_id") AND ("m"."sender_id" = "auth"."uid"())))));



CREATE POLICY "chat_message_attachment_select" ON "public"."chat_message_attachment" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_message" "m"
  WHERE (("m"."id" = "chat_message_attachment"."message_id") AND "public"."is_room_member"("m"."room_id")))));



CREATE POLICY "chat_message_delete_own" ON "public"."chat_message" FOR DELETE USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "chat_message_insert_member" ON "public"."chat_message" FOR INSERT WITH CHECK (("public"."is_room_member"("room_id") AND ("sender_id" = "auth"."uid"())));



ALTER TABLE "public"."chat_message_reaction" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_message_reaction_delete_own" ON "public"."chat_message_reaction" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "chat_message_reaction_insert" ON "public"."chat_message_reaction" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."chat_message" "m"
  WHERE (("m"."id" = "chat_message_reaction"."message_id") AND "public"."is_room_member"("m"."room_id"))))));



CREATE POLICY "chat_message_reaction_select" ON "public"."chat_message_reaction" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_message" "m"
  WHERE (("m"."id" = "chat_message_reaction"."message_id") AND "public"."is_room_member"("m"."room_id")))));



CREATE POLICY "chat_message_select_member" ON "public"."chat_message" FOR SELECT USING ("public"."is_room_member"("room_id"));



CREATE POLICY "chat_message_update_own" ON "public"."chat_message" FOR UPDATE USING (("sender_id" = "auth"."uid"()));



ALTER TABLE "public"."chat_request" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_request_delete" ON "public"."chat_request" FOR DELETE USING ((("from_id" = "auth"."uid"()) OR ("to_id" = "auth"."uid"())));



CREATE POLICY "chat_request_insert" ON "public"."chat_request" FOR INSERT WITH CHECK (("from_id" = "auth"."uid"()));



CREATE POLICY "chat_request_select" ON "public"."chat_request" FOR SELECT USING ((("from_id" = "auth"."uid"()) OR ("to_id" = "auth"."uid"())));



CREATE POLICY "chat_request_update" ON "public"."chat_request" FOR UPDATE USING (("to_id" = "auth"."uid"()));



ALTER TABLE "public"."chat_room" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_room_insert_auth" ON "public"."chat_room" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



ALTER TABLE "public"."chat_room_member" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_room_member_delete_owner" ON "public"."chat_room_member" FOR DELETE USING ((("profile_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."chat_room_member" "m"
  WHERE (("m"."room_id" = "chat_room_member"."room_id") AND ("m"."profile_id" = "auth"."uid"()) AND ("m"."member_role" = 'owner'::"text"))))));



CREATE POLICY "chat_room_member_insert_self" ON "public"."chat_room_member" FOR INSERT WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "chat_room_member_select" ON "public"."chat_room_member" FOR SELECT USING ("public"."is_room_member"("room_id"));



CREATE POLICY "chat_room_select_member" ON "public"."chat_room" FOR SELECT USING ("public"."is_room_member"("id"));



CREATE POLICY "ci_insert" ON "public"."course_invite" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."instructor" "i"
  WHERE (("i"."instructor_id" = "course_invite"."invited_by") AND ("i"."profile_id" = "auth"."uid"())))));



CREATE POLICY "ci_select" ON "public"."course_invite" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."student" "s"
  WHERE (("s"."student_id" = "course_invite"."student_id") AND ("s"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."instructor" "i"
  WHERE (("i"."instructor_id" = "course_invite"."invited_by") AND ("i"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "ci_update" ON "public"."course_invite" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."student" "s"
  WHERE (("s"."student_id" = "course_invite"."student_id") AND ("s"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."instructor" "i"
  WHERE (("i"."instructor_id" = "course_invite"."invited_by") AND ("i"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "comment_delete" ON "public"."achievement_comment" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "comment_insert" ON "public"."achievement_comment" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "comment_select" ON "public"."achievement_comment" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "comment_update" ON "public"."achievement_comment" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."course_invite" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_resource" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cr_delete" ON "public"."course_resource" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."instructor" "i"
  WHERE (("i"."instructor_id" = "course_resource"."uploaded_by") AND ("i"."profile_id" = "auth"."uid"())))));



CREATE POLICY "cr_insert" ON "public"."course_resource" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."instructor" "i"
  WHERE (("i"."instructor_id" = "course_resource"."uploaded_by") AND ("i"."profile_id" = "auth"."uid"())))));



CREATE POLICY "cr_select" ON "public"."course_resource" FOR SELECT TO "authenticated" USING ((("is_published" = true) AND ((EXISTS ( SELECT 1
   FROM "public"."instructor" "i"
  WHERE (("i"."instructor_id" = "course_resource"."uploaded_by") AND ("i"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."manual_enrollment" "me"
     JOIN "public"."student" "s" ON (("s"."student_id" = "me"."student_id")))
  WHERE (("me"."manual_course_id" = "course_resource"."manual_course_id") AND ("s"."profile_id" = "auth"."uid"()) AND ("me"."is_active" = true)))))));



CREATE POLICY "cr_update" ON "public"."course_resource" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."instructor" "i"
  WHERE (("i"."instructor_id" = "course_resource"."uploaded_by") AND ("i"."profile_id" = "auth"."uid"())))));



ALTER TABLE "public"."department" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "department_auth_select" ON "public"."department" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "em_insert" ON "public"."exam_mark" FOR INSERT TO "authenticated" WITH CHECK (("entered_by" = "auth"."uid"()));



CREATE POLICY "em_select" ON "public"."exam_mark" FOR SELECT TO "authenticated" USING ((("entered_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."student" "s"
  WHERE (("s"."student_id" = "exam_mark"."student_id") AND ("s"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "em_update" ON "public"."exam_mark" FOR UPDATE TO "authenticated" USING (("entered_by" = "auth"."uid"()));



ALTER TABLE "public"."exam" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exam_insert" ON "public"."exam" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."exam_mark" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exam_select" ON "public"."exam" FOR SELECT TO "authenticated" USING ((("is_published" = true) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "exam_update" ON "public"."exam" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."instructor" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "instructor_all_auth_select" ON "public"."instructor" FOR SELECT TO "authenticated" USING ((("public"."current_profile"())."role" = ANY (ARRAY['student'::"public"."app_role", 'teacher'::"public"."app_role", 'admin'::"public"."app_role"])));



CREATE POLICY "instructor_own_select" ON "public"."instructor" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "instructor_own_update" ON "public"."instructor" FOR UPDATE TO "authenticated" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."manual_course" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manual_enrollment" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mc_insert" ON "public"."manual_course" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."instructor" "i"
  WHERE (("i"."instructor_id" = "manual_course"."instructor_id") AND ("i"."profile_id" = "auth"."uid"())))));



CREATE POLICY "mc_select" ON "public"."manual_course" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "mc_update" ON "public"."manual_course" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."instructor" "i"
  WHERE (("i"."instructor_id" = "manual_course"."instructor_id") AND ("i"."profile_id" = "auth"."uid"())))));



CREATE POLICY "me_delete" ON "public"."manual_enrollment" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."manual_course" "mc"
     JOIN "public"."instructor" "i" ON (("i"."instructor_id" = "mc"."instructor_id")))
  WHERE (("mc"."manual_course_id" = "manual_enrollment"."manual_course_id") AND ("i"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."student" "s"
  WHERE (("s"."student_id" = "manual_enrollment"."student_id") AND ("s"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "me_insert" ON "public"."manual_enrollment" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."student" "s"
  WHERE (("s"."student_id" = "manual_enrollment"."student_id") AND ("s"."profile_id" = "auth"."uid"())))));



CREATE POLICY "me_select" ON "public"."manual_enrollment" FOR SELECT TO "authenticated" USING (true);



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



ALTER TABLE "public"."notification" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_select" ON "public"."notification" FOR SELECT TO "authenticated" USING (("recipient_id" = "auth"."uid"()));



CREATE POLICY "notification_update" ON "public"."notification" FOR UPDATE TO "authenticated" USING (("recipient_id" = "auth"."uid"())) WITH CHECK (("recipient_id" = "auth"."uid"()));



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



ALTER TABLE "public"."project" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_contributor" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_contributor_delete" ON "public"."project_contributor" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project" "p"
  WHERE (("p"."project_id" = "project_contributor"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "project_contributor_insert" ON "public"."project_contributor" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project" "p"
  WHERE (("p"."project_id" = "project_contributor"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "project_contributor_select" ON "public"."project_contributor" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "project_delete" ON "public"."project" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "project_insert" ON "public"."project" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."project_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_media_delete" ON "public"."project_media" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project" "p"
  WHERE (("p"."project_id" = "project_media"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "project_media_insert" ON "public"."project_media" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project" "p"
  WHERE (("p"."project_id" = "project_media"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "project_media_select" ON "public"."project_media" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "project_select" ON "public"."project" FOR SELECT TO "authenticated" USING ((("is_published" = true) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."project_skill" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_skill_delete" ON "public"."project_skill" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."project" "p"
  WHERE (("p"."project_id" = "project_skill"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "project_skill_insert" ON "public"."project_skill" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project" "p"
  WHERE (("p"."project_id" = "project_skill"."project_id") AND ("p"."user_id" = "auth"."uid"())))));



CREATE POLICY "project_skill_select" ON "public"."project_skill" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "project_update" ON "public"."project" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "rating_insert" ON "public"."achievement_rating" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "rating_select" ON "public"."achievement_rating" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rating_update" ON "public"."achievement_rating" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "reaction_delete" ON "public"."achievement_reaction" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "reaction_insert" ON "public"."achievement_reaction" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "reaction_select" ON "public"."achievement_reaction" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "reactions_delete" ON "public"."notice_board_reaction" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "reactions_insert" ON "public"."notice_board_reaction" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "reactions_select" ON "public"."notice_board_reaction" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "reactions_update" ON "public"."notice_board_reaction" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."research_paper" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."research_paper_author" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "research_paper_delete" ON "public"."research_paper" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "research_paper_insert" ON "public"."research_paper" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."research_paper_keyword" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."research_paper_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "research_paper_select" ON "public"."research_paper" FOR SELECT TO "authenticated" USING ((("is_published" = true) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "research_paper_update" ON "public"."research_paper" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "rp_author_delete" ON "public"."research_paper_author" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."research_paper" "rp"
  WHERE (("rp"."paper_id" = "research_paper_author"."paper_id") AND ("rp"."user_id" = "auth"."uid"())))));



CREATE POLICY "rp_author_insert" ON "public"."research_paper_author" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."research_paper" "rp"
  WHERE (("rp"."paper_id" = "research_paper_author"."paper_id") AND ("rp"."user_id" = "auth"."uid"())))));



CREATE POLICY "rp_author_select" ON "public"."research_paper_author" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rp_keyword_delete" ON "public"."research_paper_keyword" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."research_paper" "rp"
  WHERE (("rp"."paper_id" = "research_paper_keyword"."paper_id") AND ("rp"."user_id" = "auth"."uid"())))));



CREATE POLICY "rp_keyword_insert" ON "public"."research_paper_keyword" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."research_paper" "rp"
  WHERE (("rp"."paper_id" = "research_paper_keyword"."paper_id") AND ("rp"."user_id" = "auth"."uid"())))));



CREATE POLICY "rp_keyword_select" ON "public"."research_paper_keyword" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rp_media_delete" ON "public"."research_paper_media" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."research_paper" "rp"
  WHERE (("rp"."paper_id" = "research_paper_media"."paper_id") AND ("rp"."user_id" = "auth"."uid"())))));



CREATE POLICY "rp_media_insert" ON "public"."research_paper_media" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."research_paper" "rp"
  WHERE (("rp"."paper_id" = "research_paper_media"."paper_id") AND ("rp"."user_id" = "auth"."uid"())))));



CREATE POLICY "rp_media_select" ON "public"."research_paper_media" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."skill" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "skill_insert" ON "public"."skill" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "skill_select" ON "public"."skill" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."student" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_own_select" ON "public"."student" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "student_own_update" ON "public"."student" FOR UPDATE TO "authenticated" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "student_teacher_admin_select" ON "public"."student" FOR SELECT TO "authenticated" USING ((("public"."current_profile"())."role" = ANY (ARRAY['teacher'::"public"."app_role", 'admin'::"public"."app_role"])));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_message";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_message_attachment";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_message_reaction";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_request";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_room";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notice_board_post";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notification";



REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."auto_assign_grade"("p_marks" numeric, "p_total" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."auto_assign_grade"("p_marks" numeric, "p_total" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_assign_grade"("p_marks" numeric, "p_total" numeric) TO "service_role";



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



GRANT ALL ON FUNCTION "public"."fn_change_role"("p_admin_id" "uuid", "p_target_id" "uuid", "p_new_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_change_role"("p_admin_id" "uuid", "p_target_id" "uuid", "p_new_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_change_role"("p_admin_id" "uuid", "p_target_id" "uuid", "p_new_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_or_create_direct_room"("p_other_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_or_create_direct_room"("p_other_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_or_create_direct_room"("p_other_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_get_or_create_direct_room"("p_other_profile_id" "uuid", "p_my_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_get_or_create_direct_room"("p_other_profile_id" "uuid", "p_my_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_get_or_create_direct_room"("p_other_profile_id" "uuid", "p_my_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_hash_password"("p_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_hash_password"("p_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_hash_password"("p_password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_join_room_by_code"("p_code" "text", "p_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_join_room_by_code"("p_code" "text", "p_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_join_room_by_code"("p_code" "text", "p_password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_join_room_by_code"("p_code" "text", "p_password" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_join_room_by_code"("p_code" "text", "p_password" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_join_room_by_code"("p_code" "text", "p_password" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_profile_id_by_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_profile_id_by_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_profile_id_by_email"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid") TO "service_role";



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


















GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."achievement_comment" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."achievement_comment" TO "authenticated";
GRANT ALL ON TABLE "public"."achievement_comment" TO "service_role";



GRANT ALL ON SEQUENCE "public"."achievement_comment_comment_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."achievement_comment_comment_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."achievement_rating" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."achievement_rating" TO "authenticated";
GRANT ALL ON TABLE "public"."achievement_rating" TO "service_role";



GRANT ALL ON SEQUENCE "public"."achievement_rating_rating_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."achievement_rating_rating_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."achievement_reaction" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."achievement_reaction" TO "authenticated";
GRANT ALL ON TABLE "public"."achievement_reaction" TO "service_role";



GRANT ALL ON SEQUENCE "public"."achievement_reaction_reaction_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."achievement_reaction_reaction_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."advisor" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."advisor" TO "authenticated";
GRANT ALL ON TABLE "public"."advisor" TO "service_role";



GRANT ALL ON SEQUENCE "public"."advisor_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."advisor_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."attendance_record" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."attendance_record" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_record" TO "service_role";



GRANT ALL ON SEQUENCE "public"."attendance_record_record_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."attendance_record_record_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."attendance_session" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."attendance_session" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_session" TO "service_role";



GRANT ALL ON SEQUENCE "public"."attendance_session_session_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."attendance_session_session_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."certificate" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."certificate" TO "authenticated";
GRANT ALL ON TABLE "public"."certificate" TO "service_role";



GRANT ALL ON SEQUENCE "public"."certificate_certificate_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."certificate_certificate_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."certificate_media" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."certificate_media" TO "authenticated";
GRANT ALL ON TABLE "public"."certificate_media" TO "service_role";



GRANT ALL ON SEQUENCE "public"."certificate_media_media_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."certificate_media_media_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."certificate_skill" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."certificate_skill" TO "authenticated";
GRANT ALL ON TABLE "public"."certificate_skill" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."cgpa_record" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."cgpa_record" TO "authenticated";
GRANT ALL ON TABLE "public"."cgpa_record" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cgpa_record_record_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cgpa_record_record_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_message" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_message" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_message" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_message_attachment" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_message_attachment" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_message_attachment" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_message_reaction" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_message_reaction" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_message_reaction" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_request" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_request" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_request" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_room" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_room" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_room" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_room_member" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."chat_room_member" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_room_member" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."course_invite" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."course_invite" TO "authenticated";
GRANT ALL ON TABLE "public"."course_invite" TO "service_role";



GRANT ALL ON SEQUENCE "public"."course_invite_invite_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."course_invite_invite_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."course_resource" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."course_resource" TO "authenticated";
GRANT ALL ON TABLE "public"."course_resource" TO "service_role";



GRANT ALL ON SEQUENCE "public"."course_resource_resource_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."course_resource_resource_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."department" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."department" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."department" TO "anon";



GRANT ALL ON SEQUENCE "public"."department_dept_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."department_dept_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."department_dept_id_seq" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."exam" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."exam" TO "authenticated";
GRANT ALL ON TABLE "public"."exam" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exam_exam_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exam_exam_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."exam_mark" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."exam_mark" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_mark" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exam_mark_mark_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exam_mark_mark_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."instructor" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."instructor" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."instructor" TO "anon";



GRANT ALL ON SEQUENCE "public"."instructor_instructor_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."instructor_instructor_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."instructor_instructor_id_seq" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."manual_course" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."manual_course" TO "authenticated";
GRANT ALL ON TABLE "public"."manual_course" TO "service_role";



GRANT ALL ON SEQUENCE "public"."manual_course_manual_course_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."manual_course_manual_course_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."manual_enrollment" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."manual_enrollment" TO "authenticated";
GRANT ALL ON TABLE "public"."manual_enrollment" TO "service_role";



GRANT ALL ON SEQUENCE "public"."manual_enrollment_enrollment_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."manual_enrollment_enrollment_id_seq" TO "service_role";



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



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notification" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notification" TO "authenticated";
GRANT ALL ON TABLE "public"."notification" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notification_notification_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notification_notification_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."program" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."program" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."program" TO "anon";



GRANT ALL ON SEQUENCE "public"."program_program_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."program_program_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "public"."program_program_id_seq" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."project" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."project" TO "authenticated";
GRANT ALL ON TABLE "public"."project" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."project_contributor" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."project_contributor" TO "authenticated";
GRANT ALL ON TABLE "public"."project_contributor" TO "service_role";



GRANT ALL ON SEQUENCE "public"."project_contributor_contrib_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."project_contributor_contrib_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."project_media" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."project_media" TO "authenticated";
GRANT ALL ON TABLE "public"."project_media" TO "service_role";



GRANT ALL ON SEQUENCE "public"."project_media_media_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."project_media_media_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."project_project_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."project_project_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."project_skill" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."project_skill" TO "authenticated";
GRANT ALL ON TABLE "public"."project_skill" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."research_paper" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."research_paper" TO "authenticated";
GRANT ALL ON TABLE "public"."research_paper" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."research_paper_author" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."research_paper_author" TO "authenticated";
GRANT ALL ON TABLE "public"."research_paper_author" TO "service_role";



GRANT ALL ON SEQUENCE "public"."research_paper_author_author_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."research_paper_author_author_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."research_paper_keyword" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."research_paper_keyword" TO "authenticated";
GRANT ALL ON TABLE "public"."research_paper_keyword" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."research_paper_media" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."research_paper_media" TO "authenticated";
GRANT ALL ON TABLE "public"."research_paper_media" TO "service_role";



GRANT ALL ON SEQUENCE "public"."research_paper_media_media_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."research_paper_media_media_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."research_paper_paper_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."research_paper_paper_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."skill" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."skill" TO "authenticated";
GRANT ALL ON TABLE "public"."skill" TO "service_role";



GRANT ALL ON SEQUENCE "public"."skill_skill_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."skill_skill_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."student" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."student" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."student" TO "anon";



GRANT ALL ON SEQUENCE "public"."student_student_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "public"."student_student_id_seq" TO "authenticated";
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









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




























