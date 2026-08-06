-- BillSnap Schema V2 - Profilazione Utenti, Gruppi Ricevute e Impostazioni Cloud
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('Admin', 'Operatore');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cloud_provider') THEN
        CREATE TYPE cloud_provider AS ENUM ('drive', 'dropbox', 'icloud', 'onedrive');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  email text NOT NULL,
  first_name text,
  last_name text,
  role user_role NOT NULL DEFAULT 'Operatore'
);

CREATE TABLE IF NOT EXISTS public.receipt_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text
);

ALTER TABLE public.receipts 
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.receipt_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cloud_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cloud_file_id text,
  ADD COLUMN IF NOT EXISTS cloud_file_url text;

CREATE TABLE IF NOT EXISTS public.cloud_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  provider cloud_provider NOT NULL,
  credentials jsonb NOT NULL,
  backup_path text NOT NULL DEFAULT '/BillSnap/Receipts',
  is_active boolean NOT NULL DEFAULT false
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_profiles ON profiles;
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_groups ON receipt_groups;
CREATE TRIGGER set_updated_at_groups BEFORE UPDATE ON receipt_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_receipts ON receipts;
CREATE TRIGGER set_updated_at_receipts BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_cloud_settings ON cloud_settings;
CREATE TRIGGER set_updated_at_cloud_settings BEFORE UPDATE ON cloud_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_first_user boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;
  
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    CASE WHEN is_first_user THEN 'Admin'::user_role ELSE 'Operatore'::user_role END
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_receipts_user_group ON receipts(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_receipt_groups_user ON receipt_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_settings_active ON cloud_settings(is_active);

CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Admin'::user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profili leggibili da utenti autenticati" ON profiles;
CREATE POLICY "Profili leggibili da utenti autenticati" ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Profili modificabili da se stessi o da Admin" ON profiles;
CREATE POLICY "Profili modificabili da se stessi o da Admin" ON profiles FOR UPDATE USING (auth.uid() = id OR current_user_is_admin());

DROP POLICY IF EXISTS "Profili eliminabili solo da Admin" ON profiles;
CREATE POLICY "Profili eliminabili solo da Admin" ON profiles FOR DELETE USING (current_user_is_admin());

DROP POLICY IF EXISTS "Gruppi accessibili solo al proprietario" ON receipt_groups;
CREATE POLICY "Gruppi accessibili solo al proprietario" ON receipt_groups FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Cloud settings accessibili solo agli Admin" ON cloud_settings;
CREATE POLICY "Cloud settings accessibili solo agli Admin" ON cloud_settings FOR ALL USING (current_user_is_admin());
