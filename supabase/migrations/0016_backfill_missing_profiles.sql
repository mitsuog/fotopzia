-- Backfill for users created before profile trigger or with missing profile rows.
DO $$
DECLARE
  first_missing_user_id UUID;
  has_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE role = 'admin'
  ) INTO has_admin;

  SELECT au.id
  INTO first_missing_user_id
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE p.id IS NULL
  ORDER BY au.created_at
  LIMIT 1;

  INSERT INTO public.profiles (id, full_name, email, role, phone, timezone, is_active)
  SELECT
    au.id,
    COALESCE(NULLIF(BTRIM(au.raw_user_meta_data->>'full_name'), ''), 'Administrador Fotopzia') AS full_name,
    COALESCE(au.email, CONCAT('user-', au.id::text, '@no-email.local')) AS email,
    CASE
      WHEN (au.raw_user_meta_data->>'role') IN ('admin', 'project_manager', 'operator', 'client')
        THEN (au.raw_user_meta_data->>'role')::public.user_role
      WHEN NOT has_admin AND au.id = first_missing_user_id
        THEN 'admin'::public.user_role
      ELSE 'operator'::public.user_role
    END AS role,
    NULL::text AS phone,
    'America/Mexico_City'::text AS timezone,
    TRUE AS is_active
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE p.id IS NULL;
END
$$;

-- Improve default admin display name when it was created with placeholder value.
UPDATE public.profiles
SET full_name = 'Administrador Fotopzia'
WHERE role = 'admin'
  AND full_name IN ('Usuario', 'User');
