type AliyunSmsResult = {
  Code?: string;
  Message?: string;
  RequestId?: string;
  VerifyToken?: string;
};

const WAYLOG_SMS_SIGN_NAME = '速通互联验证码';
const WAYLOG_SMS_TEMPLATE_CODE = '100001';

export class AliyunSmsError extends Error {
  readonly aliyunCode?: string;
  readonly retryAfterSeconds: number;
  readonly statusCode: number;

  constructor(
    message: string,
    options: {
      aliyunCode?: string;
      retryAfterSeconds?: number;
      statusCode?: number;
    } = {},
  ) {
    super(message);
    this.name = 'AliyunSmsError';
    this.aliyunCode = options.aliyunCode;
    this.retryAfterSeconds = options.retryAfterSeconds ?? 0;
    this.statusCode = options.statusCode ?? 400;
  }
}

function isFrequencyLimitError(result: AliyunSmsResult): boolean {
  const errorText = `${result.Code ?? ''} ${result.Message ?? ''}`.toLowerCase();

  return (
    errorText.includes('check frequency failed') ||
    errorText.includes('frequency') ||
    errorText.includes('too many request') ||
    errorText.includes('business_limit_control') ||
    errorText.includes('频繁') ||
    errorText.includes('频率限制')
  );
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/\+/g, '%2B')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const mainlandPhone = digits.startsWith('86') ? digits.slice(2) : digits;

  if (!/^1[3-9]\d{9}$/.test(mainlandPhone)) {
    throw new Error('手机号格式不正确');
  }

  return mainlandPhone;
}

async function requestAliyun(params: Record<string, string>): Promise<AliyunSmsResult> {
  const accessKeyId = getRequiredEnv('ALIYUN_ACCESS_KEY_ID');
  const accessKeySecret = getRequiredEnv('ALIYUN_ACCESS_KEY_SECRET');
  const commonParams: Record<string, string> = {
    Format: 'JSON',
    Version: '2017-05-25',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: formatTimestamp(new Date()),
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    ...params,
  };
  const sortedQueryString = Object.keys(commonParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(commonParams[key])}`)
    .join('&');
  const stringToSign = `GET&${percentEncode('/')}&${percentEncode(sortedQueryString)}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${accessKeySecret}&`),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const finalParams = {
    ...commonParams,
    Signature: signatureBase64,
  };
  const finalQueryString = Object.entries(finalParams)
    .map(([keyName, value]) => `${percentEncode(keyName)}=${percentEncode(value)}`)
    .join('&');
  const response = await fetch(`https://dypnsapi.aliyuncs.com/?${finalQueryString}`);
  const result = (await response.json()) as AliyunSmsResult;

  if (!response.ok || result.Code !== 'OK') {
    if (isFrequencyLimitError(result)) {
      throw new AliyunSmsError('短信发送过于频繁，请等待 60 秒后再试。', {
        aliyunCode: result.Code,
        retryAfterSeconds: 60,
        statusCode: 429,
      });
    }

    throw new AliyunSmsError(result.Message || '阿里云短信请求失败', {
      aliyunCode: result.Code,
    });
  }

  return result;
}

export async function sendAliyunSmsCode(phone: string): Promise<AliyunSmsResult> {
  return requestAliyun({
    Action: 'SendSmsVerifyCode',
    PhoneNumber: normalizePhone(phone),
    SignName: WAYLOG_SMS_SIGN_NAME,
    TemplateCode: WAYLOG_SMS_TEMPLATE_CODE,
    CodeType: '1',
    CodeLength: '4',
    TemplateParam: JSON.stringify({ code: '##code##', min: '5' }),
  });
}

export async function verifyAliyunSmsCode(phone: string, code: string): Promise<void> {
  const normalizedCode = code.trim();

  if (!/^\d{4,6}$/.test(normalizedCode)) {
    throw new Error('验证码格式不正确');
  }

  await requestAliyun({
    Action: 'CheckSmsVerifyCode',
    PhoneNumber: normalizePhone(phone),
    VerifyCode: normalizedCode,
  });
}

export function normalizeMainlandPhone(phone: string): string {
  return `+86${normalizePhone(phone)}`;
}
