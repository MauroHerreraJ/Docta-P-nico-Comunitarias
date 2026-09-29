/**
 * Extrae el código de onboarding de 7 dígitos desde:
 * - número solo (stickers viejos): "1234567" o "123 456 7"
 * - App Link (stickers nuevos): https://docta-4-sm-front-dev.web.app/q/1234567
 * - Install Referrer de Play: docta_codigo=1234567
 */
export const ONBOARDING_HOST = "docta-4-sm-front-dev.web.app";
export const ONBOARDING_PATH_PREFIX = "/q/";

export function extractOnboardingCode(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(raw.replace(/\+/g, " "));
    return extractFromString(decoded) || extractFromString(raw);
  } catch {
    return extractFromString(raw);
  }
}

function extractFromString(raw) {
  const referrerMatch = raw.match(/docta_codigo[=:](\d{7})/i);
  if (referrerMatch) return referrerMatch[1];

  const pathMatch = raw.match(/\/q\/(\d{7})(?:[/?#]|$)/i);
  if (pathMatch) return pathMatch[1];

  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.length === 7) return digitsOnly;

  return null;
}

export function isOnboardingAppLink(url) {
  if (!url) return false;
  return String(url).includes(`${ONBOARDING_HOST}/q/`);
}
