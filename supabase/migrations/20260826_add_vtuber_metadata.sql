alter table public.vtubers
  add column if not exists youtube_channel_id text,
  add column if not exists profile_image_url text,
  add column if not exists live_status boolean default false,
  add column if not exists latest_video_title text;

create unique index if not exists vtubers_name_unique on public.vtubers (name);