import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type AccountBindingRow,
  bindEmailToCurrentUser,
  bindPhoneToCurrentUser,
  bindWechatToCurrentUser,
  type CurrentAuthUser,
  getAccountBindingRows,
  getAuthIdentityMeta,
  getCurrentAuthUser,
  getPasswordManagementState,
  getPrimaryAuthIdentity,
  mergeWithAccount,
  normalizeProfileAvatarImageUri,
  profileAvatarOffsetRange,
  profileAvatarScaleRange,
  refreshCurrentUserIdentities,
  requestEmailOtp,
  requestSupabase,
  setCurrentUserPassword,
  signOut,
} from "@/features/auth";
import { getSmsSendErrorDetails, sendSmsCode } from "@/features/auth/sms-auth";
import { getWechatAuthCode } from "@/features/auth/wechat";
import { createDiagnosticLogger } from "@/features/diagnostics";
import {
  getProfileGlassSurface,
  getProfileTravelPaperBackground,
} from "@/shared/account/profile-visuals";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { AccountToneColors } from "../account-screen.types";
import type { AccountMergeConfirmState } from "../components/account-merge-dialog";

const accountScreenLogger = createDiagnosticLogger("account-screen");

type StatusTone = "error" | "info" | "success";

function getToneColors(
  theme: ReturnType<typeof useAppTheme>,
  tone: StatusTone,
): AccountToneColors {
  if (tone === "error") {
    return {
      backgroundColor: theme.colors.dangerSoft,
      borderColor: theme.colors.dangerBorder,
      textColor: theme.colors.danger,
    };
  }

  if (tone === "success") {
    return {
      backgroundColor: theme.colors.successSoft,
      borderColor: theme.colors.success,
      textColor: theme.colors.success,
    };
  }

  return {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.border,
    textColor: theme.colors.textMuted,
  };
}

export function useAccountController() {
  const router = useRouter();
  const theme = useAppTheme();

  const [authUser, setAuthUser] = useState<CurrentAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordConfirmValue, setPasswordConfirmValue] = useState("");
  const [isPasswordEditorVisible, setPasswordEditorVisible] = useState(false);
  const [mergeConfirm, setMergeConfirm] =
    useState<AccountMergeConfirmState | null>(null);

  const [showSmsBindModal, setShowSmsBindModal] = useState(false);
  const [smsBindPhone, setSmsBindPhone] = useState("");
  const [smsBindCode, setSmsBindCode] = useState("");
  const [isSendingBindSms, setIsSendingBindSms] = useState(false);
  const [smsBindCooldownSeconds, setSmsBindCooldownSeconds] = useState(0);
  const [isVerifyingBindSms, setIsVerifyingBindSms] = useState(false);

  const [showEmailBindModal, setShowEmailBindModal] = useState(false);
  const [emailBindEmail, setEmailBindEmail] = useState("");
  const [emailBindCode, setEmailBindCode] = useState("");
  const [isSendingBindEmail, setIsSendingBindEmail] = useState(false);
  const [emailBindCooldownSeconds, setEmailBindCooldownSeconds] = useState(0);
  const [isVerifyingBindEmail, setIsVerifyingBindEmail] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const DELETE_CONFIRM_TEXT = "我确认要注销";

  const profileBackgroundTone = useMemo(
    () => getProfileTravelPaperBackground(theme),
    [theme],
  );
  const profileGlassTone = useMemo(
    () => getProfileGlassSurface(theme),
    [theme],
  );

  useEffect(() => {
    if (smsBindCooldownSeconds <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setSmsBindCooldownSeconds((currentSeconds) =>
        Math.max(currentSeconds - 1, 0),
      );
    }, 1000);

    return () => clearTimeout(timeout);
  }, [smsBindCooldownSeconds]);

  const loadAccount = useCallback(async () => {
    try {
      const currentUser = await getCurrentAuthUser();
      setAuthUser(currentUser);
      setIsLoading(false);

      if (currentUser?.session.accessToken) {
        await refreshCurrentUserIdentities(currentUser.session);
        setAuthUser(await getCurrentAuthUser());
      }
    } catch (error) {
      accountScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to load account screen.", error] },
        "Legacy warning captured",
      );
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "账号信息读取失败，请稍后再试",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccount();
    }, [loadAccount]),
  );

  const bindingRows = useMemo(
    () => getAccountBindingRows(authUser?.identities ?? []),
    [authUser?.identities],
  );
  const passwordState = useMemo(
    () => getPasswordManagementState(authUser?.identities ?? []),
    [authUser?.identities],
  );
  const primaryIdentity = useMemo(
    () => getPrimaryAuthIdentity(authUser?.identities ?? []),
    [authUser?.identities],
  );
  const primaryIdentityMeta = primaryIdentity
    ? getAuthIdentityMeta(primaryIdentity)
    : null;
  const canManagePassword =
    Boolean(authUser?.session.accessToken) && passwordState.canSetPassword;
  const toneColors = getToneColors(theme, statusTone);
  const avatarImageUri = normalizeProfileAvatarImageUri(
    authUser?.user.avatarUrl,
  );
  const avatarImageTransform = {
    transform: [
      {
        translateX:
          authUser?.user.avatarOffsetX ?? profileAvatarOffsetRange.defaultValue,
      },
      {
        translateY:
          authUser?.user.avatarOffsetY ?? profileAvatarOffsetRange.defaultValue,
      },
      {
        scale:
          authUser?.user.avatarScale ?? profileAvatarScaleRange.defaultValue,
      },
    ],
  };
  const handleBack = () => {
    router.replace("/profile");
  };

  const handleBindingPress = async (row: AccountBindingRow) => {
    setStatusTone("info");

    if (row.isBound) {
      setStatusMessage(
        row.isCurrent
          ? `当前正通过${row.title}登录`
          : `${row.title}已绑定到当前账号，后续会支持更完整的切换与解绑`,
      );
      return;
    }

    if (row.provider === "wechat") {
      try {
        setIsBusy(true);
        setStatusTone("info");
        setStatusMessage("正在获取微信授权...");

        const code = await getWechatAuthorizationCode();

        if (!code) {
          setStatusTone("error");
          setStatusMessage("微信授权已取消");
          return;
        }

        setStatusMessage("正在绑定微信...");

        const result = await bindWechatToCurrentUser(code);

        if ("success" in result && result.success) {
          setStatusTone("success");
          setStatusMessage(
            result.already_bound ? "微信已绑定到当前账号" : "微信绑定成功",
          );
          await loadAccount();
        } else if ("conflict" in result && result.conflict) {
          setStatusTone("error");
          setStatusMessage("该微信已绑定其他账号，微信账号合并功能当前暂停");
        }
      } catch (error) {
        setStatusTone("error");
        setStatusMessage(
          error instanceof Error ? error.message : "微信绑定失败，请稍后再试",
        );
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (row.provider === "phone") {
      setShowSmsBindModal(true);
      return;
    }

    if (row.provider === "email") {
      setShowEmailBindModal(true);
      return;
    }
  };

  const getWechatAuthorizationCode = async (): Promise<string | null> => {
    try {
      return await getWechatAuthCode();
    } catch (error) {
      if (error instanceof Error && error.message.includes("取消")) {
        return null;
      }
      throw error;
    }
  };

  const handleSendBindSmsCode = async () => {
    if (!smsBindPhone || !/^1[3-9]\d{9}$/.test(smsBindPhone)) {
      setStatusTone("error");
      setStatusMessage("请输入正确的手机号");
      return;
    }

    setIsSendingBindSms(true);
    setStatusTone("info");
    setStatusMessage("正在发送验证码...");

    try {
      await sendSmsCode(smsBindPhone);
      setSmsBindCooldownSeconds(60);
      setStatusTone("success");
      setStatusMessage("验证码已发送，请查看手机短信");
    } catch (error) {
      const errorDetails = getSmsSendErrorDetails(error);

      if (errorDetails.cooldownSeconds > 0) {
        setSmsBindCooldownSeconds(errorDetails.cooldownSeconds);
      }

      setStatusTone("error");
      setStatusMessage(errorDetails.message);
    } finally {
      setIsSendingBindSms(false);
    }
  };

  const handleVerifySmsAndBind = async () => {
    if (!smsBindCode) {
      setStatusTone("error");
      setStatusMessage("请输入验证码");
      return;
    }

    setIsVerifyingBindSms(true);
    setStatusTone("info");
    setStatusMessage("正在验证...");

    try {
      const bindResult = await bindPhoneToCurrentUser(
        smsBindPhone,
        smsBindCode,
      );

      if ("success" in bindResult && bindResult.success) {
        setStatusTone("success");
        setStatusMessage(
          bindResult.already_bound
            ? "手机号已绑定到当前账号"
            : "手机号绑定成功",
        );
        setShowSmsBindModal(false);
        setSmsBindPhone("");
        setSmsBindCode("");
        await loadAccount();
      } else if ("conflict" in bindResult && bindResult.conflict) {
        setShowSmsBindModal(false);
        setMergeConfirm({
          conflictUserId: bindResult.conflict_user_id,
          displayName: bindResult.display_name,
          mergeToken: bindResult.merge_token,
          provider: "phone",
        });
      }
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(error instanceof Error ? error.message : "验证失败");
    } finally {
      setIsVerifyingBindSms(false);
    }
  };

  const handleSendBindEmailCode = async () => {
    if (!emailBindEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailBindEmail)) {
      setStatusTone("error");
      setStatusMessage("请输入正确的邮箱地址");
      return;
    }

    setIsSendingBindEmail(true);
    setStatusTone("info");
    setStatusMessage("正在发送验证码...");

    try {
      await requestEmailOtp(emailBindEmail);
      setEmailBindCooldownSeconds(60);
      setStatusTone("success");
      setStatusMessage("验证码已发送，请查看邮箱");
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "发送验证码失败",
      );
    } finally {
      setIsSendingBindEmail(false);
    }
  };

  const handleVerifyEmailAndBind = async () => {
    if (!emailBindCode) {
      setStatusTone("error");
      setStatusMessage("请输入验证码");
      return;
    }

    setIsVerifyingBindEmail(true);
    setStatusTone("info");
    setStatusMessage("正在验证...");

    try {
      const bindResult = await bindEmailToCurrentUser(
        emailBindEmail,
        emailBindCode,
      );

      if ("success" in bindResult && bindResult.success) {
        setStatusTone("success");
        setStatusMessage(
          bindResult.already_bound ? "邮箱已绑定到当前账号" : "邮箱绑定成功",
        );
        setShowEmailBindModal(false);
        setEmailBindEmail("");
        setEmailBindCode("");
        await loadAccount();
      } else if ("conflict" in bindResult && bindResult.conflict) {
        setShowEmailBindModal(false);
        setMergeConfirm({
          conflictUserId: bindResult.conflict_user_id,
          displayName: bindResult.display_name,
          mergeToken: bindResult.merge_token,
          provider: "email",
        });
      }
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(error instanceof Error ? error.message : "验证失败");
    } finally {
      setIsVerifyingBindEmail(false);
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergeConfirm) {
      return;
    }

    try {
      setIsBusy(true);
      setStatusTone("info");
      setStatusMessage("正在合并账号数据...");

      const success = await mergeWithAccount(
        mergeConfirm.conflictUserId,
        mergeConfirm.mergeToken,
      );

      if (success) {
        setStatusTone("success");
        setStatusMessage(
          mergeConfirm.provider === "phone"
            ? "账号合并成功，手机号已绑定到当前账号"
            : "账号合并成功，邮箱已绑定到当前账号",
        );
        setMergeConfirm(null);
        await loadAccount();
      }
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "账号合并失败，请稍后再试",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancelMerge = () => {
    setMergeConfirm(null);
    setStatusMessage("");
  };

  const handlePasswordPress = () => {
    if (!canManagePassword) {
      setStatusTone("info");
      setStatusMessage(passwordState.description);
      return;
    }

    setStatusMessage("");
    setPasswordEditorVisible((currentValue) => !currentValue);
  };

  const handleSavePassword = async () => {
    if (!canManagePassword) {
      setStatusTone("error");
      setStatusMessage("当前账号暂时不能设置密码");
      return;
    }

    if (passwordValue !== passwordConfirmValue) {
      setStatusTone("error");
      setStatusMessage("两次输入的密码不一致");
      return;
    }

    setIsBusy(true);
    setStatusTone("info");

    try {
      const nextAuthUser = await setCurrentUserPassword(passwordValue);

      setAuthUser(nextAuthUser);
      setPasswordValue("");
      setPasswordConfirmValue("");
      setPasswordEditorVisible(false);
      setStatusTone("success");
      setStatusMessage(
        nextAuthUser.identities.some(
          (identity) => identity.provider === "email" && identity.hasPassword,
        )
          ? "密码已更新"
          : "密码已设置",
      );
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "密码设置失败，请稍后再试",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    setIsBusy(true);

    try {
      await signOut();
      setShowSignOutConfirm(false);
      router.replace("/profile");
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "退出登录失败，请稍后再试",
      );
      setIsBusy(false);
      setShowSignOutConfirm(false);
    }
  };

  const handleDeleteAccountPress = () => {
    setDeleteConfirmInput("");
    setDeleteError("");
    setShowDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    if (isDeleting) return;
    setShowDeleteDialog(false);
    setDeleteConfirmInput("");
    setDeleteError("");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmInput.trim() !== DELETE_CONFIRM_TEXT) {
      setDeleteError(`请输入"${DELETE_CONFIRM_TEXT}"`);
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      if (!authUser?.session.accessToken) {
        throw new Error("未登录，请先登录后再操作。");
      }

      await requestSupabase<{ success?: boolean }>({
        accessToken: authUser.session.accessToken,
        body: { confirmText: deleteConfirmInput.trim() },
        path: "delete-account",
        service: "functions",
      });

      await signOut();

      setShowDeleteDialog(false);
      router.replace("/profile");
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "账号注销失败，请稍后再试。",
      );
    } finally {
      setIsDeleting(false);
    }
  };
  const handleCancelPasswordEdit = () => {
    setPasswordEditorVisible(false);
    setPasswordValue("");
    setPasswordConfirmValue("");
  };

  const openSignOutConfirm = () => setShowSignOutConfirm(true);
  const closeSignOutConfirm = () => setShowSignOutConfirm(false);

  const closeSmsBindModal = () => {
    setShowSmsBindModal(false);
    setSmsBindPhone("");
    setSmsBindCode("");
  };

  const closeEmailBindModal = () => {
    setShowEmailBindModal(false);
    setEmailBindEmail("");
    setEmailBindCode("");
  };

  const handleDeleteConfirmInputChange = (text: string) => {
    setDeleteConfirmInput(text);
    setDeleteError("");
  };

  return {
    authUser,
    avatarImageTransform,
    avatarImageUri,
    bindingRows,
    closeEmailBindModal,
    closeSignOutConfirm,
    closeSmsBindModal,
    deleteConfirmInput,
    deleteConfirmText: DELETE_CONFIRM_TEXT,
    deleteError,
    emailBindCode,
    emailBindCooldownSeconds,
    emailBindEmail,
    handleBack,
    handleBindingPress,
    handleCancelMerge,
    handleCancelPasswordEdit,
    handleCloseDeleteDialog,
    handleConfirmMerge,
    handleDeleteAccount,
    handleDeleteAccountPress,
    handleDeleteConfirmInputChange,
    handlePasswordPress,
    handleSavePassword,
    handleSendBindEmailCode,
    handleSendBindSmsCode,
    handleSignOut,
    handleVerifyEmailAndBind,
    handleVerifySmsAndBind,
    isBusy,
    isDeleting,
    isLoading,
    isPasswordEditorVisible,
    isSendingBindEmail,
    isSendingBindSms,
    isVerifyingBindEmail,
    isVerifyingBindSms,
    mergeConfirm,
    openSignOutConfirm,
    passwordConfirmValue,
    passwordState,
    passwordValue,
    primaryIdentityMeta,
    profileBackgroundTone,
    profileGlassTone,
    setEmailBindCode,
    setEmailBindEmail,
    setPasswordConfirmValue,
    setPasswordValue,
    setSmsBindCode,
    setSmsBindPhone,
    showDeleteDialog,
    showEmailBindModal,
    showSignOutConfirm,
    showSmsBindModal,
    smsBindCode,
    smsBindCooldownSeconds,
    smsBindPhone,
    statusMessage,
    toneColors,
  };
}
