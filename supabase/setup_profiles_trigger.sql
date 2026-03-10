-- 1. Create a function that automatically inserts a row into public.profiles
-- every time a new user is created in auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, tier)
  values (new.id, 'free');
  return new;
end;
$$;

-- 2. Create the trigger to fire the function above after an insert on auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. (Optional but recommended) Retroactively add any existing auth users to profiles
-- if they aren't already there.
insert into public.profiles (user_id, tier)
select id, 'free' from auth.users
where id not in (select user_id from public.profiles);
