const logger = require('../utils/logger');

const OTP_PROVIDER = String(process.env.OTP_PROVIDER || 'mock').toLowerCase();
const OTP_MESSAGE_TEMPLATE = process.env.OTP_MESSAGE_TEMPLATE || 'Your FinMan OTP is {{OTP}}. It expires in {{TTL}} minutes. Do not share this code.';
const IS_PRODUCTION = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

const renderMessage = ({ otp, ttlMinutes }) => OTP_MESSAGE_TEMPLATE
  .replace(/\{\{\s*OTP\s*\}\}/g, String(otp))
  .replace(/\{\{\s*TTL\s*\}\}/g, String(ttlMinutes));

const maskMobile = (mobileNumber) => {
  const raw = String(mobileNumber || '');
  if (raw.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
};

const sendViaTwilio = async ({ mobileNumber, message }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio is not configured. Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER.');
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams({
    To: mobileNumber,
    From: fromNumber,
    Body: message,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio send failed (${response.status}): ${text}`);
  }

  const payload = await response.json();
  return {
    provider: 'twilio',
    messageId: payload.sid,
    delivered: true,
  };
};

const sendViaMock = async ({ mobileNumber, message }) => {
  logger.info('OTP generated (mock delivery)', {
    mobileNumber: maskMobile(mobileNumber),
    message,
  });
  return {
    provider: 'mock',
    messageId: null,
    delivered: false,
  };
};

const sendOtp = async ({ mobileNumber, otp, ttlMinutes }) => {
  const message = renderMessage({ otp, ttlMinutes });

  if (IS_PRODUCTION && OTP_PROVIDER === 'mock') {
    throw new Error('Mock OTP provider is disabled in production. Configure OTP_PROVIDER=twilio.');
  }

  if (OTP_PROVIDER === 'twilio') {
    return sendViaTwilio({ mobileNumber, message });
  }

  return sendViaMock({ mobileNumber, message });
};

const shouldExposeDevOtp = () => {
  const explicitlyEnabled = String(process.env.OTP_EXPOSE_IN_RESPONSE || 'false').toLowerCase() === 'true';
  return !IS_PRODUCTION && (OTP_PROVIDER === 'mock' || explicitlyEnabled);
};

const maskToken = (value, keepStart = 3, keepEnd = 2) => {
  const raw = String(value || '');
  if (!raw) return null;
  if (raw.length <= keepStart + keepEnd) return `${raw.slice(0, 1)}***`;
  return `${raw.slice(0, keepStart)}${'*'.repeat(Math.max(3, raw.length - (keepStart + keepEnd)))}${raw.slice(-keepEnd)}`;
};

const getProviderHealth = () => {
  const provider = OTP_PROVIDER;
  const base = {
    provider,
    mode: IS_PRODUCTION ? 'production' : 'non-production',
    exposeDevOtp: shouldExposeDevOtp(),
    messageTemplateConfigured: Boolean(OTP_MESSAGE_TEMPLATE && OTP_MESSAGE_TEMPLATE.trim()),
  };

  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    return {
      ...base,
      ready: Boolean(sid && token && from),
      details: {
        accountSid: maskToken(sid, 4, 2),
        authToken: token ? 'configured' : 'missing',
        fromNumber: from ? maskMobile(from) : null,
      },
    };
  }

  return {
    ...base,
    ready: !IS_PRODUCTION,
    details: {
      note: IS_PRODUCTION
        ? 'Mock provider is not allowed in production. Configure Twilio to send real OTPs.'
        : 'Mock provider active. OTPs are logged locally and can be exposed in non-production if enabled.',
    },
  };
};

module.exports = {
  sendOtp,
  shouldExposeDevOtp,
  getProviderHealth,
};
