-- Run ONLY from the trusted Supabase SQL Editor, after creating the real Auth user.
-- Replace the email literal below. No password or service key belongs in this file.
do $$
declare selected_user uuid;
begin
  select id into selected_user from auth.users
    where lower(email)=lower('REPLACE_WITH_ADMIN_EMAIL') and coalesce(is_anonymous,false)=false;
  if selected_user is null then raise exception 'Create the non-anonymous Auth user first, then replace the email in this template.'; end if;
  insert into public.admin_users(user_id) values(selected_user) on conflict(user_id) do nothing;
end;$$;
