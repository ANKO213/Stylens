-- 1. Сначала добавим недостающие колонки (username, email) в таблицу profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS email text;

-- 2. Обновим функцию, которая срабатывает при регистрации пользователя
-- Она будет брать username из метаданных (которые мы отправляем из login-form.tsx)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, avatar_url, credits)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'username', -- Берет username из metadata
    new.raw_user_meta_data->>'avatar_url', -- Берет аватарку если есть
    5 -- Стандартное кол-во кредитов
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Убедимся, что триггер привязан (обычно он уже есть, но для надежности)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. ИСПРАВЛЕНИЕ СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ
-- Если у вас есть пользователи с пустыми полями, эта команда заполнит их данными из auth.users
DO $$
BEGIN
  UPDATE public.profiles p
  SET
    email = u.email,
    username = (u.raw_user_meta_data->>'username')
  FROM auth.users u
  WHERE p.id = u.id
    AND (p.username IS NULL OR p.email IS NULL);
END $$;
