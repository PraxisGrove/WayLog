import type { AuthIdentity, AuthProvider } from "./types";

type IdentityIcon = "chat" | "mail-outline" | "person-outline" | "phone-iphone";

export type AccountBindingRow = {
  description: string;
  icon: IdentityIcon;
  isBound: boolean;
  isCurrent: boolean;
  provider: Exclude<AuthProvider, "guest">;
  statusLabel: string;
  title: string;
};

export type PasswordManagementState = {
  actionLabel: string;
  canSetPassword: boolean;
  description: string;
  statusLabel: string;
};

const accountProviderOrder: readonly AuthProvider[] = [
  "email",
  "phone",
  "wechat",
  "guest",
];

export function getPrimaryAuthIdentity(
  identities: readonly AuthIdentity[],
): AuthIdentity | null {
  for (const provider of accountProviderOrder) {
    const match = identities.find((identity) => identity.provider === provider);

    if (match) {
      return match;
    }
  }

  return identities[0] ?? null;
}

export function getAuthIdentityMeta(
  identity: Pick<AuthIdentity, "label" | "provider">,
): {
  description: string;
  icon: IdentityIcon;
  title: string;
} {
  if (identity.provider === "phone") {
    return {
      icon: "phone-iphone",
      title: "手机号",
      description: identity.label,
    };
  }

  if (identity.provider === "email") {
    return {
      icon: "mail-outline",
      title: "邮箱",
      description: identity.label,
    };
  }

  if (identity.provider === "wechat") {
    return {
      icon: "chat",
      title: "微信",
      description: identity.label,
    };
  }

  return {
    icon: "person-outline",
    title: "本地游客",
    description: identity.label,
  };
}

function getUnboundProviderDescription(
  provider: Exclude<AuthProvider, "guest">,
): string {
  if (provider === "email") {
    return "可用于验证码和密码登录";
  }

  if (provider === "phone") {
    return "可用于短信验证码登录";
  }

  return "支持微信授权登录";
}

export function getAccountBindingRows(
  identities: readonly AuthIdentity[],
): AccountBindingRow[] {
  const primaryIdentity = getPrimaryAuthIdentity(identities);

  return (["email", "phone", "wechat"] as const).map((provider) => {
    const identity = identities.find((item) => item.provider === provider);
    const meta = getAuthIdentityMeta(identity ?? { label: "", provider });

    return {
      provider,
      title: meta.title,
      icon: meta.icon,
      isBound: Boolean(identity),
      isCurrent: identity?.id === primaryIdentity?.id,
      description: identity
        ? identity.label
        : getUnboundProviderDescription(provider),
      statusLabel: identity
        ? identity.id === primaryIdentity?.id
          ? "当前登录"
          : "已绑定"
        : "未绑定",
    };
  });
}

export function getPasswordManagementState(
  identities: readonly AuthIdentity[],
): PasswordManagementState {
  const emailIdentity = identities.find(
    (identity) => identity.provider === "email",
  );
  const phoneIdentity = identities.find(
    (identity) => identity.provider === "phone",
  );
  const hasCloudIdentity = emailIdentity || phoneIdentity;

  if (!hasCloudIdentity) {
    return {
      canSetPassword: false,
      actionLabel: "需绑定邮箱或手机号",
      statusLabel: "未开启",
      description: "先绑定邮箱或手机号后，才能设置登录密码",
    };
  }

  const hasPassword = emailIdentity?.hasPassword || phoneIdentity?.hasPassword;

  if (hasPassword) {
    return {
      canSetPassword: true,
      actionLabel: "修改密码",
      statusLabel: "已设置",
      description: "下次可以使用邮箱/手机号和密码登录",
    };
  }

  return {
    canSetPassword: true,
    actionLabel: "设置密码",
    statusLabel: "未设置",
    description: "设置后可以使用邮箱/手机号和密码登录",
  };
}
