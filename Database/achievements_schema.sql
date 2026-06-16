-- ============================================================
-- ACHIEVEMENTS MODULE — 3NF Normalized Schema
-- Extends existing EduHub Supabase database
-- All user references use auth.users(id) UUID (same as notice_board_schema.sql)
-- ============================================================

-- ── SHARED SKILLS REFERENCE ────────────────────────────────────────────────
-- FDs: skill_id → {skill_name, category, created_at}. skill_name is UNIQUE candidate key.
-- No transitive deps among non-key attrs. ✓ 3NF.
CREATE TABLE skill (
    skill_id    SERIAL PRIMARY KEY,
    skill_name  VARCHAR(100) NOT NULL UNIQUE,
    category    VARCHAR(50),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ACHIEVEMENT CONTENT TYPE ENUM ─────────────────────────────────────────
CREATE TYPE achievement_content_type AS ENUM ('project', 'certificate', 'research_paper');

-- ── PROJECT MODULE ─────────────────────────────────────────────────────────
-- FDs: project_id → all columns. user_id is FK to auth.users, not a determinant
--      of other non-key attrs (title, description, etc. depend only on project_id). ✓ 3NF.
CREATE TABLE project (
    project_id      SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT CHECK (char_length(description) <= 2000),
    thumbnail_url   VARCHAR(500),
    github_url      VARCHAR(500),
    live_demo_url   VARCHAR(500),
    start_month     SMALLINT CHECK (start_month BETWEEN 1 AND 12),
    start_year      SMALLINT CHECK (start_year BETWEEN 2000 AND 2100),
    end_month       SMALLINT CHECK (end_month BETWEEN 1 AND 12),
    end_year        SMALLINT CHECK (end_year BETWEEN 2000 AND 2100),
    is_current      BOOLEAN NOT NULL DEFAULT FALSE,
    associated_with VARCHAR(200),
    is_published    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (is_current = TRUE OR end_year IS NOT NULL)
);

-- FDs: (project_id, skill_id) → nothing extra. Pure junction — ✓ BCNF.
CREATE TABLE project_skill (
    project_id  INT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
    skill_id    INT NOT NULL REFERENCES skill(skill_id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, skill_id)
);

-- FDs: contrib_id → all; (project_id, user_id) is also a candidate key.
-- role depends on contrib_id (the role this specific user played in this project). ✓ 3NF.
CREATE TABLE project_contributor (
    contrib_id  SERIAL PRIMARY KEY,
    project_id  INT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        VARCHAR(100),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);

-- FDs: media_id → all. file_size_bytes/mime_type are facts about the file. ✓ 3NF.
CREATE TABLE project_media (
    media_id        SERIAL PRIMARY KEY,
    project_id      INT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
    file_url        VARCHAR(500) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_type       VARCHAR(50) NOT NULL
                        CHECK (file_type IN ('image','video','audio','document','presentation','site','other')),
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800),
    mime_type       VARCHAR(100),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CERTIFICATE MODULE ──────────────────────────────────────────────────────
-- FDs: certificate_id → all. issuing_org is a fact about the cert, not about the user. ✓ 3NF.
CREATE TABLE certificate (
    certificate_id  SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cert_name       VARCHAR(255) NOT NULL,
    issuing_org     VARCHAR(255) NOT NULL,
    issue_month     SMALLINT CHECK (issue_month BETWEEN 1 AND 12),
    issue_year      SMALLINT NOT NULL CHECK (issue_year BETWEEN 2000 AND 2100),
    expiry_month    SMALLINT CHECK (expiry_month BETWEEN 1 AND 12),
    expiry_year     SMALLINT CHECK (expiry_year BETWEEN 2000 AND 2100),
    credential_id   VARCHAR(255),
    credential_url  VARCHAR(500),
    is_published    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        expiry_year IS NULL
        OR expiry_year > issue_year
        OR (expiry_year = issue_year AND (expiry_month IS NULL OR issue_month IS NULL OR expiry_month >= issue_month))
    )
);

CREATE TABLE certificate_skill (
    certificate_id  INT NOT NULL REFERENCES certificate(certificate_id) ON DELETE CASCADE,
    skill_id        INT NOT NULL REFERENCES skill(skill_id) ON DELETE CASCADE,
    PRIMARY KEY (certificate_id, skill_id)
);

CREATE TABLE certificate_media (
    media_id        SERIAL PRIMARY KEY,
    certificate_id  INT NOT NULL REFERENCES certificate(certificate_id) ON DELETE CASCADE,
    file_url        VARCHAR(500) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_type       VARCHAR(50) NOT NULL
                        CHECK (file_type IN ('image','video','audio','document','presentation','site','other')),
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800),
    mime_type       VARCHAR(100),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RESEARCH PAPER MODULE ───────────────────────────────────────────────────
-- FDs: paper_id → all. doi is UNIQUE candidate key. journal_name/conference_name
--      depend on paper_id (submission context), not on doi alone. ✓ 3NF.
CREATE TABLE research_paper (
    paper_id        SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    abstract        TEXT,
    journal_name    VARCHAR(300),
    conference_name VARCHAR(300),
    doi             VARCHAR(255) UNIQUE,
    paper_url       VARCHAR(500),
    scholar_url     VARCHAR(500),
    publish_month   SMALLINT CHECK (publish_month BETWEEN 1 AND 12),
    publish_year    SMALLINT CHECK (publish_year BETWEEN 2000 AND 2100),
    citation_count  INT NOT NULL DEFAULT 0 CHECK (citation_count >= 0),
    is_published    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FDs: author_id → all; (paper_id, author_order) is candidate key.
-- author_name is denormalized intentionally for external authors (user_id nullable). ✓ 3NF.
CREATE TABLE research_paper_author (
    author_id           SERIAL PRIMARY KEY,
    paper_id            INT NOT NULL REFERENCES research_paper(paper_id) ON DELETE CASCADE,
    user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name         VARCHAR(120) NOT NULL,
    author_order        SMALLINT NOT NULL DEFAULT 1 CHECK (author_order > 0),
    is_corresponding    BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (paper_id, author_order)
);

CREATE TABLE research_paper_keyword (
    paper_id    INT NOT NULL REFERENCES research_paper(paper_id) ON DELETE CASCADE,
    skill_id    INT NOT NULL REFERENCES skill(skill_id) ON DELETE CASCADE,
    PRIMARY KEY (paper_id, skill_id)
);

CREATE TABLE research_paper_media (
    media_id        SERIAL PRIMARY KEY,
    paper_id        INT NOT NULL REFERENCES research_paper(paper_id) ON DELETE CASCADE,
    file_url        VARCHAR(500) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_type       VARCHAR(50) NOT NULL
                        CHECK (file_type IN ('image','video','audio','document','presentation','site','other')),
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800),
    mime_type       VARCHAR(100),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SOCIAL FEATURES (polymorphic across all 3 achievement types) ────────────
-- FDs: reaction_id → all. (user_id, achievement_type, target_id, emoji) is unique. ✓ 3NF.
CREATE TABLE achievement_reaction (
    reaction_id         SERIAL PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type    achievement_content_type NOT NULL,
    target_id           INT NOT NULL,
    emoji               VARCHAR(10) NOT NULL
                            CHECK (emoji IN ('👍','❤️','🔥','🎉','🤩','💡','👏','😮','🏆','💪')),
    reacted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, achievement_type, target_id, emoji)
);

-- FDs: comment_id → all. parent_comment_id is a self-ref FK, not a determinant. ✓ 3NF.
CREATE TABLE achievement_comment (
    comment_id          SERIAL PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type    achievement_content_type NOT NULL,
    target_id           INT NOT NULL,
    parent_comment_id   INT REFERENCES achievement_comment(comment_id) ON DELETE CASCADE,
    body                TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FDs: rating_id → all. (user_id, achievement_type, target_id) is unique. ✓ 3NF.
CREATE TABLE achievement_rating (
    rating_id           SERIAL PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type    achievement_content_type NOT NULL,
    target_id           INT NOT NULL,
    rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    rated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, achievement_type, target_id)
);

-- ── NOTIFICATIONS ──────────────────────────────────────────────────────────
-- FDs: notification_id → all. No transitive dependency. ✓ 3NF.
CREATE TABLE notification (
    notification_id SERIAL PRIMARY KEY,
    recipient_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notif_type      VARCHAR(60) NOT NULL
                        CHECK (notif_type IN (
                            'new_project','new_certificate','new_research_paper',
                            'new_comment','new_reaction','new_rating',
                            'new_notice','new_event','general'
                        )),
    title           VARCHAR(255) NOT NULL,
    body            TEXT,
    achievement_type achievement_content_type,
    target_id       INT,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX idx_project_user ON project(user_id);
CREATE INDEX idx_project_published ON project(is_published, created_at DESC);
CREATE INDEX idx_certificate_user ON certificate(user_id);
CREATE INDEX idx_certificate_published ON certificate(is_published, created_at DESC);
CREATE INDEX idx_research_paper_user ON research_paper(user_id);
CREATE INDEX idx_research_paper_published ON research_paper(is_published, created_at DESC);
CREATE INDEX idx_achievement_reaction_target ON achievement_reaction(achievement_type, target_id);
CREATE INDEX idx_achievement_comment_target ON achievement_comment(achievement_type, target_id);
CREATE INDEX idx_achievement_rating_target ON achievement_rating(achievement_type, target_id);
CREATE INDEX idx_notification_recipient ON notification(recipient_id, created_at DESC);
CREATE INDEX idx_notification_unread ON notification(recipient_id, is_read) WHERE is_read = FALSE;

-- ── UPDATED_AT TRIGGER FUNCTION ────────────────────────────────────────────
-- Defined here in case set_updated_at() does not yet exist in the main schema.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_updated_at
    BEFORE UPDATE ON project FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_certificate_updated_at
    BEFORE UPDATE ON certificate FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_research_paper_updated_at
    BEFORE UPDATE ON research_paper FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_achievement_comment_updated_at
    BEFORE UPDATE ON achievement_comment FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- NOTE: Broadcast notifications are handled by the Python backend (_broadcast_achievement).
-- No DB trigger needed — it would cause double-notifications and the profiles table
-- has no "email" column (email lives in auth.users).

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE skill                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE project                ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_skill          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contributor    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_media          ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate            ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_skill      ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_media      ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_paper         ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_paper_author  ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_paper_keyword ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_paper_media   ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_reaction   ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_comment    ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_rating     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification           ENABLE ROW LEVEL SECURITY;

-- ── SKILL ──────────────────────────────────────────────────────────────────
-- Anyone authenticated can read skills; any user can add new ones.
CREATE POLICY "skill_select" ON skill FOR SELECT TO authenticated USING (true);
CREATE POLICY "skill_insert" ON skill FOR INSERT TO authenticated WITH CHECK (true);

-- ── PROJECT ────────────────────────────────────────────────────────────────
CREATE POLICY "project_select" ON project
    FOR SELECT TO authenticated
    USING (is_published = TRUE OR user_id = auth.uid());

CREATE POLICY "project_insert" ON project
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "project_update" ON project
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "project_delete" ON project
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- ── PROJECT_SKILL ──────────────────────────────────────────────────────────
CREATE POLICY "project_skill_select" ON project_skill FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_skill_insert" ON project_skill
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM project p WHERE p.project_id = project_skill.project_id AND p.user_id = auth.uid()));
CREATE POLICY "project_skill_delete" ON project_skill
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM project p WHERE p.project_id = project_skill.project_id AND p.user_id = auth.uid()));

-- ── PROJECT_CONTRIBUTOR ────────────────────────────────────────────────────
CREATE POLICY "project_contributor_select" ON project_contributor FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_contributor_insert" ON project_contributor
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM project p WHERE p.project_id = project_contributor.project_id AND p.user_id = auth.uid()));
CREATE POLICY "project_contributor_delete" ON project_contributor
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM project p WHERE p.project_id = project_contributor.project_id AND p.user_id = auth.uid()));

-- ── PROJECT_MEDIA ──────────────────────────────────────────────────────────
CREATE POLICY "project_media_select" ON project_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_media_insert" ON project_media
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM project p WHERE p.project_id = project_media.project_id AND p.user_id = auth.uid()));
CREATE POLICY "project_media_delete" ON project_media
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM project p WHERE p.project_id = project_media.project_id AND p.user_id = auth.uid()));

-- ── CERTIFICATE ────────────────────────────────────────────────────────────
CREATE POLICY "certificate_select" ON certificate
    FOR SELECT TO authenticated
    USING (is_published = TRUE OR user_id = auth.uid());
CREATE POLICY "certificate_insert" ON certificate
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "certificate_update" ON certificate
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "certificate_delete" ON certificate
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── CERTIFICATE_SKILL ──────────────────────────────────────────────────────
CREATE POLICY "certificate_skill_select" ON certificate_skill FOR SELECT TO authenticated USING (true);
CREATE POLICY "certificate_skill_insert" ON certificate_skill
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM certificate c WHERE c.certificate_id = certificate_skill.certificate_id AND c.user_id = auth.uid()));
CREATE POLICY "certificate_skill_delete" ON certificate_skill
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM certificate c WHERE c.certificate_id = certificate_skill.certificate_id AND c.user_id = auth.uid()));

-- ── CERTIFICATE_MEDIA ──────────────────────────────────────────────────────
CREATE POLICY "certificate_media_select" ON certificate_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "certificate_media_insert" ON certificate_media
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM certificate c WHERE c.certificate_id = certificate_media.certificate_id AND c.user_id = auth.uid()));
CREATE POLICY "certificate_media_delete" ON certificate_media
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM certificate c WHERE c.certificate_id = certificate_media.certificate_id AND c.user_id = auth.uid()));

-- ── RESEARCH_PAPER ────────────────────────────────────────────────────────
CREATE POLICY "research_paper_select" ON research_paper
    FOR SELECT TO authenticated
    USING (is_published = TRUE OR user_id = auth.uid());
CREATE POLICY "research_paper_insert" ON research_paper
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "research_paper_update" ON research_paper
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "research_paper_delete" ON research_paper
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── RESEARCH_PAPER_AUTHOR ─────────────────────────────────────────────────
CREATE POLICY "rp_author_select" ON research_paper_author FOR SELECT TO authenticated USING (true);
CREATE POLICY "rp_author_insert" ON research_paper_author
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM research_paper rp WHERE rp.paper_id = research_paper_author.paper_id AND rp.user_id = auth.uid()));
CREATE POLICY "rp_author_delete" ON research_paper_author
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM research_paper rp WHERE rp.paper_id = research_paper_author.paper_id AND rp.user_id = auth.uid()));

-- ── RESEARCH_PAPER_KEYWORD ────────────────────────────────────────────────
CREATE POLICY "rp_keyword_select" ON research_paper_keyword FOR SELECT TO authenticated USING (true);
CREATE POLICY "rp_keyword_insert" ON research_paper_keyword
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM research_paper rp WHERE rp.paper_id = research_paper_keyword.paper_id AND rp.user_id = auth.uid()));
CREATE POLICY "rp_keyword_delete" ON research_paper_keyword
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM research_paper rp WHERE rp.paper_id = research_paper_keyword.paper_id AND rp.user_id = auth.uid()));

-- ── RESEARCH_PAPER_MEDIA ─────────────────────────────────────────────────
CREATE POLICY "rp_media_select" ON research_paper_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "rp_media_insert" ON research_paper_media
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM research_paper rp WHERE rp.paper_id = research_paper_media.paper_id AND rp.user_id = auth.uid()));
CREATE POLICY "rp_media_delete" ON research_paper_media
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM research_paper rp WHERE rp.paper_id = research_paper_media.paper_id AND rp.user_id = auth.uid()));

-- ── ACHIEVEMENT_REACTION ──────────────────────────────────────────────────
CREATE POLICY "reaction_select" ON achievement_reaction FOR SELECT TO authenticated USING (true);
CREATE POLICY "reaction_insert" ON achievement_reaction
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reaction_delete" ON achievement_reaction
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── ACHIEVEMENT_COMMENT ───────────────────────────────────────────────────
CREATE POLICY "comment_select" ON achievement_comment FOR SELECT TO authenticated USING (true);
CREATE POLICY "comment_insert" ON achievement_comment
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "comment_update" ON achievement_comment
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "comment_delete" ON achievement_comment
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── ACHIEVEMENT_RATING ────────────────────────────────────────────────────
CREATE POLICY "rating_select" ON achievement_rating FOR SELECT TO authenticated USING (true);
CREATE POLICY "rating_insert" ON achievement_rating
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "rating_update" ON achievement_rating
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── NOTIFICATION ──────────────────────────────────────────────────────────
-- Users can only read and update (mark-read) their own notifications.
-- Service-role (backend) handles inserts.
CREATE POLICY "notification_select" ON notification
    FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "notification_update" ON notification
    FOR UPDATE TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

-- ── GRANTS (match existing grants.sql pattern) ─────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON skill TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_skill TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_contributor TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON certificate TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON certificate_skill TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON certificate_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON research_paper TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON research_paper_author TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON research_paper_keyword TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON research_paper_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON achievement_reaction TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON achievement_comment TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON achievement_rating TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT ALL ON skill, project, project_skill, project_contributor, project_media,
    certificate, certificate_skill, certificate_media,
    research_paper, research_paper_author, research_paper_keyword, research_paper_media,
    achievement_reaction, achievement_comment, achievement_rating, notification
    TO service_role;

-- ============================================================
-- HACKATHON EXTENSION — run this block if schema already applied
-- ============================================================

-- Extend the polymorphic type enum used by reaction/comment/rating tables
ALTER TYPE achievement_content_type ADD VALUE IF NOT EXISTS 'hackathon';

-- ── HACKATHON ──────────────────────────────────────────────────────────────
-- FDs: hackathon_id → all cols. user_id + title is a natural candidate key.
-- organizer, position, prize have no deps among non-key attrs. ✓ 3NF.
CREATE TABLE IF NOT EXISTS hackathon (
    hackathon_id    SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    organizer       VARCHAR(255),
    position        VARCHAR(100),        -- e.g. "Champion", "Runner-up", "Finalist"
    team_name       VARCHAR(255),
    start_date      DATE,
    end_date        DATE,
    description     TEXT,
    prize           VARCHAR(255),
    event_url       VARCHAR(500),
    is_published    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE hackathon ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_hackathon_updated_at BEFORE UPDATE ON hackathon
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "hackathon_select" ON hackathon
    FOR SELECT TO authenticated
    USING (is_published = TRUE OR user_id = auth.uid());
CREATE POLICY "hackathon_insert" ON hackathon
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
CREATE POLICY "hackathon_update" ON hackathon
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "hackathon_delete" ON hackathon
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- ── HACKATHON_SKILL (junction) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hackathon_skill (
    hackathon_id    INT  NOT NULL REFERENCES hackathon(hackathon_id) ON DELETE CASCADE,
    skill_id        INT  NOT NULL REFERENCES skill(skill_id) ON DELETE CASCADE,
    PRIMARY KEY (hackathon_id, skill_id)
);
ALTER TABLE hackathon_skill ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hackathon_skill_select" ON hackathon_skill
    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "hackathon_skill_insert" ON hackathon_skill
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM hackathon h WHERE h.hackathon_id = hackathon_skill.hackathon_id AND h.user_id = auth.uid()));
CREATE POLICY "hackathon_skill_delete" ON hackathon_skill
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM hackathon h WHERE h.hackathon_id = hackathon_skill.hackathon_id AND h.user_id = auth.uid()));

-- ── HACKATHON_MEDIA ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hackathon_media (
    media_id            SERIAL PRIMARY KEY,
    hackathon_id        INT NOT NULL REFERENCES hackathon(hackathon_id) ON DELETE CASCADE,
    file_url            TEXT NOT NULL,
    file_name           VARCHAR(255) NOT NULL,
    file_type           VARCHAR(50)  NOT NULL,
    file_size_bytes     INT  NOT NULL,
    mime_type           VARCHAR(100),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE hackathon_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hackathon_media_select" ON hackathon_media
    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "hackathon_media_insert" ON hackathon_media
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM hackathon h WHERE h.hackathon_id = hackathon_media.hackathon_id AND h.user_id = auth.uid()));
CREATE POLICY "hackathon_media_delete" ON hackathon_media
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM hackathon h WHERE h.hackathon_id = hackathon_media.hackathon_id AND h.user_id = auth.uid()));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON hackathon TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON hackathon_skill TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON hackathon_media TO authenticated;
GRANT ALL ON hackathon, hackathon_skill, hackathon_media TO service_role;
GRANT USAGE, SELECT ON SEQUENCE hackathon_hackathon_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE hackathon_media_media_id_seq TO authenticated;

-- ── 3NF PROOF SUMMARY ─────────────────────────────────────────────────────
-- skill: skill_id → all; skill_name is UNIQUE candidate key. ✓ 3NF
-- project: project_id → all; user_id is FK not a determinant of other attrs. ✓ 3NF
-- project_skill, certificate_skill, research_paper_keyword: pure junctions. ✓ BCNF
-- project_contributor: contrib_id → all; (project_id,user_id) alt candidate key. ✓ 3NF
-- project_media / certificate_media / research_paper_media: media_id → all. ✓ 3NF
-- certificate: certificate_id → all; issuing_org is a cert attribute. ✓ 3NF
-- research_paper: paper_id → all; doi is UNIQUE candidate key. ✓ 3NF
-- research_paper_author: author_id → all; (paper_id,author_order) alt key.
--   author_name denormalized for external authors (nullable user_id). ✓ 3NF
-- achievement_reaction / achievement_rating: surrogate PK + unique composite candidate key. ✓ 3NF
-- achievement_comment: comment_id → all; parent_comment_id is self-ref FK not a determinant. ✓ 3NF
-- notification: notification_id → all. No transitive dependency. ✓ 3NF
