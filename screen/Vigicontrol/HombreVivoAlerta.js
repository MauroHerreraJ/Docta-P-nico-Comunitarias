import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as IntentLauncher from "expo-intent-launcher";
import * as Application from "expo-application";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { getMiHombreVivoApp, getStoredSession, marcarHombreVivoApp } from "../../util/NuevaApi";
const BEEP = require("../../assets/hombre-vivo-beep.wav");
const ALARMA_CANAL = "hombre-vivo-alarma";
const PANTALLA_KEY = "@vigicontrol_hv_pantalla";
export const ALARMA_OFF_KEY = "@vigicontrol_hv_alarma_off";

export async function alarmaHombreVivoApagada() {
  const valor = await AsyncStorage.getItem(ALARMA_OFF_KEY).catch(() => "");
  return valor === "1";
}

export async function setAlarmaHombreVivo(activa) {
  await AsyncStorage.setItem(ALARMA_OFF_KEY, activa ? "0" : "1");
  if (!activa) await cortarAlarmasHombreVivo();
}

let alSoltar = null;

export function alSoltarHombreVivo(fn) {
  alSoltar = fn;
}

export async function detenerHombreVivo() {
  await cortarAlarmasHombreVivo();
  Vibration.cancel();
  try {
    alSoltar?.();
  } catch {
    // el componente ya se desmontó
  }
}

export async function cortarAlarmasHombreVivo() {
  const pendientes = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    pendientes
      .filter((item) => String(item.identifier || "").startsWith("hvAlarm_"))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => {})),
  );
  const visibles = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  await Promise.all(
    visibles
      .filter((item) => String(item.request?.identifier || "").startsWith("hvAlarm_"))
      .map((item) => Notifications.dismissNotificationAsync(item.request.identifier).catch(() => {})),
  );
}

async function pedirPantallaCompleta() {
  if (Platform.OS !== "android" || Number(Platform.Version) < 34) return;
  const ya = await AsyncStorage.getItem(PANTALLA_KEY).catch(() => "");
  if (ya) return;
  await AsyncStorage.setItem(PANTALLA_KEY, "1").catch(() => {});
  const paquete = Application.applicationId;
  if (!paquete) return;
  await IntentLauncher.startActivityAsync("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT", {
    data: `package:${paquete}`,
  }).catch(() => {});
}

async function canalAlarma() {
  if (Platform.OS !== "android") return;
  await Notifications.deleteNotificationChannelAsync("hombre-vivo").catch(() => {});
  await Notifications.setNotificationChannelAsync(ALARMA_CANAL, {
    name: "Hombre vivo",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 1000, 400, 1000, 400, 1400],
    enableVibrate: true,
    enableLights: true,
    lightColor: "#FF1744",
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      flags: { enforceAudibility: true },
    },
  });
  pedirPantallaCompleta().catch(() => {});
}

function idAlarma(avisoId) {
  return `hvAlarm_${avisoId}`;
}

const YA_KEY = "@vigicontrol_hv_ya";

async function avisosYaLanzados() {
  const raw = await AsyncStorage.getItem(YA_KEY).catch(() => "");
  try {
    const lista = JSON.parse(raw || "[]");
    return new Set(Array.isArray(lista) ? lista.map(String) : []);
  } catch {
    return new Set();
  }
}

async function marcarAvisoLanzado(avisoId) {
  if (!avisoId) return;
  const ya = await avisosYaLanzados();
  ya.add(String(avisoId));
  const lista = [...ya].slice(-80);
  await AsyncStorage.setItem(YA_KEY, JSON.stringify(lista)).catch(() => {});
}

async function cerrarAvisosEnPantalla() {
  const visibles = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  await Promise.all(
    visibles
      .filter((item) => String(item.request?.identifier || "").startsWith("hvAlarm_"))
      .map((item) => Notifications.dismissNotificationAsync(item.request.identifier).catch(() => {})),
  );
}

async function programarAlarmas(avisos) {
  const session = await getStoredSession();
  if (!session?.token) {
    await cortarAlarmasHombreVivo();
    return;
  }
  if (await alarmaHombreVivoApagada()) {
    await cortarAlarmasHombreVivo();
    return;
  }
  const lista = Array.isArray(avisos) ? avisos : [];
  const ahora = Date.now();
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") {
    const pedido = await Notifications.requestPermissionsAsync();
    if (pedido.status !== "granted") return;
  }
  await canalAlarma();
  const existentes = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const porId = new Map(
    existentes.map((item) => [String(item.identifier || ""), item]),
  );
  const vigentes = new Set();
  const yaLanzo = await avisosYaLanzados();
  for (const aviso of lista) {
    if (!aviso?.id || aviso.estado === "hecho" || aviso.estado === "cumplido") continue;
    if (yaLanzo.has(String(aviso.id))) continue;
    const cuando = new Date(aviso.at).getTime();
    if (!Number.isFinite(cuando) || cuando <= ahora) continue;
    const identifier = idAlarma(aviso.id);
    vigentes.add(identifier);
    const previa = porId.get(identifier);
    const dataPrevia = previa?.content?.data || {};
    const igual =
      previa &&
      String(dataPrevia.programaId || "") === String(aviso.programaId || "") &&
      String(dataPrevia.at || "") === String(aviso.at || "") &&
      String(dataPrevia.nombre || "") === String(aviso.nombre || "Hombre vivo");
    if (igual) continue;
    if (previa) {
      await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
    }
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: "Hombre vivo",
        body: "Confirmá que estás en el puesto",
        sound: true,
        sticky: false,
        data: {
          hv: "1",
          id: aviso.id,
          programaId: aviso.programaId || "",
          nombre: aviso.nombre || "Hombre vivo",
          at: aviso.at,
        },
        color: "#E11D48",
        vibrate: [0, 1000, 400, 1000, 400, 1400],
        priority: Notifications.AndroidNotificationPriority.MAX,
        interruptionLevel: "timeSensitive",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(cuando),
        channelId: ALARMA_CANAL,
      },
    }).catch(() => {});
    await marcarAvisoLanzado(aviso.id);
  }
  await Promise.all(
    [...porId.keys()]
      .filter((identifier) => identifier.startsWith("hvAlarm_") && !vigentes.has(identifier))
      .map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {})),
  );
}

async function cancelarAlarma(avisoId) {
  if (!avisoId) return;
  const pendientes = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    pendientes
      .filter((item) => String(item.identifier || "").includes(avisoId))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier).catch(() => {})),
  );
}
function textoGeo(marca) {
  if (!marca) return "";
  if (marca.dentroGeocerca === true) return "Estás dentro de la geocerca del objetivo.";
  if (marca.dentroGeocerca === false) return "Estás fuera de la geocerca del objetivo.";
  return "Este objetivo no tiene geocerca.";
}

export default function HombreVivoAlerta() {
  const player = useAudioPlayer(BEEP);
  const playerRef = useRef(player);
  playerRef.current = player;
  const [pendiente, setPendiente] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState("");
  const [agotado, setAgotado] = useState(false);
  const agotadoRef = useRef(false);
  agotadoRef.current = agotado;
  const [restante, setRestante] = useState("");
  const notified = useRef("");
  const respondido = useRef("");
  const bloqueado = useRef("");

  useEffect(() => {
    const soltar = () => {
      setPendiente(null);
      setResultado("");
      setAgotado(false);
      setError("");
      Vibration.cancel();
      try {
        playerRef.current.pause();
      } catch {
        // el beep puede no estar listo
      }
    };
    alSoltarHombreVivo(soltar);
    return () => {
      alSoltarHombreVivo(null);
      soltar();
      cortarAlarmasHombreVivo().catch(() => {});
    };
  }, []);

  useEffect(() => {
    alarmaHombreVivoApagada().then((apagada) => {
      if (!apagada) return;
      cortarAlarmasHombreVivo().catch(() => {});
      setPendiente(null);
    });
  }, []);

  useEffect(() => {
    let cancel = false;
    const tick = async () => {
      try {
        const session = await getStoredSession();
        if (!session?.token) {
          await cortarAlarmasHombreVivo();
          setPendiente(null);
          return;
        }
        const data = await getMiHombreVivoApp();
        if (cancel) return;
        if (await alarmaHombreVivoApagada()) {
          await cortarAlarmasHombreVivo();
          setPendiente(null);
          return;
        }
        const avisos = Array.isArray(data?.avisos) ? data.avisos : [];
        programarAlarmas(avisos).catch(() => {});
        const ahoraMs = Date.now();
        const abierto =
          data?.pendiente ||
          avisos.find((aviso) => aviso?.estado === "pendiente") ||
          avisos.find((aviso) => {
            const cuando = new Date(aviso?.at).getTime();
            return (
              aviso?.id &&
              aviso.estado !== "hecho" &&
              Number.isFinite(cuando) &&
              cuando <= ahoraMs &&
              ahoraMs <= cuando + 5 * 60 * 1000
            );
          }) ||
          null;
        if (agotadoRef.current) return;
        if (abierto && (respondido.current === String(abierto.id) || bloqueado.current === String(abierto.id))) {
          await cerrarAvisosEnPantalla();
          return;
        }
        setPendiente(abierto);
        if (abierto) setAgotado(false);
      } catch {
        // si falla la red, se reintenta en el próximo ciclo
      }
    };
    tick();
    const timer = setInterval(tick, 12000);
    return () => {
      cancel = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const abrir = (notification) => {
      const data = notification?.request?.content?.data || {};
      if (String(data.hv || "") !== "1" || !data.id) return;
      if (respondido.current === String(data.id) || bloqueado.current === String(data.id)) {
        cerrarAvisosEnPantalla().catch(() => {});
        return;
      }
      getStoredSession().then((session) => {
        if (!session?.token) {
          cortarAlarmasHombreVivo().catch(() => {});
          return;
        }
      alarmaHombreVivoApagada().then((apagada) => {
        if (apagada) return;
        setPendiente({
          id: String(data.id),
          programaId: data.programaId || null,
          nombre: String(data.nombre || "Hombre vivo"),
          at: data.at || new Date().toISOString(),
        });
        Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
      });
      });
    };
    const recibida = Notifications.addNotificationReceivedListener(abrir);
    const tocada = Notifications.addNotificationResponseReceivedListener((respuesta) => {
      abrir(respuesta?.notification);
    });
    return () => {
      recibida.remove();
      tocada.remove();
    };
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "duckOthers",
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const avisoId = pendiente?.id || "";
    if (!avisoId || resultado || agotado) {
      Vibration.cancel();
      try {
        playerRef.current.pause();
      } catch {
        // el beep puede no estar listo
      }
      return undefined;
    }
    setError("");
    Notifications.getPresentedNotificationsAsync()
      .then((visibles) =>
        Promise.all(
          visibles
            .filter((item) => String(item.request?.identifier || "").startsWith("hvAlarm_"))
            .map((item) => Notifications.dismissNotificationAsync(item.request.identifier).catch(() => {})),
        ),
      )
      .catch(() => {});
    Vibration.vibrate([0, 800, 300, 800, 300, 1000], true);
    const sonar = () => {
      const audio = playerRef.current;
      try {
        audio.loop = true;
        audio.volume = 1;
        audio.play();
      } catch {
        // sigue la vibración
      }
    };
    sonar();
    const beep = setInterval(sonar, 1600);
    notified.current = avisoId;
    return () => {
      clearInterval(beep);
      Vibration.cancel();
      try {
        playerRef.current.pause();
      } catch {
        // ya se cerró el aviso
      }
    };
  }, [pendiente?.id, resultado, agotado]);

  const leerUbicacion = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return pos?.coords || null;
  };

  const enviar = async (aviso, omitio) => {
    if (!aviso?.id || respondido.current === aviso.id) return;
    respondido.current = aviso.id;
    cancelarAlarma(aviso.id).catch(() => {});
    Vibration.cancel();
    try {
      playerRef.current.pause();
    } catch {
      // el beep puede no estar listo
    }
    let coords = null;
    try {
      coords = await leerUbicacion();
    } catch {
      coords = null;
    }
    if (!coords) {
      respondido.current = "";
      if (!omitio) setError("Activá la ubicación para confirmar.");
      else setPendiente(null);
      return;
    }
    try {
      const res = await marcarHombreVivoApp({
        clientId: aviso.id,
        programaId: aviso.programaId,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        omitio,
      });
      if (omitio) {
        setAgotado(true);
        return;
      }
      const hora = res?.hora || "Cumplió hora";
      setResultado(`${hora}. ${textoGeo(res?.marca)}`);
    } catch (err) {
      respondido.current = "";
      if (omitio) {
        setAgotado(true);
        return;
      }
      const msg = err?.response?.data?.message;
      setError(
        Array.isArray(msg) ? String(msg[0]) : msg || "No se pudo enviar la ubicación.",
      );
    }
  };

  const venceEn = (aviso) => {
    const marcado = new Date(aviso?.vence || 0).getTime();
    if (Number.isFinite(marcado) && marcado > 0) return marcado;
    const programado = new Date(aviso?.at || 0).getTime();
    if (!Number.isFinite(programado)) return Date.now();
    return programado + 5 * 60 * 1000;
  };

  useEffect(() => {
    const aviso = pendiente;
    if (!aviso?.id || resultado || agotado) return undefined;
    const vence = venceEn(aviso);
    const pintar = () => {
      const queda = vence - Date.now();
      const segundos = Math.max(0, Math.ceil(queda / 1000));
      const min = String(Math.floor(segundos / 60)).padStart(2, "0");
      const seg = String(segundos % 60).padStart(2, "0");
      setRestante(`${min}:${seg}`);
      if (queda <= 0) {
        setAgotado(true);
        Vibration.cancel();
        try {
          playerRef.current.pause();
        } catch {
          // el beep puede no estar listo
        }
        enviar(aviso, true);
      }
    };
    pintar();
    const timer = setInterval(pintar, 1000);
    return () => clearInterval(timer);
  }, [pendiente?.id, resultado, agotado]);

  const onAceptar = async () => {
    if (!pendiente || sending || respondido.current === pendiente.id) return;
    bloqueado.current = String(pendiente.id);
    await marcarAvisoLanzado(pendiente.id);
    await cerrarAvisosEnPantalla();
    cancelarAlarma(pendiente.id).catch(() => {});
    setSending(true);
    setError("");
    try {
      await enviar(pendiente, false);
    } finally {
      setSending(false);
    }
  };

  const onCerrar = () => {
    setResultado("");
    setAgotado(false);
    setPendiente(null);
  };

  const visible = Boolean(pendiente || resultado);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.fondo}>
        <View style={styles.caja}>
          <Text style={styles.kicker}>Hombre vivo</Text>
          {agotado ? (
            <>
              <Text style={styles.titulo}>Tiempo de respuesta agotado</Text>
              <Text style={styles.detalle}>No se registró respuesta</Text>
              <TouchableOpacity style={styles.botonCerrado} onPress={onCerrar}>
                <Text style={styles.botonCerradoTexto}>Cerrado</Text>
              </TouchableOpacity>
            </>
          ) : resultado ? (
            <>
              <Text style={styles.titulo}>Reportado</Text>
              <Text style={styles.detalle}>{resultado}</Text>
              <TouchableOpacity style={styles.boton} onPress={onCerrar}>
                <Text style={styles.botonTexto}>Cerrar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.titulo}>Control de puesto</Text>
              <Text style={styles.cuenta}>{restante || "05:00"} restantes</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.boton, sending && styles.botonOff]}
                onPress={onAceptar}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botonTexto}>Acá estoy</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.pie}>Se enviará tu ubicación</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    justifyContent: "center",
    padding: 24,
  },
  caja: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
  },
  kicker: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#C0392B",
    textTransform: "uppercase",
  },
  titulo: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: "800",
    color: "#1A2332",
    textAlign: "center",
  },
  cuenta: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: "800",
    color: "#C0392B",
    textAlign: "center",
  },
  detalle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
    textAlign: "center",
  },
  pie: { marginTop: 14, fontSize: 13, color: "#64748B", textAlign: "center" },
  error: { marginTop: 10, fontSize: 13, fontWeight: "700", color: "#B91C1C", textAlign: "center" },
  boton: {
    marginTop: 22,
    alignSelf: "stretch",
    backgroundColor: "#C0392B",
    borderRadius: 14,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  botonOff: { backgroundColor: "#94A3B8" },
  botonTexto: { color: "#fff", fontWeight: "900", fontSize: 18, letterSpacing: 0.6 },
  botonCerrado: {
    marginTop: 22,
    alignSelf: "stretch",
    borderRadius: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
  },
  botonCerradoTexto: { color: "#334155", fontWeight: "900", fontSize: 16, letterSpacing: 0.8 },
});
