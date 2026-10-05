import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// 🔹 Servidores disponibles
const DESIT_SERVER = "https://desit-server-staging-a51a84ceec47.herokuapp.com";
const DOCTA4_BASE_URL = "https://docta4-api-5pmryov7ba-uc.a.run.app";

// 🛠 MODO DE SIMULACIÓN PARA PRUEBAS SIN SERVIDOR
const IS_TEST_MODE = false; 

/**
 * Función auxiliar para simular latencia de red
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🔹 Clave de la App (Proporcionada por DOCTA 4)
const X_DOCTA_APP_KEY = "SA7UMkePJLYwZuY34lc2qUaopm7POcXlJLUNyBjq"; 

// 🔹 Manejo de errores de autenticación
let unauthorizedCallback = null;

export const onUnauthorized = (callback) => {
  unauthorizedCallback = callback;
};

// Interceptor de Axios para manejar 401 globalmente
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.log("🔴 Sesión expirada o token inválido (401).");
      
      // Limpiar tokens
      await AsyncStorage.removeItem("@device_token");
      await AsyncStorage.removeItem("@master_token");
      
      // Notificar a la app si hay un callback registrado
      if (unauthorizedCallback) {
        unauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Genera un UUID v4 simple para idempotencia.
 */
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Retorna la URL base dinámicamente según el estado del usuario.
 */
const getBaseUrl = async () => {
  try {
    const masterData = await AsyncStorage.getItem("@master_config");
    if (masterData) {
      const parsed = JSON.parse(masterData);
      if (parsed.apiUrl) return parsed.apiUrl;
      
      // Si ya es un usuario del sistema nuevo (DOCTA 4), usamos su base URL
      return DOCTA4_BASE_URL; 
    }

    const legacyData = await AsyncStorage.getItem("@licencias");
    if (legacyData) {
      return DESIT_SERVER;
    }

    return DOCTA4_BASE_URL; // Por defecto para nuevas instalaciones
  } catch (error) {
    return DESIT_SERVER;
  }
};

/**
 * Endpoints dinámicos
 */
const getEndpoints = async () => {
  const baseUrl = await getBaseUrl();
  const isDocta4 = baseUrl === DOCTA4_BASE_URL;

  if (isDocta4) {
    return {
      onboardingLookup: `${baseUrl}/modulo/onboarding/lookup`,
      onboardingRegister: `${baseUrl}/modulo/onboarding/register`,
      onboardingRecover: `${baseUrl}/modulo/onboarding/recover`,
      register: `${baseUrl}/modulo/dispositivos`,
      status: `${baseUrl}/modulo/dispositivos/yo`,
      closeOthers: `${baseUrl}/modulo/dispositivos/cerrar-otros`,
      fcm: `${baseUrl}/modulo/dispositivos/fcm`,
      panic: `${baseUrl}/modulo/panico-comunitario`,
      location: `${baseUrl}/modulo/eventos/ubicacion`,
      chatSend: `${baseUrl}/modulo/chat/mensajes`,
      chatRead: `${baseUrl}/modulo/chat/mensajes`,
      chatAttachment: `${baseUrl}/modulo/chat/adjuntos`,
    };
  }

  // Endpoints Legacy (Desit Server)
  return {
    user: `${baseUrl}/api/v1/user`,
    token: `${baseUrl}/api/v1/auth/token`,
    event: `${baseUrl}/api/v1/event`,
    panicApp: `${baseUrl}/api/v1/panic-app`,
    notification: `${baseUrl}/api/v1/push-notification/register`,
    auth: `${baseUrl}/api/v1/auth`,
  };
};

const extractDocta4AccessToken = (data) => {
  if (!data || typeof data !== "object") return null;
  if (typeof data.accessToken === "string" && data.accessToken) return data.accessToken;
  if (typeof data.access_token === "string" && data.access_token) return data.access_token;
  if (typeof data.token === "string" && data.token) return data.token;
  if (typeof data.token?.accessToken === "string" && data.token.accessToken) return data.token.accessToken;
  if (typeof data.token?.access_token === "string" && data.token.access_token) return data.token.access_token;
  return null;
};

const pickNonEmpty = (...values) => {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text && text !== "auto" && text !== "undefined" && text !== "null") return text;
  }
  return "";
};

const padNumericId = (value, size = 4) => {
  if (!value) return "";
  if (/^\d+$/.test(value) && value.length <= size) return value.padStart(size, "0");
  return value;
};

/**
 * Arma el mismo shape de licenseCreated que usa Sistema / desit-server,
 * a partir de la respuesta de register Docta 4. No se usa en el flujo legacy.
 */
export const buildDocta4LicenseCreated = ({
  result = {},
  onboardingInfo = {},
  masterConfig = {},
} = {}) => {
  const license = result.license || result.licenseCreated || {};
  const municipality = result.municipality || onboardingInfo.municipality || masterConfig.municipality || {};

  const accountNumber = padNumericId(pickNonEmpty(
    license.accountNumber,
    license.account_number,
    result.account_number,
    result.accountNumber
  ));

  const code = pickNonEmpty(
    license.code,
    license.license_code,
    result.license_code
  );

  const municipalityName = pickNonEmpty(
    municipality.name,
    municipality.nombre
  );

  const targetDeviceId = padNumericId(pickNonEmpty(
    license.deviceId,
    license.device_id,
    result.deviceId,
    result.target_device_id,
    result.targetDeviceId,
    result.nro_equipo,
    result.equipment,
    license.targetDeviceId,
    license.target_device_id,
    license.equipment
  ));

  return {
    status: pickNonEmpty(license.status, result.status) || "accepted",
    code,
    accountNumber,
    municipalityName,
    targetDeviceId,
  };
};

const persistDocta4Credential = async (data, { replaceLegacyLicense = false } = {}) => {
  const accessToken = extractDocta4AccessToken(data);
  if (!accessToken) {
    console.warn("Docta 4 register no devolvió accessToken/token; se conserva la credencial previa.");
    return null;
  }

  await AsyncStorage.setItem("@device_token", accessToken);
  await AsyncStorage.setItem("@master_token", accessToken);

  const deviceId = data.dispositivo_id ?? data.device_id ?? data.deviceId ?? data.id;
  if (deviceId != null) {
    await AsyncStorage.setItem("@device_id", String(deviceId));
  }

  if (replaceLegacyLicense) {
    await AsyncStorage.removeItem("@licencias");
  }

  console.log("Docta 4: credencial reemplazada por el accessToken del register.");
  return accessToken;
};

/**
 * Obtiene el token de autenticación según el servidor
 */
const getAuthToken = async () => {
  const masterConfig = await AsyncStorage.getItem("@master_config");
  if (masterConfig) {
    const deviceToken = await AsyncStorage.getItem("@device_token");
    if (deviceToken) return deviceToken;
  }

  // Si no está en master_config, buscar en las licencias específicas
  const products = ["docta_panico", "docta_comunitarias", "docta_legacy"];
  for (const prod of products) {
    const key = prod === "docta_legacy" || prod === "docta_panico" ? "@licencias" : `@licencias_${prod}`;
    const data = await AsyncStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      const token = parsed.token?.access_token || parsed.token?.accessToken;
      if (token) return token;
    }
  }

  return null;
};

// ==========================================
// 🚀 FUNCIONES DOCTA 4 (SISTEMA NUEVO)
// ==========================================

/**
 * Validar el código de 7 dígitos (Sección 1b.1)
 */
export const lookupOnboardingCode = async (code) => {
  try {
    const api = await getEndpoints();
    const response = await axios.post(api.onboardingLookup, { code }, {
      headers: { "Content-Type": "application/json" }
    });
    return response.data;
  } catch (error) {
    console.error("Error en lookup de onboarding:", error);
    throw error;
  }
};

/**
 * Registrar y crear la licencia (Sección 1b.2)
 */
const finishDocta4Onboarding = async (responseData) => {
  const accessToken = await persistDocta4Credential(responseData, { replaceLegacyLicense: true });

  const currentConfig = await AsyncStorage.getItem("@master_config");
  const parsedConfig = currentConfig ? JSON.parse(currentConfig) : {};
  await AsyncStorage.setItem("@master_config", JSON.stringify({
    ...parsedConfig,
    apiUrl: DOCTA4_BASE_URL,
    product: "docta_comunitarias",
    municipality: responseData?.municipality || parsedConfig.municipality
  }));

  return {
    ...responseData,
    token: accessToken || responseData?.token,
    accessToken: accessToken || responseData?.accessToken,
  };
};

export const registerOnboarding = async (onboardingData) => {
  try {
    const api = await getEndpoints();
    const response = await axios.post(api.onboardingRegister, onboardingData, {
      headers: { "Content-Type": "application/json" }
    });
    return await finishDocta4Onboarding(response.data);
  } catch (error) {
    console.error("Error en registro de onboarding:", error);
    throw error;
  }
};

/**
 * Recupera una licencia existente en otro teléfono (cambio de celular).
 * 404 = no hay coincidencia: la app debe hacer el alta normal.
 */
export const recoverOnboarding = async (recoverData) => {
  const api = await getEndpoints();
  const response = await axios.post(api.onboardingRecover, recoverData, {
    headers: { "Content-Type": "application/json" }
  });
  return await finishDocta4Onboarding(response.data);
};

export const closeOtherDevices = async () => {
  const api = await getEndpoints();
  const token = await getAuthToken();
  const response = await axios.post(api.closeOthers, {}, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
};

/**
 * Registra el dispositivo en DOCTA 4 para obtener un token propio.
 */
export const registerDevice = async (regData) => {
  try {
    const api = await getEndpoints();
    const response = await axios.post(api.register, regData, {
      headers: {
        "X-Docta-App-Key": X_DOCTA_APP_KEY,
        "Content-Type": "application/json",
      },
    });
    
    const accessToken = await persistDocta4Credential(response.data);
    return {
      ...response.data,
      token: accessToken || response.data?.token,
      accessToken: accessToken || response.data?.accessToken,
    };
  } catch (error) {
    console.error("Error registrando dispositivo en DOCTA 4:", error);
    throw error;
  }
};

/**
 * Verifica si el token del dispositivo sigue siendo válido.
 */
export const checkDeviceStatus = async () => {
  try {
    const api = await getEndpoints();
    const token = await getAuthToken();
    const response = await axios.get(api.status, {
      headers: { 
        Authorization: `Bearer ${token}`,
        "X-Docta-App-Key": X_DOCTA_APP_KEY
      }
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log("Token de dispositivo expirado o inválido");
    }
    throw error;
  }
};

/**
 * Envía un pánico al sistema DOCTA 4.
 */
export const sendPanicDocta4 = async (eventData) => {
  try {
    const api = await getEndpoints();
    const token = await getAuthToken();
    
    // Obtener datos del usuario y municipio del almacenamiento local si no vienen en eventData
    let user = eventData.user || {};
    let municipality = eventData.municipality || {};

    if (Object.keys(user).length === 0 || Object.keys(municipality).length === 0) {
      const masterData = await AsyncStorage.getItem("@master_config");
      const activeProd = masterData ? JSON.parse(masterData).product : "docta_panico";
      
      let storageKey = "@licencias";
      if (activeProd && activeProd !== "docta_panico" && activeProd !== "docta_legacy") {
        storageKey = `@licencias_${activeProd}`;
      }
      
      const storedLicencia = await AsyncStorage.getItem(storageKey);
      if (storedLicencia) {
        const parsed = JSON.parse(storedLicencia);
        if (Object.keys(user).length === 0) {
          // Intentar obtener datos del perfil de DOCTA 4 primero
          user = {
            Vecino: parsed.result?.licenseCreated?.Vecino || parsed.profile?.Nombre || "Usuario Docta",
            Telefono: parsed.result?.licenseCreated?.Documento || parsed.profile?.Teléfono || ""
          };
        }
        if (Object.keys(municipality).length === 0) {
          municipality = parsed.panicAppData?.municipality || parsed.municipality || { id: "68ed14bacb9f182f98a06c28", name: "Default" };
        }
      }
    }

    const eventId = eventData.id || generateUUID();

    const payload = {
      event: {
        id: eventId,
        code: eventData.eventCode || eventData.code || "107", 
        timestamp: new Date().toISOString(),
        target_device: eventData.targetDeviceId || null,
        location: eventData.location ? {
          lat: eventData.location.lat,
          lon: eventData.location.lng || eventData.location.lon,
          precision_m: eventData.location.accuracy || eventData.location.precision_m || 10,
          capturado_utc: eventData.location.timestamp || new Date().toISOString(),
          origen: eventData.location.origen || "gps"
        } : null
      },
      user,
      municipality: {
        id: municipality.id || "68ed14bacb9f182f98a06c28",
        name: municipality.name || "Default"
      }
    };

    const response = await axios.post(api.panic, payload, {
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Docta-App-Key": X_DOCTA_APP_KEY
      }
    });
    
    return { ...response.data, event_id: eventId };
  } catch (error) {
    console.error("Error enviando pánico a DOCTA 4:", error);
    throw error;
  }
};

/**
 * Envía la ubicación vinculada a un pánico previo.
 */
export const sendLocationDocta4 = async (eventId, location) => {
  try {
    const api = await getEndpoints();
    const token = await getAuthToken();
    
    const payload = {
      id: eventId,        // Intentar con 'id'
      event_id: eventId,  // Intentar con 'event_id'
      evento_id: eventId, // Intentar con 'evento_id' (por consistencia con dispositivo_id)
      location: {
        lat: location.lat,
        lon: location.lng !== undefined ? location.lng : location.lon,
        precision_m: location.accuracy || location.precision_m || 10,
        capturado_utc: location.timestamp || new Date().toISOString(),
        origen: location.origen || "gps"
      }
    };

    const response = await axios.post(api.location, payload, {
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Docta-App-Key": X_DOCTA_APP_KEY // Agregado por seguridad, igual que en registro
      }
    });
    return response.data;
  } catch (error) {
    console.error("Error enviando ubicación a DOCTA 4:", error);
    throw error;
  }
};

/**
 * Sube un archivo adjunto al chat de DOCTA 4.
 */
export const uploadChatAttachment = async (fileUri, type = "imagen") => {
  try {
    const api = await getEndpoints();
    const token = await getAuthToken();

    const formData = new FormData();
    const fileName = fileUri.split("/").pop();
    const fileType = type === "imagen" ? "image/jpeg" : "audio/mp4";

    formData.append("archivo", {
      uri: Platform.OS === "android" ? fileUri : fileUri.replace("file://", ""),
      name: fileName,
      type: fileType,
    });
    formData.append("tipo", type);
    formData.append("client_attachment_id", generateUUID());

    const response = await axios.post(api.chatAttachment, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
        "X-Docta-App-Key": X_DOCTA_APP_KEY
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error subiendo adjunto:", error);
    throw error;
  }
};

/**
 * Envía un mensaje al chat de DOCTA 4.
 */
export const sendChatMessage = async (msgData) => {
  try {
    const api = await getEndpoints();
    const token = await getAuthToken();
    
    const payload = {
      texto: msgData.texto || null,
      client_message_id: msgData.client_message_id || generateUUID(),
      enviado_utc: new Date().toISOString(),
      adjunto_id: msgData.adjunto_id || null
    };

    const response = await axios.post(api.chatSend, payload, {
      headers: { 
        Authorization: `Bearer ${token}`,
        "X-Docta-App-Key": X_DOCTA_APP_KEY
      }
    });
    return response.data;
  } catch (error) {
    console.error("Error enviando mensaje de chat:", error);
    throw error;
  }
};

/**
 * Lee mensajes del chat de DOCTA 4 desde una secuencia.
 */
export const fetchChatMessages = async (desdeSecuencia = 0) => {
  try {
    const api = await getEndpoints();
    const token = await getAuthToken();
    const response = await axios.get(`${api.chatRead}?desde_secuencia=${desdeSecuencia}`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        "X-Docta-App-Key": X_DOCTA_APP_KEY
      }
    });
    return response.data;
  } catch (error) {
    console.error("Error leyendo mensajes de chat:", error);
    throw error;
  }
};

// 🏛️ FUNCIONES LEGACY (SIMULADAS PARA BYPASS)
// ==========================================

export const activateMasterCode = async (masterCode) => {
  console.log("BYPASS: Activando código maestro simulado");
  return { success: true, product: "docta_panico" };
};

export const getPanicAppByCode = async (code) => {
  console.log("BYPASS: Obteniendo PanicApp simulado");
  return {
    id: "bypass-panic-id",
    code: code,
    municipality: { id: "68ed14bacb9f182f98a06c28", name: "Altos del Suquía" },
    logoUrl: "https://i.imgur.com/aIYhRsN.png"
  };
};

export const validateCredentials = async (data) => {
  console.log("BYPASS: Validando credenciales simuladas");
  return { 
    success: true, 
    result: { 
      licenseCreated: { status: "accepted", code: "BYPASS-123" } 
    } 
  };
};

export const postUserData = async (data) => {
  console.log("BYPASS: Guardando datos de usuario simulados");
  return {
    licenseCreated: {
      status: "accepted",
      code: "BYPASS-123",
      Vecino: "Usuario de Prueba",
      Documento: "12345678"
    }
  };
};

export const postToken = async (data) => {
  console.log("BYPASS: Generando token Legacy simulado");
  return { 
    accessToken: "dummy-token",
    token_type: "Bearer",
    expires_in: 3600
  };
};

export const registerNotificationToken = async (licenseCode, fcmToken) => {
  try {
    if (fcmToken === "dummy-fcm") return { success: true };
    const api = await getEndpoints();
    const token = await getAuthToken();
    const isDocta4 = api.fcm !== undefined;

    if (isDocta4) {
      console.log("🚀 Registrando token FCM en DOCTA 4...");
      const response = await axios.patch(api.fcm, {
        fcm_token: fcmToken
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }
      });
      return response.data;
    } else {
      // Flujo Legacy
      console.log("🚀 Registrando token Push en Servidor Legacy...");
      const response = await axios.post(api.notification, {
        licenseCode,
        fcmToken,
      }, {
        headers: {
          "Content-Type": "application/json",
        },
      });
      return response.data;
    }
  } catch (error) {
    console.error("Error registrando el token en el servidor:", error);
    throw error;
  }
};

export const savePost = async (newPost) => {
  try {
    const baseUrl = await getBaseUrl();
    if (baseUrl === DOCTA4_BASE_URL) {
      // Si estamos en modo DOCTA 4, redirigimos a la función nueva de pánico
      return await sendPanicDocta4(newPost);
    }

    const api = await getEndpoints();
    const token = await getAuthToken();
    const response = await axios.post(api.event, newPost, {
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteLicenseAccount = async (licenseCode) => {
  const api = await getEndpoints();
  const response = await axios.delete(`${api.user}/delete-account`, { data: { licenseCode } });
  return response.data;
};
