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
      register: `${baseUrl}/modulo/dispositivos`,
      status: `${baseUrl}/modulo/dispositivos/yo`,
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

/**
 * Obtiene el token de autenticación según el servidor
 */
const getAuthToken = async () => {
  const masterConfig = await AsyncStorage.getItem("@master_config");
  if (masterConfig) {
    const parsed = JSON.parse(masterConfig);
    // En DOCTA 4, el token de dispositivo se guarda en @master_token o similar
    const deviceToken = await AsyncStorage.getItem("@device_token");
    return deviceToken;
  }

  const legacyData = await AsyncStorage.getItem("@licencias");
  if (legacyData) {
    const parsed = JSON.parse(legacyData);
    return parsed.token?.accessToken;
  }
  return null;
};

// ==========================================
// 🚀 FUNCIONES DOCTA 4 (SISTEMA NUEVO)
// ==========================================

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
    
    // Guardar el token de dispositivo retornado
    if (response.data?.token) {
      await AsyncStorage.setItem("@device_token", response.data.token);
      await AsyncStorage.setItem("@device_id", String(response.data.dispositivo_id));
    }
    
    return response.data;
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
      headers: { Authorization: `Bearer ${token}` }
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
          user = {
            Vecino: parsed.result?.licenseCreated?.Vecino || "Usuario Docta",
            Telefono: parsed.result?.licenseCreated?.Documento || ""
          };
        }
        if (Object.keys(municipality).length === 0) {
          municipality = parsed.panicAppData?.municipality || { id: "68ed14bacb9f182f98a06c28", name: "Default" };
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
        "Content-Type": "application/json"
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
      event_id: eventId,
      location: {
        lat: location.lat,
        lon: location.lng || location.lon,
        precision_m: location.accuracy || location.precision_m || 10,
        capturado_utc: location.timestamp || new Date().toISOString(),
        origen: location.origen || "gps"
      }
    };

    const response = await axios.post(api.location, payload, {
      headers: { Authorization: `Bearer ${token}` }
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
      headers: { Authorization: `Bearer ${token}` }
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
      headers: { Authorization: `Bearer ${token}` }
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
    const response = await axios.post(api.notification, {
      licenseCode,
      fcmToken,
    }, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
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
