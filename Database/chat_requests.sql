-- ============================================================
-- CHAT REQUEST SYSTEM — Migration
-- Adds Messenger-style contact requests for direct chats
-- ============================================================

-- ENUM: request status
CREATE TYPE chat_request_status AS ENUM ('pending', 'accepted', 'declined');

-- TABLE: chat_request
CREATE TABLE public.chat_request (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status         chat_request_status NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at   TIMESTAMPTZ,
  CONSTRAINT chat_request_unique UNIQUE (from_id, to_id),
  CONSTRAINT chat_request_no_self CHECK (from_id <> to_id)
);

ALTER TABLE public.chat_request ENABLE ROW LEVEL SECURITY;

-- RLS: sender sees their outgoing requests; recipient sees their incoming requests
CREATE POLICY "chat_request_select" ON public.chat_request
  FOR SELECT USING (from_id = auth.uid() OR to_id = auth.uid());

CREATE POLICY "chat_request_insert" ON public.chat_request
  FOR INSERT WITH CHECK (from_id = auth.uid());

-- Only the recipient can update status (accept/decline)
CREATE POLICY "chat_request_update" ON public.chat_request
  FOR UPDATE USING (to_id = auth.uid());

-- Either party can delete (withdraw / clear)
CREATE POLICY "chat_request_delete" ON public.chat_request
  FOR DELETE USING (from_id = auth.uid() OR to_id = auth.uid());

-- Add to realtime publication so requests appear live
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_request;
