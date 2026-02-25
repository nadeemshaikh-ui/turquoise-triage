
-- Step 2: Assign super_admin role to nadeemshaikh@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role
FROM auth.users
WHERE email = 'nadeemshaikh@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Update RLS on user_roles: allow super_admin to manage roles too
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins and super_admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
);
