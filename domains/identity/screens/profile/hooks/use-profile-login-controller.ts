import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform } from "react-native";

import {
  type CurrentAuthUser,
  getEmailOtpSendLabel,
  getProfileLoginAccountChannel,
  getProfileLoginAccountVisualKind,
  getProfileLoginStatusPresentation,
  type ProfileLoginStatusTone,
  requestEmailOtp,
  signInAsGuest,
  signInWithApple,
  signInWithEmailCode,
  signInWithEmailPassword,
  signInWithPhoneCode,
  signInWithPhonePassword,
  signInWithWechat,
} from "@/features/auth";
import { getAppleCredential } from "@/features/auth/apple";
import { getSmsSendErrorDetails, sendSmsCode } from "@/features/auth/sms-auth";
import { getWechatAuthCode } from "@/features/auth/wechat";

import type { LoginMascotFocus, LoginMethod } from "../types";
import { normalizeCodeInput } from "../utils";

type UseProfileLoginControllerParams = {
  defaultLoginStatusMessage: string;
  isBusy: boolean;
  loginStatusTone: ProfileLoginStatusTone;
  onSmsModalLoginSuccess: (nextAuthUser: CurrentAuthUser) => Promise<void>;
  runAuthAction: (
    action: () => Promise<CurrentAuthUser | undefined>,
    successMessage: string,
  ) => Promise<void>;
  setIsBusy: (isBusy: boolean) => void;
  setLoginStatusTone: (tone: ProfileLoginStatusTone) => void;
  setStatusMessage: (message: string) => void;
  statusMessage: string;
};

export function useProfileLoginController({
  defaultLoginStatusMessage,
  isBusy,
  loginStatusTone,
  onSmsModalLoginSuccess,
  runAuthAction,
  setIsBusy,
  setLoginStatusTone,
  setStatusMessage,
  statusMessage,
}: UseProfileLoginControllerParams) {
  const [loginAccount, setLoginAccount] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("code");
  const [loginMascotFocus, setLoginMascotFocus] =
    useState<LoginMascotFocus>(null);
  const [isRequestingEmailOtp, setIsRequestingEmailOtp] = useState(false);
  const [emailOtpCooldownSeconds, setEmailOtpCooldownSeconds] = useState(0);
  const [inlineLoginNotice, setInlineLoginNotice] = useState<string | null>(
    null,
  );
  const [showSmsLoginModal, setShowSmsLoginModal] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsCooldownSeconds, setSmsCooldownSeconds] = useState(0);
  const [isVerifyingSms, setIsVerifyingSms] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const agreementShakeAnim = useRef(new Animated.Value(0)).current;

  const showStatusMessage = useCallback(
    (message: string) => {
      setStatusMessage(message);
    },
    [setStatusMessage],
  );

  const triggerAgreementShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(agreementShakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(agreementShakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(agreementShakeAnim, {
        toValue: 8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(agreementShakeAnim, {
        toValue: -8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(agreementShakeAnim, {
        toValue: 4,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(agreementShakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [agreementShakeAnim]);

  const checkAgreement = useCallback((): boolean => {
    if (!agreementChecked) {
      setLoginStatusTone("error");
      showStatusMessage("请先阅读并同意用户协议和隐私政策");
      triggerAgreementShake();
      return false;
    }
    return true;
  }, [
    agreementChecked,
    setLoginStatusTone,
    showStatusMessage,
    triggerAgreementShake,
  ]);

  const emailOtpSendLabel = isRequestingEmailOtp
    ? "发送中"
    : getEmailOtpSendLabel(emailOtpCooldownSeconds);
  const loginAccountVisualKind = getProfileLoginAccountVisualKind(loginAccount);
  const loginAccountChannel = getProfileLoginAccountChannel(loginAccount);
  const isPhoneInput = loginAccountChannel === "phone";
  const isEmailInput = loginAccountChannel === "email";
  const loginAccountInputMode:
    | "email"
    | "none"
    | "numeric"
    | "search"
    | "tel"
    | "text"
    | "url"
    | undefined =
    Platform.OS === "web"
      ? "text"
      : loginAccountVisualKind === "phone"
        ? "tel"
        : "email";
  const loginAccountKeyboardType: "default" | "email-address" | "phone-pad" =
    Platform.OS === "web"
      ? "default"
      : loginAccountVisualKind === "phone"
        ? "phone-pad"
        : "email-address";
  const codeSendLabel = isSendingSms
    ? "发送中"
    : isRequestingEmailOtp
      ? "发送中"
      : isPhoneInput
        ? smsCooldownSeconds > 0
          ? `${smsCooldownSeconds}秒后重发`
          : "发送"
        : emailOtpSendLabel;
  const isCodeSendDisabled =
    isBusy ||
    isSendingSms ||
    isRequestingEmailOtp ||
    (isPhoneInput && smsCooldownSeconds > 0) ||
    (isEmailInput && emailOtpCooldownSeconds > 0) ||
    (!isPhoneInput && !isEmailInput);
  const loginMethodHint =
    loginMethod === "code"
      ? "首次使用会自动创建账号"
      : "输入邮箱或手机号 + 密码登录";
  const isLoginMascotCoveringEyes =
    loginMascotFocus === "code" || loginMascotFocus === "password";
  const loginStatusPresentation = getProfileLoginStatusPresentation(
    statusMessage,
    defaultLoginStatusMessage,
    loginStatusTone,
  );
  const showLoginStatusMessage = loginStatusPresentation.visible;
  const loginMethodDisplayText = inlineLoginNotice ?? loginMethodHint;

  const handleLoginMascotBlur = useCallback(
    (field: Exclude<LoginMascotFocus, null>) => {
      setLoginMascotFocus((current) => (current === field ? null : current));
    },
    [],
  );

  useEffect(() => {
    if (!showLoginStatusMessage) {
      setInlineLoginNotice(null);
      return undefined;
    }

    setInlineLoginNotice(statusMessage);
    const timer = setTimeout(() => {
      setInlineLoginNotice(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [showLoginStatusMessage, statusMessage]);

  useEffect(() => {
    if (emailOtpCooldownSeconds <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setEmailOtpCooldownSeconds((currentSeconds) =>
        Math.max(currentSeconds - 1, 0),
      );
    }, 1000);

    return () => clearTimeout(timeout);
  }, [emailOtpCooldownSeconds]);

  useEffect(() => {
    if (smsCooldownSeconds <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setSmsCooldownSeconds((currentSeconds) =>
        Math.max(currentSeconds - 1, 0),
      );
    }, 1000);

    return () => clearTimeout(timeout);
  }, [smsCooldownSeconds]);

  const handleWechatLogin = useCallback(async () => {
    if (!checkAgreement()) return;

    setIsBusy(true);
    setLoginStatusTone("info");
    showStatusMessage("正在拉起微信授权...");

    try {
      const code = await getWechatAuthCode();

      if (!code) {
        setLoginStatusTone("error");
        showStatusMessage("微信授权已取消");
        return;
      }

      showStatusMessage("正在登录...");
      await runAuthAction(async () => {
        const nextAuthUser = await signInWithWechat(code);
        showStatusMessage("微信登录成功，正在同步账号数据...");
        return nextAuthUser;
      }, "微信登录成功");
    } catch (error) {
      setLoginStatusTone("error");
      showStatusMessage(
        error instanceof Error ? error.message : "微信登录失败，请稍后再试",
      );
    } finally {
      setIsBusy(false);
    }
  }, [
    checkAgreement,
    runAuthAction,
    setIsBusy,
    setLoginStatusTone,
    showStatusMessage,
  ]);

  const handleAppleLogin = useCallback(async () => {
    if (!checkAgreement()) return;

    setIsBusy(true);
    setLoginStatusTone("info");
    showStatusMessage("正在拉起 Apple 登录...");

    try {
      const credential = await getAppleCredential();

      if (!credential) {
        setLoginStatusTone("error");
        showStatusMessage("Apple 登录已取消");
        return;
      }

      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(" ") || undefined
        : undefined;

      showStatusMessage("正在登录...");
      await runAuthAction(async () => {
        const nextAuthUser = await signInWithApple(
          credential.identityToken,
          fullName,
        );
        showStatusMessage("Apple 登录成功，正在同步账号数据...");
        return nextAuthUser;
      }, "Apple 登录成功");
    } catch (error) {
      setLoginStatusTone("error");
      showStatusMessage(
        error instanceof Error ? error.message : "Apple 登录失败，请稍后再试",
      );
    } finally {
      setIsBusy(false);
    }
  }, [
    checkAgreement,
    runAuthAction,
    setIsBusy,
    setLoginStatusTone,
    showStatusMessage,
  ]);

  const handleRequestEmailOtp = useCallback(async () => {
    setIsBusy(true);
    setIsRequestingEmailOtp(true);
    setLoginStatusTone("info");

    try {
      await requestEmailOtp(loginAccount);
      setEmailOtpCooldownSeconds(60);
      setLoginStatusTone("success");
      showStatusMessage(
        "验证码已发送，请查看邮箱。如果没看到，请检查垃圾邮件或稍等一会儿。",
      );
    } catch (error) {
      setLoginStatusTone("error");
      showStatusMessage(
        error instanceof Error
          ? error.message
          : "邮箱验证码发送失败，请稍后再试",
      );
    } finally {
      setIsRequestingEmailOtp(false);
      setIsBusy(false);
    }
  }, [loginAccount, setIsBusy, setLoginStatusTone, showStatusMessage]);

  const handleRequestCode = useCallback(async () => {
    const input = loginAccount.trim();

    if (loginAccountChannel === "phone") {
      setIsBusy(true);
      setIsSendingSms(true);
      setLoginStatusTone("info");
      showStatusMessage("正在发送验证码...");

      try {
        await sendSmsCode(input);
        setSmsCooldownSeconds(60);
        setLoginStatusTone("success");
        showStatusMessage("验证码已发送，请查看手机短信");
      } catch (error) {
        const errorDetails = getSmsSendErrorDetails(error);

        if (errorDetails.cooldownSeconds > 0) {
          setSmsCooldownSeconds(errorDetails.cooldownSeconds);
        }

        setLoginStatusTone("error");
        showStatusMessage(errorDetails.message);
      } finally {
        setIsSendingSms(false);
        setIsBusy(false);
      }
    } else if (loginAccountChannel === "email") {
      await handleRequestEmailOtp();
    } else {
      setLoginStatusTone("error");
      showStatusMessage("请输入正确的邮箱或手机号");
    }
  }, [
    handleRequestEmailOtp,
    loginAccount,
    loginAccountChannel,
    setIsBusy,
    setLoginStatusTone,
    showStatusMessage,
  ]);

  const handleSignInWithCode = useCallback(() => {
    if (!checkAgreement()) {
      return;
    }

    const input = loginAccount.trim();

    if (loginAccountChannel === "phone") {
      void runAuthAction(
        () => signInWithPhoneCode(input, loginCode),
        "登录成功",
      );
      return;
    }

    if (loginAccountChannel === "email") {
      void runAuthAction(
        () => signInWithEmailCode(input, loginCode),
        "登录成功",
      );
      return;
    }

    setLoginStatusTone("error");
    showStatusMessage("请输入正确的邮箱或手机号");
  }, [
    checkAgreement,
    loginAccount,
    loginAccountChannel,
    loginCode,
    runAuthAction,
    setLoginStatusTone,
    showStatusMessage,
  ]);

  const handleSignInWithPassword = useCallback(() => {
    if (!checkAgreement()) {
      return;
    }

    const input = loginAccount.trim();

    if (loginAccountChannel === "phone") {
      void runAuthAction(
        () => signInWithPhonePassword(input, loginPassword),
        "密码登录成功",
      );
      return;
    }

    if (loginAccountChannel === "email") {
      void runAuthAction(
        () => signInWithEmailPassword(input, loginPassword),
        "密码登录成功",
      );
      return;
    }

    setLoginStatusTone("error");
    showStatusMessage("请输入正确的邮箱或手机号");
  }, [
    checkAgreement,
    loginAccount,
    loginAccountChannel,
    loginPassword,
    runAuthAction,
    setLoginStatusTone,
    showStatusMessage,
  ]);

  const handleSignInAsGuest = useCallback(() => {
    if (!checkAgreement()) {
      return;
    }

    void runAuthAction(signInAsGuest, "已进入游客模式");
  }, [checkAgreement, runAuthAction]);

  const handleSendSmsCode = useCallback(async () => {
    if (!smsPhone || !/^1[3-9]\d{9}$/.test(smsPhone)) {
      setLoginStatusTone("error");
      showStatusMessage("请输入正确的手机号");
      return;
    }

    setIsSendingSms(true);
    setLoginStatusTone("info");
    showStatusMessage("正在发送验证码...");

    try {
      await sendSmsCode(smsPhone);
      setSmsCooldownSeconds(60);
      setLoginStatusTone("success");
      showStatusMessage("验证码已发送，请查看手机短信");
    } catch (error) {
      const errorDetails = getSmsSendErrorDetails(error);

      if (errorDetails.cooldownSeconds > 0) {
        setSmsCooldownSeconds(errorDetails.cooldownSeconds);
      }

      setLoginStatusTone("error");
      showStatusMessage(errorDetails.message);
    } finally {
      setIsSendingSms(false);
    }
  }, [setLoginStatusTone, showStatusMessage, smsPhone]);

  const handleVerifySmsAndLogin = useCallback(async () => {
    if (!smsCode) {
      setLoginStatusTone("error");
      showStatusMessage("请输入验证码");
      return;
    }

    setIsVerifyingSms(true);
    setLoginStatusTone("info");
    showStatusMessage("正在验证...");

    try {
      const nextAuthUser = await signInWithPhoneCode(smsPhone, smsCode);
      await onSmsModalLoginSuccess(nextAuthUser);
      setLoginStatusTone("success");
      showStatusMessage("登录成功");
      setShowSmsLoginModal(false);
      setSmsPhone("");
      setSmsCode("");
    } catch (error) {
      setLoginStatusTone("error");
      showStatusMessage(error instanceof Error ? error.message : "验证失败");
    } finally {
      setIsVerifyingSms(false);
    }
  }, [
    onSmsModalLoginSuccess,
    setLoginStatusTone,
    showStatusMessage,
    smsCode,
    smsPhone,
  ]);

  const handleCloseSmsLoginModal = useCallback(() => {
    setShowSmsLoginModal(false);
    setSmsPhone("");
    setSmsCode("");
  }, []);

  return {
    loginPanelProps: {
      agreementChecked,
      agreementShakeAnim,
      code: loginCode,
      codeSendDisabled: isCodeSendDisabled,
      codeSendLabel,
      inputMode: loginAccountInputMode,
      isBusy,
      keyboardType: loginAccountKeyboardType,
      loginAccountVisualKind,
      loginMethod,
      loginMethodDisplayText,
      loginMethodNoticeActive: Boolean(inlineLoginNotice),
      onAppleLogin: handleAppleLogin,
      onBlurField: handleLoginMascotBlur,
      onChangeAccount: setLoginAccount,
      onChangeCode: (value: string) => setLoginCode(normalizeCodeInput(value)),
      onChangePassword: setLoginPassword,
      onFocusField: setLoginMascotFocus,
      onGuestLogin: handleSignInAsGuest,
      onRequestCode: handleRequestCode,
      onSelectLoginMethod: setLoginMethod,
      onSignInWithCode: handleSignInWithCode,
      onSignInWithPassword: handleSignInWithPassword,
      onToggleAgreement: () => setAgreementChecked((prev) => !prev),
      onWechatLogin: handleWechatLogin,
      password: loginPassword,
      value: loginAccount,
    },
    isLoginMascotCoveringEyes,
    smsOtpModalProps: {
      code: smsCode,
      cooldownSeconds: smsCooldownSeconds,
      isSending: isSendingSms,
      isVerifying: isVerifyingSms,
      onChangeCode: setSmsCode,
      onChangeTarget: setSmsPhone,
      onClose: handleCloseSmsLoginModal,
      onSendCode: handleSendSmsCode,
      onVerify: handleVerifySmsAndLogin,
      target: smsPhone,
      visible: showSmsLoginModal,
    },
  };
}
