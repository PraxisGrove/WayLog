alter table admin.service_provider_configs
  drop constraint if exists service_provider_configs_service_type_check;

alter table admin.service_provider_configs
  add constraint service_provider_configs_service_type_check
  check (service_type in ('agent', 'database', 'llm', 'map', 'poi', 'notification', 'monitoring', 'weather'));
