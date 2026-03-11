-- Tokens de acceso al portal (sin auth.users)
CREATE TABLE public.client_portal_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  token            TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  label            TEXT DEFAULT 'Portal principal',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at       TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  access_count     INTEGER NOT NULL DEFAULT 0,
  created_by       UUID NOT NULL REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portal_tokens_token ON public.client_portal_tokens(token);
CREATE INDEX idx_portal_tokens_contact ON public.client_portal_tokens(contact_id);

-- Álbumes por cliente
CREATE TABLE public.albums (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  cover_url    TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER albums_updated_at
  BEFORE UPDATE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ítems multimedia
CREATE TABLE public.media_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id      UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,   -- path en Supabase Storage
  filename      TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT,
  width         INTEGER,
  height        INTEGER,
  duration_secs NUMERIC,         -- para video
  blurhash      TEXT,            -- para skeleton loading
  caption       TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_favorite   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_albums_contact ON public.albums(contact_id);
CREATE INDEX idx_media_album ON public.media_items(album_id);
