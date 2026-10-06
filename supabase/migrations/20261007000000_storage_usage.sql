-- ULPA · Admin storage usage meter
-- Returns total bytes and file/photo counts for the course-photos bucket. Admin only.

create or replace function public.admin_storage_usage()
returns table (bytes bigint, files bigint, photos bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select
      coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint,
      count(*)::bigint,
      (select count(*) from public.course_photos p where p.uploaded)::bigint
    from storage.objects o
    where o.bucket_id = 'course-photos';
end;
$$;

grant execute on function public.admin_storage_usage() to authenticated;
