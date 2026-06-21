-- Enable realtime for the notification table so the bell icon updates live.
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).

ALTER PUBLICATION supabase_realtime ADD TABLE public.notification;

-- Required so Supabase can filter realtime events by recipient_id (non-PK column).
ALTER TABLE public.notification REPLICA IDENTITY FULL;
