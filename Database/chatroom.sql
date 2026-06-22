-- ============================================================
-- CHATROOM MODULE — Migration
-- Extends existing university portal Supabase database
-- ============================================================

-- ========================
-- EXTENSIONS (ensure pgcrypto available)
-- ========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================
-- ENUM
-- ========================
CREATE TYPE chat_room_type AS ENUM ('direct', 'advisor', 'group');

-- ========================
-- TABLES
-- ========================

-- TABLE: chat_room
CREATE TABLE public.chat_room (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          chat_room_type NOT NULL,
  title         TEXT,
  room_code     TEXT UNIQUE,
  password_hash TEXT,
  is_ephemeral  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chat_room ENABLE ROW LEVEL SECURITY;

-- TABLE: chat_room_member
CREATE TABLE public.chat_room_member (
  room_id       UUID NOT NULL REFERENCES public.chat_room(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role   TEXT NOT NULL DEFAULT 'member'
                  CHECK (member_role IN ('owner', 'member')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at  TIMESTAMPTZ,
  CONSTRAINT chat_room_member_pkey PRIMARY KEY (room_id, profile_id)
);

ALTER TABLE public.chat_room_member ENABLE ROW LEVEL SECURITY;

-- TABLE: chat_message
CREATE TABLE public.chat_message (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES public.chat_room(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES public.profiles(id),
  body       TEXT,
  reply_to   UUID REFERENCES public.chat_message(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at  TIMESTAMPTZ
);

CREATE INDEX chat_message_room_created_idx ON public.chat_message (room_id, created_at DESC);

ALTER TABLE public.chat_message ENABLE ROW LEVEL SECURITY;

-- TABLE: chat_message_attachment
CREATE TABLE public.chat_message_attachment (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES public.chat_message(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_type   attachment_file_type NOT NULL DEFAULT 'other',
  file_size   BIGINT,
  mime_type   VARCHAR(100)
);

ALTER TABLE public.chat_message_attachment ENABLE ROW LEVEL SECURITY;

-- TABLE: chat_message_reaction
CREATE TABLE public.chat_message_reaction (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES public.chat_message(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  reaction    reaction_type NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_message_reaction_unique UNIQUE (message_id, user_id, reaction)
);

ALTER TABLE public.chat_message_reaction ENABLE ROW LEVEL SECURITY;

-- TABLE: advisor (new — links student to their advisor instructor)
CREATE TABLE public.advisor (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id            INT NOT NULL REFERENCES public.student(student_id) ON DELETE CASCADE,
  advisor_instructor_id INT NOT NULL REFERENCES public.instructor(instructor_id) ON DELETE CASCADE,
  assigned_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT advisor_student_unique UNIQUE (student_id)
);

ALTER TABLE public.advisor ENABLE ROW LEVEL SECURITY;

-- ========================
-- HELPER FUNCTIONS
-- ========================

-- Returns true if the calling auth user is a member of the given room
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_member
    WHERE room_id = p_room_id AND profile_id = auth.uid()
  );
$$;

-- Finds or creates a direct room between auth.uid() and another profile
CREATE OR REPLACE FUNCTION public.fn_get_or_create_direct_room(p_other_profile_id UUID, p_my_profile_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id UUID;
  v_my_id   UUID := COALESCE(p_my_profile_id, auth.uid());
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

-- Join a room by code (with optional password verification)
CREATE OR REPLACE FUNCTION public.fn_join_room_by_code(p_code TEXT, p_password TEXT DEFAULT NULL, p_user_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
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

-- ========================
-- RLS POLICIES
-- ========================

-- chat_room
CREATE POLICY "chat_room_select_member" ON public.chat_room
  FOR SELECT USING (public.is_room_member(id));

CREATE POLICY "chat_room_insert_auth" ON public.chat_room
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- chat_room_member
CREATE POLICY "chat_room_member_select" ON public.chat_room_member
  FOR SELECT USING (public.is_room_member(room_id));

CREATE POLICY "chat_room_member_insert_self" ON public.chat_room_member
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "chat_room_member_delete_owner" ON public.chat_room_member
  FOR DELETE USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_room_member m
      WHERE m.room_id = chat_room_member.room_id
        AND m.profile_id = auth.uid()
        AND m.member_role = 'owner'
    )
  );

-- chat_message
CREATE POLICY "chat_message_select_member" ON public.chat_message
  FOR SELECT USING (public.is_room_member(room_id));

CREATE POLICY "chat_message_insert_member" ON public.chat_message
  FOR INSERT WITH CHECK (
    public.is_room_member(room_id) AND sender_id = auth.uid()
  );

CREATE POLICY "chat_message_update_own" ON public.chat_message
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "chat_message_delete_own" ON public.chat_message
  FOR DELETE USING (sender_id = auth.uid());

-- chat_message_attachment
CREATE POLICY "chat_message_attachment_select" ON public.chat_message_attachment
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_message m
      WHERE m.id = message_id AND public.is_room_member(m.room_id)
    )
  );

CREATE POLICY "chat_message_attachment_insert" ON public.chat_message_attachment
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_message m
      WHERE m.id = message_id AND public.is_room_member(m.room_id)
        AND m.sender_id = auth.uid()
    )
  );

CREATE POLICY "chat_message_attachment_delete" ON public.chat_message_attachment
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.chat_message m
      WHERE m.id = message_id AND m.sender_id = auth.uid()
    )
  );

-- chat_message_reaction
CREATE POLICY "chat_message_reaction_select" ON public.chat_message_reaction
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_message m
      WHERE m.id = message_id AND public.is_room_member(m.room_id)
    )
  );

CREATE POLICY "chat_message_reaction_insert" ON public.chat_message_reaction
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.chat_message m
      WHERE m.id = message_id AND public.is_room_member(m.room_id)
    )
  );

CREATE POLICY "chat_message_reaction_delete_own" ON public.chat_message_reaction
  FOR DELETE USING (user_id = auth.uid());

-- advisor
CREATE POLICY "advisor_select_own" ON public.advisor
  FOR SELECT USING (
    -- Student sees their own advisor row
    EXISTS (SELECT 1 FROM public.student s WHERE s.student_id = advisor.student_id AND s.profile_id = auth.uid())
    -- Instructor sees rows where they are the advisor
    OR EXISTS (SELECT 1 FROM public.instructor i WHERE i.instructor_id = advisor.advisor_instructor_id AND i.profile_id = auth.uid())
    -- Admin sees all
    OR public.current_user_role() = 'admin'
  );

-- Writes to advisor restricted to service role (no policy = blocked for normal users)

-- Helper to hash a password using pgcrypto (called from backend via RPC)
CREATE OR REPLACE FUNCTION public.fn_hash_password(p_password TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = extensions, public
AS $$
  SELECT extensions.crypt(p_password, extensions.gen_salt('bf'));
$$;

-- ========================
-- REALTIME PUBLICATION
-- ========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reaction;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room;

-- ========================
-- EPHEMERAL MESSAGE CLEANUP (pg_cron)
-- ========================
-- Run in Supabase SQL Editor after enabling the pg_cron extension:
--   SELECT cron.schedule(
--     'purge-ephemeral-chat-messages',
--     '0 * * * *',   -- every hour
--     $$
--       DELETE FROM public.chat_message
--       WHERE created_at < NOW() - INTERVAL '24 hours'
--         AND room_id IN (SELECT id FROM public.chat_room WHERE is_ephemeral = TRUE);
--     $$
--   );
--
-- To enable pg_cron: Dashboard → Database → Extensions → enable "pg_cron"
-- Or the backend exposes POST /api/chat/admin/purge-ephemeral for manual/scheduled invocation.
