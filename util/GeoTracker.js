import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";
import { getGeoInterval, getStoredSession, pingGeo } from "./NuevaApi";

export const GEO_TASK_NAME = "vigicontrol-geo-tracking";
const QUEUE_KEY = "@vigicontrol_geo_queue";
const FLAG_KEY = "@vigicontrol_geo_wanted";
const INTERVAL_KEY = "@vigicontrol_geo_interval_min";
const LAST_SENT_KEY = "@vigicontrol_geo_last_sent";
const DEFAULT_MIN = 15;
/** GPS. Balanced queda en ~100 m; High apunta a unos 10 m. */
const GEO_ACCURACY = Location.Accuracy.High;
const MAX_QUEUE = 250;

let appliedMs = 0;
let fallbackMs = 0;

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
  } catch (err) {
    console.warn("[GeoTracker] intervalo:", err?.message || err);
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
    const data = await pingGeo(latest);
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
      mayShowUserSettingsDialog: true,
    });
    const payload = locToPayload(loc);
    if (payload) await flushAndSend(payload);
  } catch (err) {
    console.warn("[GeoTracker] fallback:", err?.message || err);
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

async function startNativeUpdates(intervalMs, { force = false } = {}) {
  const running = await Location.hasStartedLocationUpdatesAsync(GEO_TASK_NAME);
  if (running && !force && appliedMs === intervalMs) return;
  if (running) await Location.stopLocationUpdatesAsync(GEO_TASK_NAME);
  await Location.startLocationUpdatesAsync(GEO_TASK_NAME, {
    accuracy: GEO_ACCURACY,
    mayShowUserSettingsDialog: true,
    timeInterval: intervalMs,
    distanceInterval: 0,
    deferredUpdatesInterval: intervalMs,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Vigicontrol",
      notificationBody: "Enviando ubicación del servicio",
      notificationColor: "#0F76C4",
    },
  });
  appliedMs = intervalMs;
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
      console.warn("[GeoTracker] native updates:", err?.message || err);
    }
    ensureFallbackTimer(intervalMs);
    ensureConfigTimer();
    void tickForegroundFallback();

    if (!appStateSub) {
      appStateSub = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          void startGeoTracking();
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
