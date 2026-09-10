import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const STORAGE_ENROLL = "@vigicontrol_bio_enroll";

/**
 * Capacidad biométrica del dispositivo.
 * @returns {{ hasHardware: boolean, isEnrolled: boolean, available: boolean, types: number[] }}
 */
export async function getBiometricCapability() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = hasHardware
      ? await LocalAuthentication.isEnrolledAsync()
      : false;
    const types = hasHardware
      ? await LocalAuthentication.supportedAuthenticationTypesAsync()
      : [];
    return {
      hasHardware: Boolean(hasHardware),
      isEnrolled: Boolean(isEnrolled),
      available: Boolean(hasHardware && isEnrolled),
      types: Array.isArray(types) ? types : [],
    };
  } catch (error) {
    console.warn("[BiometricAuth] capability:", error?.message || error);
    return {
      hasHardware: false,
      isEnrolled: false,
      available: false,
      types: [],
    };
  }
}

/** @returns {Promise<{ username: string } | null>} */
export async function getEnrollment() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_ENROLL);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const username = String(parsed?.username || "").trim();
    if (!username) return null;
    return { username };
  } catch {
    return null;
  }
}

/** Guarda el usuario enrolado para login biométrico posterior. */
export async function saveEnrollment({ username } = {}) {
  const user = String(username || "").trim();
  if (!user) {
    throw new Error("username requerido para enrollment");
  }
  const payload = { username: user, enrolledAt: new Date().toISOString() };
  await AsyncStorage.setItem(STORAGE_ENROLL, JSON.stringify(payload));
  return { username: user };
}

export async function clearEnrollment() {
  await AsyncStorage.removeItem(STORAGE_ENROLL);
}

/**
 * Prompt Face ID / huella / biometría del sistema.
 * @returns {Promise<{ success: boolean, error?: string, warning?: string }>}
 */
export async function authenticateBiometric(options = {}) {
  const capability = await getBiometricCapability();
  if (!capability.hasHardware) {
    return { success: false, error: "not_available" };
  }
  if (!capability.isEnrolled) {
    return { success: false, error: "not_enrolled" };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: options.promptMessage || "Confirmá tu identidad",
      cancelLabel: options.cancelLabel || "Cancelar",
      disableDeviceFallback: options.disableDeviceFallback ?? false,
      ...options,
    });
    if (result?.success) {
      return { success: true };
    }
    return {
      success: false,
      error: result?.error || "authentication_failed",
      warning: result?.warning,
    };
  } catch (error) {
    console.warn("[BiometricAuth] authenticate:", error?.message || error);
    return {
      success: false,
      error: "unknown",
      warning: error?.message || String(error),
    };
  }
}

export { STORAGE_ENROLL };
