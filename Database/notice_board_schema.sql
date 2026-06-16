-- ============================================================
-- NOTICE BOARD MODULE — 3NF Normalized Schema
-- Extends existing EduHub Supabase database
-- ============================================================

-- ENUM: notice category (6 categories)
CREATE TYPE notice_category AS ENUM (
  'academics_exams',
  'general',
  'hall_info',
  'transport',
  'emergency',
  'upcoming_events'
);

-- ENUM: notice audience
CREATE TYPE notice_audience_type AS ENUM (
  'all',        -- everyone sees
  'students',   -- students + teachers see
  'teachers'    -- only teachers see
);

-- ENUM: 10 emoji reaction types
CREATE TYPE reaction_type AS ENUM (
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

-- ENUM: attachment file types
CREATE TYPE attachment_file_type AS ENUM (
  'image',
  'pdf',
  'doc',
  'markdown',
  'mp4',
  'mp3',
  'audio',
  'other'
);

-- TABLE 1: notice_board_post
-- One row per notice/post. Author is profiles.id (UUID).
-- 3NF: no transitive dependencies. audience, category stored as enums.
CREATE TABLE notice_board_post (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      notice_category NOT NULL DEFAULT 'general',
  audience      notice_audience_type NOT NULL DEFAULT 'all',
  title         VARCHAR(255) NOT NULL CHECK (char_length(trim(title)) > 0),
  content       TEXT NOT NULL DEFAULT '',
  is_edited     BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at     TIMESTAMPTZ,
  has_poll      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLE 2: notice_board_attachment
-- 3NF: multi-valued attribute (attachments) extracted to own table
CREATE TABLE notice_board_attachment (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES notice_board_post(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_type   attachment_file_type NOT NULL DEFAULT 'other',
  file_size   BIGINT CHECK (file_size > 0),
  mime_type   VARCHAR(100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLE 3: notice_board_reaction
-- 3NF: user reacts to post with exactly one reaction type (upsert pattern)
CREATE TABLE notice_board_reaction (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES notice_board_post(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction      reaction_type NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)   -- one reaction per user per post
);

-- TABLE 4: notice_board_poll
-- 3NF: poll is a 1:1 extension of a post (has_poll=true on post)
CREATE TABLE notice_board_poll (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL UNIQUE REFERENCES notice_board_post(id) ON DELETE CASCADE,
  question        TEXT NOT NULL CHECK (char_length(trim(question)) > 0),
  is_multiple     BOOLEAN NOT NULL DEFAULT FALSE,
  ends_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLE 5: notice_board_poll_option
-- 3NF: poll options are multi-valued → own table
CREATE TABLE notice_board_poll_option (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     UUID NOT NULL REFERENCES notice_board_poll(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL CHECK (char_length(trim(option_text)) > 0),
  display_order SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLE 6: notice_board_poll_vote
-- 3NF: user votes on a specific option in a poll
-- For single-choice: UNIQUE (poll_id, user_id) enforced via trigger
CREATE TABLE notice_board_poll_vote (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     UUID NOT NULL REFERENCES notice_board_poll(id) ON DELETE CASCADE,
  option_id   UUID NOT NULL REFERENCES notice_board_poll_option(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (option_id, user_id)
);

-- INDEXES for performance
CREATE INDEX idx_nbp_category ON notice_board_post(category);
CREATE INDEX idx_nbp_author ON notice_board_post(author_id);
CREATE INDEX idx_nbp_created ON notice_board_post(created_at DESC);
CREATE INDEX idx_nba_post ON notice_board_attachment(post_id);
CREATE INDEX idx_nbr_post ON notice_board_reaction(post_id);
CREATE INDEX idx_nbr_user ON notice_board_reaction(user_id);
CREATE INDEX idx_nbpv_poll ON notice_board_poll_vote(poll_id);

-- TRIGGER: update updated_at on notice_board_post edit
CREATE OR REPLACE FUNCTION update_notice_board_post_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  IF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
    NEW.is_edited = TRUE;
    NEW.edited_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nbp_updated_at
  BEFORE UPDATE ON notice_board_post
  FOR EACH ROW EXECUTE FUNCTION update_notice_board_post_updated_at();

-- TRIGGER: prevent single-choice duplicate votes
CREATE OR REPLACE FUNCTION enforce_single_choice_vote()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

CREATE TRIGGER trg_single_choice_vote
  AFTER INSERT ON notice_board_poll_vote
  FOR EACH ROW EXECUTE FUNCTION enforce_single_choice_vote();

-- VIEW: notice posts with author info, reaction counts, attachment counts
CREATE OR REPLACE VIEW v_notice_board_posts AS
SELECT
  p.id,
  p.author_id,
  pr.first_name || ' ' || pr.last_name AS author_name,
  pr.avatar_url AS author_avatar,
  pr.role AS author_role,
  p.category,
  p.audience,
  p.title,
  p.content,
  p.is_edited,
  p.edited_at,
  p.has_poll,
  p.created_at,
  p.updated_at,
  (SELECT COUNT(*) FROM notice_board_attachment a WHERE a.post_id = p.id) AS attachment_count,
  (SELECT COUNT(*) FROM notice_board_reaction r WHERE r.post_id = p.id) AS reaction_count
FROM notice_board_post p
JOIN profiles pr ON pr.id = p.author_id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE notice_board_post ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_board_attachment ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_board_reaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_board_poll ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_board_poll_option ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_board_poll_vote ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$;

-- notice_board_post RLS:
-- SELECT: authenticated users see 'all' + 'students' posts.
--         teachers also see 'teachers' posts.
-- INSERT: any authenticated user (student or teacher)
-- UPDATE/DELETE: only the author

CREATE POLICY "notices_select" ON notice_board_post
  FOR SELECT TO authenticated
  USING (
    audience = 'all'
    OR (audience = 'students' AND current_user_role() = 'student')
    OR (audience = 'teachers' AND current_user_role() = 'teacher')
  );

CREATE POLICY "notices_insert" ON notice_board_post
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "notices_update" ON notice_board_post
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "notices_delete" ON notice_board_post
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- attachment RLS: follows the post visibility
CREATE POLICY "attachments_select" ON notice_board_attachment
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM notice_board_post p
      WHERE p.id = post_id
      AND (p.audience IN ('all','students') OR (p.audience = 'teachers' AND current_user_role() = 'teacher'))
    )
  );
CREATE POLICY "attachments_insert" ON notice_board_attachment
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM notice_board_post p WHERE p.id = post_id AND p.author_id = auth.uid())
  );
CREATE POLICY "attachments_delete" ON notice_board_attachment
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM notice_board_post p WHERE p.id = post_id AND p.author_id = auth.uid())
  );

-- reaction RLS
CREATE POLICY "reactions_select" ON notice_board_reaction FOR SELECT TO authenticated USING (true);
CREATE POLICY "reactions_insert" ON notice_board_reaction FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_update" ON notice_board_reaction FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "reactions_delete" ON notice_board_reaction FOR DELETE TO authenticated USING (user_id = auth.uid());

-- poll RLS
CREATE POLICY "poll_select" ON notice_board_poll FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_insert" ON notice_board_poll FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM notice_board_post p WHERE p.id = post_id AND p.author_id = auth.uid()));

-- poll_option RLS
CREATE POLICY "poll_option_select" ON notice_board_poll_option FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_option_insert" ON notice_board_poll_option FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM notice_board_poll po
    JOIN notice_board_post p ON p.id = po.post_id
    WHERE po.id = poll_id AND p.author_id = auth.uid()
  ));

-- poll_vote RLS
CREATE POLICY "poll_vote_select" ON notice_board_poll_vote FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_vote_insert" ON notice_board_poll_vote FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "poll_vote_delete" ON notice_board_poll_vote FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Storage bucket for notice attachments (run in Supabase dashboard Storage settings)
-- Bucket name: notice-attachments | Public: false | Max size: 50MB
-- Allowed MIME types: image/*, application/pdf, text/plain, text/markdown,
--   application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document,
--   video/mp4, audio/mpeg, audio/mp3, audio/webm, audio/ogg
