import axios from "axios";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as Device from "expo-device";

/**
 * API Vigicontrol (producción Heroku).
 * Para desarrollo local, cambiá USE_LOCAL a true.
 */
const USE_LOCAL = false;
const LAN_IP = "192.168.0.112";
const API_PORT = 4000;
const PROD_URL = "https://doctacontrol-e7803a4382c9.herokuapp.com";

function resolveBaseUrl() {
  if (!USE_LOCAL) return PROD_URL;
  if (Platform.OS === "android") {
    if (!Device.isDevice) return `http://10.0.2.2:${API_PORT}`;
    return `http://${LAN_IP}:${API_PORT}`;
  }
  return `http://localhost:${API_PORT}`;
}

const BASE_URL = resolveBaseUrl();

console.log("[NuevaApi] BASE_URL =", BASE_URL, "isDevice =", Device.isDevice);

const STORAGE_INSTALL_ID = "@vigicontrol_install_id";
/** ID fijo para emulador/simulador (fácil de vincular en el dashboard). */
const SIMULATOR_DEVICE_ID = "simulador";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

function randomId() {
  return `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** ID estable por instalación (fallback si no hay androidId / IDFV). */
export async function getOrCreateInstallId() {
  const existing = await AsyncStorage.getItem(STORAGE_INSTALL_ID);
  if (existing) return existing;
  const id = randomId();
  await AsyncStorage.setItem(STORAGE_INSTALL_ID, id);
  return id;
}

/**
 * Identificador de dispositivo (NO es IMEI).
 * Simulador/emulador → "simulador"
 * Android real → ANDROID_ID | iOS real → IDFV | fallback → install UUID
 */
export async function getDeviceIdentity() {
  const platform = Platform.OS;
  const isSimulator = Device.isDevice === false;

  if (isSimulator) {
    return {
      deviceId: SIMULATOR_DEVICE_ID,
      source: "simulator",
      platform,
      brand: Device.brand || "simulator",
      modelName: Device.modelName || "Simulator",
      osName: Device.osName || platform,
      osVersion: Device.osVersion || null,
      appVersion: Application.nativeApplicationVersion || null,
      buildVersion: Application.nativeBuildVersion || null,
      isSimulator: true,
    };
  }

  let source = "install";
  let deviceId = null;

  try {
    if (platform === "android") {
      const androidId = Application.getAndroidId?.() || Application.androidId;
      if (androidId) {
        deviceId = String(androidId);
        source = "androidId";
      }
    } else if (platform === "ios") {
      const idfv = await Application.getIosIdForVendorAsync();
      if (idfv) {
        deviceId = String(idfv);
        source = "idfv";
      }
    }
  } catch (error) {
    console.warn("[NuevaApi] no se pudo leer id nativo:", error?.message || error);
  }

  if (!deviceId) {
    deviceId = await getOrCreateInstallId();
    source = "install";
  }

  return {
    deviceId,
    source,
    platform,
    brand: Device.brand || null,
    modelName: Device.modelName || null,
    osName: Device.osName || null,
    osVersion: Device.osVersion || null,
    appVersion: Application.nativeApplicationVersion || null,
    buildVersion: Application.nativeBuildVersion || null,
    isSimulator: false,
  };
}

export async function healthCheck() {
  const { data } = await api.get("/api/health");
  return data;
}

/** Registra / actualiza el dispositivo en el servidor. */
export async function registerDevice(extra = {}) {
  const identity = await getDeviceIdentity();
  const payload = {
    ...identity,
    ...extra,
    registeredAt: new Date().toISOString(),
  };

  const { data } = await api.post("/api/dispositivos", payload);
  return data;
}

export async function getDeviceById(deviceId) {
  const { data } = await api.get(
    `/api/dispositivos/device/${encodeURIComponent(deviceId)}`,
  );
  return data;
}

export async function updateDevice(deviceId, body = {}) {
  const { data } = await api.patch(
    `/api/dispositivos/device/${encodeURIComponent(deviceId)}`,
    body,
  );
  return data;
}

/** Lee identidad local y la manda al servidor. */
export async function sendDeviceIdentity(extra = {}) {
  return registerDevice(extra);
}

/** Perfil del vigilador logueado (nombre, foto, empresa, etc.). */
export async function getMyVigiladorProfile() {
  const identity = await getDeviceIdentity();
  const { data } = await api.get("/api/vigiladores/me", {
    headers: {
      "X-Device-Id": identity.deviceId || "",
      "X-Device-Platform": identity.platform || "",
      "X-Device-Brand": identity.brand || "",
      "X-Device-Model": identity.modelName || "",
      "X-Device-Source": identity.source || "",
    },
  });
  return data;
}

/** Asignación activa + asignaciones del servicio (objetivo) de hoy. */
export async function getMisAsignacionesApp() {
  const { data } = await api.get("/api/asignaciones/mias");
  return data;
}

const APP_HEADERS = { "X-Client-Info": "vigicontrol-app" };

/** Despachos (tareas) del vigilador: pendientes / activos / historial del día. */
export async function getMisDespachosApp() {
  const { data } = await api.get("/api/despachos/mios", {
    headers: {
      ...APP_HEADERS,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    params: { _t: Date.now() },
  });
  return data;
}

export async function getDespachoApp(id) {
  const { data } = await api.get(`/api/despachos/${encodeURIComponent(id)}`, {
    headers: APP_HEADERS,
  });
  return data;
}

export async function aceptarDespachoApp(id) {
  const { data } = await api.post(
    `/api/despachos/${encodeURIComponent(id)}/aceptar`,
    {},
    { headers: APP_HEADERS, params: { app: "1" } },
  );
  return data;
}

export async function llegadaDespachoApp(id) {
  const { data } = await api.post(
    `/api/despachos/${encodeURIComponent(id)}/llegada`,
    {},
    { headers: APP_HEADERS, params: { app: "1" } },
  );
  return data;
}

export async function partidaDespachoApp(id) {
  const { data } = await api.post(
    `/api/despachos/${encodeURIComponent(id)}/partida`,
    {},
    { headers: APP_HEADERS, params: { app: "1" } },
  );
  return data;
}

const STORAGE_SESSION = "@vigicontrol_session";

export async function getStoredSession() {
  const raw = await AsyncStorage.getItem(STORAGE_SESSION);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  await AsyncStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
  return session;
}

export async function clearSession() {
  try {
    await api.post(
      "/api/logout",
      {},
      {
        headers: {
          "X-Auth-Mode": "bearer",
          "X-Client-Info": "vigicontrol-app",
        },
      },
    );
  } catch {
    // igual limpiamos local
  }
  await AsyncStorage.removeItem(STORAGE_SESSION);
}

/**
 * Login contra User schema del server.
 * Guarda en AsyncStorage: token + datos públicos del usuario + deviceId.
 */
export async function loginWithUser({ username, password, registerDeviceOnLogin = true } = {}) {
  const login = String(username || "").trim();
  const pass = String(password || "");
  if (!login || !pass) {
    throw new Error("Usuario y clave son requeridos");
  }

  let device = null;
  if (registerDeviceOnLogin) {
    try {
      device = await sendDeviceIdentity({ licenseCode: login });
    } catch (error) {
      console.warn(
        "[NuevaApi] registro de dispositivo falló (se continúa con login):",
        error?.message || error,
      );
    }
  }

  const identity = device || (await getDeviceIdentity());

  const { data } = await api.post(
    "/api/login",
    {
      login,
      username: login,
      password: pass,
      deviceId: identity.deviceId,
      app: "vigicontrol",
      platform: identity.platform,
      brand: identity.brand,
      modelName: identity.modelName,
      source: identity.source,
      osName: identity.osName,
      osVersion: identity.osVersion,
      appVersion: identity.appVersion,
    },
    {
      headers: {
        "X-Auth-Mode": "bearer",
        "X-Client-Info": "vigicontrol-app",
      },
    },
  );

  const token = data?.token;
  if (!token) {
    throw new Error(
      "El servidor no devolvió token. Revisá X-Auth-Mode: bearer.",
    );
  }

  const user = {
    id: data.id,
    username: data.username,
    email: data.email,
    role: data.role,
    nombre: data.nombre || "",
    apellido: data.apellido || "",
    documento: data.documento || "",
    organizacion: data.organizacion || "",
    drivecompartido: data.drivecompartido || "",
    dia: data.dia || null,
    hora: data.hora || null,
    onboardingDone: Boolean(data.onboardingDone),
  };

  const session = {
    token,
    user,
    deviceId: identity.deviceId,
    device: device || identity,
    loggedAt: new Date().toISOString(),
  };

  await saveSession(session);
  return session;
}

/** Confirmaciones de hombre vivo del turno. */
export async function getMiHombreVivoApp() {
  const { data } = await api.get("/api/hombre-vivo/mias", {
    headers: APP_HEADERS,
    params: { _t: Date.now() },
  });
  return data;
}

export async function marcarHombreVivoApp({
  at,
  clientId,
  programaId,
  lat,
  lng,
  accuracy,
} = {}) {
  const { data } = await api.post(
    "/api/hombre-vivo/mias",
    { at, clientId, programaId, lat, lng, accuracy },
    { headers: APP_HEADERS },
  );
  return data;
}

/** Libro de novedades del turno del vigilador. */
export async function getMisNovedadesApp() {
  const { data } = await api.get("/api/novedades/mias", {
    headers: APP_HEADERS,
    params: { _t: Date.now() },
  });
  return data;
}

export async function getMisAccesosApp() {
  const { data } = await api.get("/api/accesos/mias", {
    headers: APP_HEADERS,
    params: { _t: Date.now() },
  });
  return data;
}

export async function crearAccesoApp({
  dni,
  nombre,
  apellido,
  vehiculo,
  patente,
  motivo,
  clientId,
} = {}) {
  const { data } = await api.post(
    "/api/accesos/mias",
    { dni, nombre, apellido, vehiculo, patente, motivo, clientId },
    { headers: APP_HEADERS },
  );
  return data;
}

export async function crearNovedadApp({ texto, at, clientId } = {}) {
  const { data } = await api.post(
    "/api/novedades/mias",
    { texto, at, clientId },
    { headers: APP_HEADERS },
  );
  return data;
}

/** Rondas del turno del vigilador, con puntos y marcas. */
export async function getMisRondasApp() {
  const { data } = await api.get("/api/rondas/mias", {
    headers: APP_HEADERS,
    params: { _t: Date.now() },
  });
  return data;
}

export async function iniciarRondaApp(rondaId) {
  const { data } = await api.post(
    `/api/rondas/mias/${encodeURIComponent(rondaId)}/iniciar`,
    {},
    { headers: APP_HEADERS },
  );
  return data;
}

export async function marcarPuntoRondaApp({
  rondaId,
  puntoId,
  lat,
  lng,
  accuracy,
  at,
  clientId,
} = {}) {
  const { data } = await api.post(
    `/api/rondas/mias/${encodeURIComponent(rondaId)}/marcar`,
    { puntoId, lat, lng, accuracy, at, clientId },
    { headers: APP_HEADERS },
  );
  return data;
}

export async function cerrarRondaApp(rondaId) {
  const { data } = await api.post(
    `/api/rondas/mias/${encodeURIComponent(rondaId)}/cerrar`,
    {},
    { headers: APP_HEADERS },
  );
  return data;
}

/** Minutos de keep alive que fijó el dashboard para este celular. */
export async function getGeoInterval() {
  const identity = await getDeviceIdentity();
  const { data } = await api.get("/api/geo/intervalo", {
    headers: {
      "X-Device-Id": identity.deviceId || "",
    },
  });
  return data;
}

/** Ping GPS de la app (primer plano y segundo plano). */
export async function pingGeo(body = {}) {
  const identity = await getDeviceIdentity();
  const { data } = await api.post(
    "/api/geo/ping",
    {
      ...body,
      deviceId: body.deviceId || identity.deviceId,
      source: body.source || "app",
    },
    {
      headers: {
        "X-Client-Info": "vigicontrol-app",
        "X-Device-Id": identity.deviceId || "",
        "X-Device-Platform": identity.platform || "",
        "X-Device-Brand": identity.brand || "",
        "X-Device-Model": identity.modelName || "",
        "X-Device-Source": identity.source || "geo-ping",
      },
    },
  );
  return data;
}

api.interceptors.request.use(async (config) => {
  try {
    const session = await getStoredSession();
    if (session?.token) {
      config.headers = config.headers ?? {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${session.token}`;
      }
    }
  } catch {
    // sin sesión
  }
  return config;
});

export { BASE_URL, SIMULATOR_DEVICE_ID, STORAGE_SESSION, api as nuevaApi };
