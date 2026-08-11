DELETE FROM public.user_roles
WHERE user_id = 'ff2f1839-5698-4c03-97c7-b0a229857524'
  AND role IN ('owner', 'admin', 'moderator');