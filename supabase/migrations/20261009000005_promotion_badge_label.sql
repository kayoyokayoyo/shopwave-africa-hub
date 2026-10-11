-- Add badge_label column to promotions table
alter table public.promotions add column if not exists badge_label text check (badge_label is null or (char_length(trim(badge_label)) > 0 and char_length(badge_label) <= 40));
