-- ============================================================================
-- 重命名 auth_identities 表为 user_identities
--
-- 原因：auth_identities 与 Supabase 内置的 auth.identities 表名太像，
--       容易混淆，故重命名为 user_identities 以明确区分。
--
-- 影响：
-- 1. 表名从 auth_identities 改为 user_identities
-- 2. 所有相关的 RLS 策略、索引、触发器都会自动迁移
-- 3. 需要更新所有引用此表的代码
-- ============================================================================

-- 重命名表
ALTER TABLE IF EXISTS auth_identities RENAME TO user_identities;

-- 更新表注释
COMMENT ON TABLE user_identities IS '用户自定义身份绑定表 - 存储短信手机号、微信等非 Supabase 原生登录映射';

-- 更新列注释（如果有的话）
COMMENT ON COLUMN user_identities.user_id IS '关联的用户 ID（对应 auth.users.id）';
COMMENT ON COLUMN user_identities.provider IS '自定义登录方式提供商（sms_phone, wechat）';
COMMENT ON COLUMN user_identities.provider_uid IS '提供者方的用户标识（邮箱、手机号、openid 等）';
