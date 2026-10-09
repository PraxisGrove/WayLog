-- Supabase-native providers belong to auth.identities.
-- public.user_identities only stores custom provider mappings.

alter table public.user_identities
drop constraint if exists auth_identities_provider_check;

alter table public.user_identities
drop constraint if exists user_identities_provider_check;

-- Remove redundant copies of Supabase-native identities.
delete from public.user_identities
where provider in ('email', 'apple');

-- Clarify that these phone mappings are maintained by the app's SMS flow,
-- independent of the current SMS vendor.
update public.user_identities
set provider = 'sms_phone',
    updated_at = now()
where provider = 'phone';

alter table public.user_identities
add constraint user_identities_provider_check
check (provider in ('sms_phone', 'wechat'));

comment on table public.user_identities
is 'Custom login identity mappings only. Supabase-native email, phone and Apple identities remain in auth.identities.';

comment on column public.user_identities.provider
is 'Custom provider name: sms_phone or wechat.';
