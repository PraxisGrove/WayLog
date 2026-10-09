declare const process: {
  cwd?: () => string;
  env: Record<string, string | undefined> & {
    EXPO_PUBLIC_AMAP_JS_API_KEY?: string;
    EXPO_PUBLIC_AMAP_JS_API_KEY_BACKUP?: string;
    EXPO_PUBLIC_APP_DOWNLOAD_URL?: string;
    EXPO_PUBLIC_PIXABAY_API_KEY?: string;
    EXPO_PUBLIC_SENTRY_DSN?: string;
    EXPO_PUBLIC_SENTRY_ENVIRONMENT?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPPORT_EMAIL?: string;
    EXPO_PUBLIC_UNSPLASH_ACCESS_KEY?: string;
    EXPO_PUBLIC_WECHAT_APP_ID?: string;
    SENTRY_AUTH_TOKEN?: string;
    SENTRY_DSN?: string;
    SENTRY_ENVIRONMENT?: string;
    SENTRY_ORG?: string;
    SENTRY_PROJECT?: string;
    SENTRY_RELEASE?: string;
    SENTRY_WEBHOOK_SECRET?: string;
  };
};
