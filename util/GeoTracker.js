import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as Battery from "expo-battery";
import * as Device from "expo-device";
import * as IntentLauncher from "expo-intent-launcher";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Alert, AppState, Platform } from "react-native";
import { getGeoInterval, getStoredSession, pingGeo } from "./NuevaApi";

export const GEO_TASK_NAME = "vigicontrol-geo-tracking";
const QUEUE_KEY = "@vigicontrol_geo_queue";
const FLAG_KEY = "@vigicontrol_geo_wanted";
const INTERVAL_KEY = "@vigicontrol_geo_interval_min";
const LAST_SENT_KEY = "@vigicontrol_geo_last_sent";
const BATTERY_ASKED_KEY = "@vigicontrol_battery_opt_asked_v2";
const ALCATEL_ASKED_KEY = "@vigicontrol_alcatel_battery_guide";
const AWAKE_TAG = "vigicontrol-servicio";
const DEFAULT_MIN = 15;
/** GPS. Balanced queda en ~100 m; High apunta a unos 10 m. */
const GEO_ACCURACY = Location.Accuracy.High;
const MAX_QUEUE = 250;
/**
 * El panel corta la sesión si no llega un ping en el intervalo + 2 min.
 * El servicio nativo despierta seguido; el POST sigue el intervalo del dashboard.
 */
const WAKE_MS = 60 * 1000;

let appliedMs = 0;
let fallbackMs = 0;
let askingBattery = false;
let avisoFondo = false;

function appEnPrimerPlano() {
  return AppState.currentState === "active";
}

function errorDeFondo(err) {
  return /foreground service cannot be started|in the background/i.test(
    String(err?.message || err || ""),
  );
}

function avisarFondo(err, donde) {
  if (!errorDeFondo(err)) {
    console.warn(`[GeoTracker] ${donde}:`, err?.message || err);
    return;
  }
  if (avisoFondo) return;
  avisoFondo = true;
  console.warn(
    "[GeoTracker] la app está en segundo plano; la posición arranca cuando vuelve a primer plano.",
  );
}

function nativeWakeMs(sendIntervalMs) {
  const send = Number(sendIntervalMs);
  if (!Number.isFinite(send) || send <= 0) return WAKE_MS;
  return Math.min(send, WAKE_MS);
}

function minutesToMs(minutes) {
  const n = Math.round(Number(minutes));
  const safe = Number.isFinite(n) && n >= 1 && n <= 240 ? n : DEFAULT_MIN;
  return safe * 60 * 1000;
}

async function readIntervalMs() {
  try {
    const raw = await AsyncStorage.getItem(INTERVAL_KEY);
    return minutesToMs(raw == null || raw === "" ? DEFAULT_MIN : raw);
  } catch {
    return minutesToMs(DEFAULT_MIN);
  }
}

let appStateSub = null;
let fallbackTimer = null;
let configTimer = null;
let starting = false;
const CONFIG_POLL_MS = 60 * 1000;

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
}

function locToPayload(loc) {
  const coords = loc?.coords || loc || {};
  const lat = Number(coords.latitude ?? coords.lat);
  const lng = Number(coords.longitude ?? coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    accuracy: Number.isFinite(Number(coords.accuracy))
      ? Math.round(Number(coords.accuracy))
      : null,
    speed: Number.isFinite(Number(coords.speed)) ? Number(coords.speed) : null,
    heading: Number.isFinite(Number(coords.heading)) ? Number(coords.heading) : null,
    at: loc?.timestamp ? new Date(loc.timestamp).toISOString() : new Date().toISOString(),
  };
}

async function enqueue(payload) {
  const queue = await readQueue();
  queue.push(payload);
  await writeQueue(queue);
}

async function dueToSend() {
  const interval = await readIntervalMs();
  const last = Number((await AsyncStorage.getItem(LAST_SENT_KEY)) || 0);
  return !Number.isFinite(last) || Date.now() - last >= interval;
}

async function refreshIntervalFromServer() {
  const session = await getStoredSession();
  if (!session?.token) return;
  try {
    const data = await getGeoInterval();
    if (data?.geoIntervalMin != null) {
      await applyServerInterval(data.geoIntervalMin);
    }
  } catch (err) {
    console.warn("[GeoTracker] intervalo remoto:", err?.message || err);
  }
}

async function applyServerInterval(minutes) {
  const ms = minutesToMs(minutes);
  const next = String(ms / 60000);
  const prev = await AsyncStorage.getItem(INTERVAL_KEY);
  await AsyncStorage.setItem(INTERVAL_KEY, next);
  if (prev === next && appliedMs === ms) return;
  try {
    await startNativeUpdates(ms, { force: true });
    ensureFallbackTimer(ms);
    avisoFondo = false;
  } catch (err) {
    avisarFondo(err, "intervalo");
  }
}

async function readBattery() {
  try {
    const level = await Battery.getBatteryLevelAsync();
    const state = await Battery.getBatteryStateAsync();
    const pct =
      Number.isFinite(level) && level >= 0 && level <= 1
        ? Math.round(level * 100)
        : null;
    const charging =
      state === Battery.BatteryState.CHARGING ||
      state === Battery.BatteryState.FULL;
    return { battery: pct, charging };
  } catch {
    return { battery: null, charging: null };
  }
}

async function flushAndSend(payload) {
  const session = await getStoredSession();
  if (!session?.token) return;

  if (payload) await enqueue(payload);
  if (!(await dueToSend())) return;

  const pending = await readQueue();
  const latest = pending[pending.length - 1];
  if (!latest) return;

  try {
    const bat = await readBattery();
    const data = await pingGeo({
      ...latest,
      ...(bat.battery != null
        ? { battery: bat.battery, charging: bat.charging }
        : {}),
    });
    await writeQueue([]);
    await AsyncStorage.setItem(LAST_SENT_KEY, String(Date.now()));
    if (data?.geoIntervalMin != null) {
      await applyServerInterval(data.geoIntervalMin);
    }
  } catch {
    // queda en cola para el próximo ciclo
  }
}

export async function handleGeoTask({ data, error }) {
  if (error) {
    console.warn("[geoTask]", error.message || error);
    return;
  }
  const locations = data?.locations || [];
  for (const loc of locations) {
    const payload = locToPayload(loc);
    if (!payload) continue;
    try {
      await flushAndSend(payload);
    } catch (err) {
      await enqueue(payload);
      console.warn("[geoTask] send:", err?.message || err);
    }
  }
}

async function requestPermissions() {
  const currentFg = await Location.getForegroundPermissionsAsync();
  const fg =
    currentFg.status === "granted"
      ? currentFg
      : await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    throw new Error("Hace falta permiso de ubicación para el servicio.");
  }

  const currentBg = await Location.getBackgroundPermissionsAsync();
  if (currentBg.status === "granted") {
    return { foreground: "granted", background: "granted" };
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    console.warn("[GeoTracker] sin permiso de ubicación en segundo plano");
  }
  return { foreground: fg.status, background: bg.status };
}

function stopFallbackTimer() {
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
  fallbackMs = 0;
}

function stopConfigTimer() {
  if (configTimer) {
    clearInterval(configTimer);
    configTimer = null;
  }
}

function ensureConfigTimer() {
  if (configTimer) return;
  configTimer = setInterval(() => {
    void refreshIntervalFromServer();
  }, CONFIG_POLL_MS);
}

async function tickForegroundFallback() {
  try {
    const wanted = await AsyncStorage.getItem(FLAG_KEY);
    if (wanted !== "1") return;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: GEO_ACCURACY,
      mayShowUserSettingsDialog: appEnPrimerPlano(),
    });
    const payload = locToPayload(loc);
    if (payload) await flushAndSend(payload);
  } catch (err) {
    try {
      const last = await Location.getLastKnownPositionAsync();
      const payload = locToPayload(last);
      if (payload) await flushAndSend(payload);
      else console.warn("[GeoTracker] fallback:", err?.message || err);
    } catch (lastErr) {
      console.warn("[GeoTracker] fallback:", err?.message || err, lastErr?.message || lastErr);
    }
  }
}

function ensureFallbackTimer(intervalMs) {
  if (fallbackTimer && fallbackMs === intervalMs) return;
  stopFallbackTimer();
  fallbackMs = intervalMs;
  fallbackTimer = setInterval(() => {
    void tickForegroundFallback();
  }, intervalMs);
}

function esAlcatel() {
  const blob = [Device.brand, Device.manufacturer, Device.modelName, Device.modelId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /alcatel|tct|tcl|5033/.test(blob);
}

function abrirAjuste(action) {
  void IntentLauncher.startActivityAsync(action, {
    data: `package:${Application.applicationId}`,
  }).catch((err) => {
    console.warn("[GeoTracker] ajustes:", err?.message || err);
  });
}

async function stayAwake() {
  try {
    await activateKeepAwakeAsync(AWAKE_TAG);
  } catch (err) {
    console.warn("[GeoTracker] pantalla:", err?.message || err);
  }
  if (Platform.OS !== "android" || askingBattery) return;
  const askedKey = esAlcatel() ? ALCATEL_ASKED_KEY : BATTERY_ASKED_KEY;
  try {
    if ((await AsyncStorage.getItem(askedKey)) === "1") return;
  } catch {
    return;
  }
  askingBattery = true;
  const markAsked = () => {
    askingBattery = false;
    void AsyncStorage.setItem(askedKey, "1");
  };
  if (esAlcatel()) {
    Alert.alert(
      "Este Alcatel corta el seguimiento",
      "Al apagar la pantalla, el 5033MP duerme la app y desaparece del mapa. En Ajustes → Batería desactivá el ahorro. Después, en la app, Batería → Sin restricciones. No la cierres desde recientes y dejá la notificación de Vigicontrol.",
      [
        { text: "Ahora no", style: "cancel", onPress: markAsked },
        {
          text: "Sin límite",
          onPress: () => {
            markAsked();
            abrirAjuste(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
          },
        },
        {
          text: "Ajustes",
          onPress: () => {
            markAsked();
            abrirAjuste(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS);
          },
        },
      ],
    );
    return;
  }
  Alert.alert(
    "Seguimiento en segundo plano",
    "Podés salir de la app: el celular sigue en el mapa mientras la notificación de Vigicontrol esté activa. Permití que no tenga límite de batería, si no Android corta la posición al apagar la pantalla.",
    [
      {
        text: "Ahora no",
        style: "cancel",
        onPress: markAsked,
      },
      {
        text: "Permitir",
        onPress: () => {
          markAsked();
          abrirAjuste(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        },
      },
    ],
  );
}

function releaseAwake() {
  void deactivateKeepAwake(AWAKE_TAG).catch(() => {});
}

async function ensureNotificationPermission() {
  if (Platform.OS !== "android") return;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === "granted") return;
    await Notifications.requestPermissionsAsync();
  } catch (err) {
    console.warn("[GeoTracker] notificación:", err?.message || err);
  }
}

async function startNativeUpdates(intervalMs, { force = false } = {}) {
  const wakeMs = nativeWakeMs(intervalMs);
  if (Platform.OS === "android" && !appEnPrimerPlano()) return;
  const running = await Location.hasStartedLocationUpdatesAsync(GEO_TASK_NAME);
  if (running && !force && appliedMs === wakeMs) return;
  if (running) await Location.stopLocationUpdatesAsync(GEO_TASK_NAME);
  try {
    await ensureNotificationPermission();
    await Location.startLocationUpdatesAsync(GEO_TASK_NAME, {
      accuracy: GEO_ACCURACY,
      timeInterval: wakeMs,
      distanceInterval: 0,
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Vigicontrol en servicio",
        notificationBody: "Seguimiento activo aunque la app no esté en pantalla. No cierres esta notificación.",
        notificationColor: "#0F76C4",
        killServiceOnDestroy: false,
      },
    });
  } catch (err) {
    if (errorDeFondo(err)) {
      avisarFondo(err, "intervalo");
      return;
    }
    throw err;
  }
  appliedMs = wakeMs;
  avisoFondo = false;
}

export async function startGeoTracking() {
  const session = await getStoredSession();
  if (!session?.token) return false;
  if (starting) return true;
  starting = true;
  try {
    await AsyncStorage.setItem(FLAG_KEY, "1");
    await requestPermissions();
    await refreshIntervalFromServer();
    const intervalMs = await readIntervalMs();
    try {
      await startNativeUpdates(intervalMs);
    } catch (err) {
      avisarFondo(err, "native updates");
    }
    ensureFallbackTimer(intervalMs);
    ensureConfigTimer();
    void stayAwake();
    void tickForegroundFallback();

    if (!appStateSub) {
      appStateSub = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          void startGeoTracking();
          return;
        }
        if (state === "background") {
          void tickForegroundFallback();
        }
      });
    }
    return true;
  } finally {
    starting = false;
  }
}

export async function stopGeoTracking() {
  await AsyncStorage.setItem(FLAG_KEY, "0");
  appliedMs = 0;
  stopFallbackTimer();
  stopConfigTimer();
  releaseAwake();
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(GEO_TASK_NAME);
    if (running) await Location.stopLocationUpdatesAsync(GEO_TASK_NAME);
  } catch (err) {
    console.warn("[GeoTracker] stop:", err?.message || err);
  }
}

if (!TaskManager.isTaskDefined(GEO_TASK_NAME)) {
  TaskManager.defineTask(GEO_TASK_NAME, handleGeoTask);
}
