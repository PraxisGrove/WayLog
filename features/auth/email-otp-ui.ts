export function getEmailOtpSendLabel(countdownSeconds: number): string {
  if (countdownSeconds > 0) {
    return `${countdownSeconds}秒后重发`;
  }

  return "发送";
}
