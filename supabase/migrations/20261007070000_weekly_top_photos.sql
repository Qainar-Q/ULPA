-- ULPA · "Photos of the week" on the home page
-- Ranks photos the caller can see by reactions + comments received in the last 7 days.
-- Read-only function; no table changes.

create or replace function public.weekly_top_photos(p_limit integer default 6)
returns table (photo_id uuid, reactions integer, comments integer)
language sql stable security definer set search_path = '' as $$
  with week as (
    select p.id,
           (select count(*)::integer from public.photo_reactions r
             where r.photo_id = p.id and r.created_at > now() - interval '7 days') as reactions,
           (select count(*)::integer from public.photo_comments c
             where c.photo_id = p.id and c.created_at > now() - interval '7 days') as comments,
           p.created_at
      from public.course_photos p
     where p.uploaded
       and private.can_see_photo(p.group_no, p.uploaded, p.uploaded_by)
  )
  select id, reactions, comments
    from week
   where reactions + comments > 0
   order by reactions desc, comments desc, created_at desc
   limit least(greatest(coalesce(p_limit, 6), 1), 12);
$$;
grant execute on function public.weekly_top_photos(integer) to authenticated;
