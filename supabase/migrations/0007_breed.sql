-- Breeds: a dog can be a Shiba Inu or a Husky. Optional, so existing companions keep the first breed.
alter table public.companions add column if not exists breed text check (breed is null or breed ~ '^[a-z_]{1,20}$');
