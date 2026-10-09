import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { IdentityOtpModal } from "../../../components/identity-otp-modal";

import type { useAccountController } from "../hooks/use-account-controller";
import { AccountMergeDialog } from "./account-merge-dialog";
import { DeleteAccountDialog } from "./delete-account-dialog";

type AccountController = ReturnType<typeof useAccountController>;

export function AccountDialogHost({
  controller,
}: {
  controller: AccountController;
}) {
  return (
    <>
      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="退出登录"
        isProcessing={controller.isBusy}
        message="退出后需要重新登录才能同步和管理你的旅行数据。确认要退出当前账号吗？"
        onCancel={controller.closeSignOutConfirm}
        onConfirm={() => {
          void controller.handleSignOut();
        }}
        processingLabel="退出中"
        title="确认退出登录？"
        visible={controller.showSignOutConfirm}
      />

      <AccountMergeDialog
        isBusy={controller.isBusy}
        mergeConfirm={controller.mergeConfirm}
        onCancel={controller.handleCancelMerge}
        onConfirm={controller.handleConfirmMerge}
        tone={controller.profileGlassTone}
      />
      <DeleteAccountDialog
        confirmText={controller.deleteConfirmText}
        error={controller.deleteError}
        inputValue={controller.deleteConfirmInput}
        isDeleting={controller.isDeleting}
        onCancel={controller.handleCloseDeleteDialog}
        onChangeInput={controller.handleDeleteConfirmInputChange}
        onConfirm={controller.handleDeleteAccount}
        visible={controller.showDeleteDialog}
      />
      <IdentityOtpModal
        code={controller.smsBindCode}
        cooldownSeconds={controller.smsBindCooldownSeconds}
        isSending={controller.isSendingBindSms}
        isVerifying={controller.isVerifyingBindSms}
        kind="phone"
        onChangeCode={controller.setSmsBindCode}
        onChangeTarget={controller.setSmsBindPhone}
        onClose={controller.closeSmsBindModal}
        onSendCode={controller.handleSendBindSmsCode}
        onVerify={controller.handleVerifySmsAndBind}
        target={controller.smsBindPhone}
        visible={controller.showSmsBindModal}
      />
      <IdentityOtpModal
        code={controller.emailBindCode}
        cooldownSeconds={controller.emailBindCooldownSeconds}
        isSending={controller.isSendingBindEmail}
        isVerifying={controller.isVerifyingBindEmail}
        kind="email"
        onChangeCode={controller.setEmailBindCode}
        onChangeTarget={controller.setEmailBindEmail}
        onClose={controller.closeEmailBindModal}
        onSendCode={controller.handleSendBindEmailCode}
        onVerify={controller.handleVerifyEmailAndBind}
        target={controller.emailBindEmail}
        visible={controller.showEmailBindModal}
      />
    </>
  );
}
