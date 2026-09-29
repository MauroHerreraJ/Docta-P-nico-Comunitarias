import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Modal,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useAudioPlayer } from "expo-audio";
import { getMiHombreVivoApp, marcarHombreVivoApp } from "../../util/NuevaApi";
import { formatHoraBA } from "../../util/horaBA";

const BEEP = require("../../assets/hombre-vivo-beep.wav");
const SIM_KEY = "@vigicontrol_hv_sim";
const SIM_AVISO = {
  id: "hv_sim_ahora",
  programaId: null,
  nombre: "Simulación",
  at: new Date().toISOString(),
};

function textoGeo(marca) {
  if (!marca) return "";
  if (marca.dentroGeocerca === true) return "Estás dentro de la geocerca del objetivo.";
  if (marca.dentroGeocerca === false) return "Estás fuera de la geocerca del objetivo.";
  return "Este objetivo no tiene geocerca.";
}

export default function HombreVivoAlerta() {
  const player = useAudioPlayer(BEEP);
  const [pendiente, setPendiente] = useState(SIM_AVISO);
  const simActiva = useRef(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState("");
  const notified = useRef("");

  useEffect(() => {
    let cancel = false;
    AsyncStorage.getItem(SIM_KEY).then((hecho) => {
      if (cancel || !hecho) return;
      simActiva.current = false;
      setPendiente((actual) => (actual?.id === SIM_AVISO.id ? null : actual));
    });
    const tick = async () => {
      try {
        const data = await getMiHombreVivoApp();
        if (cancel) return;
        if (data?.pendiente) setPendiente(data.pendiente);
      } catch {
        // si falla la red, la simulación sigue en pantalla
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
    if (!pendiente || resultado) {
      Vibration.cancel();
      try {
        player.pause();
      } catch {
        // el beep puede no estar listo
      }
      return undefined;
    }
    setError("");
    Vibration.vibrate([0, 700, 250, 700, 250, 900], true);
    const sonar = () => {
      try {
        player.seekTo(0);
        player.play();
      } catch {
        // sigue la vibración
      }
    };
    sonar();
    const beep = setInterval(sonar, 1600);
    if (notified.current !== pendiente.id) {
      notified.current = pendiente.id;
      Notifications.scheduleNotificationAsync({
        identifier: pendiente.id,
        content: {
          title: "Hombre vivo",
          body: "Confirmá que estás en el puesto",
          sound: true,
        },
        trigger: null,
      }).catch(() => {});
    }
    return () => {
      clearInterval(beep);
      Vibration.cancel();
    };
  }, [pendiente, resultado, player]);

  const onAceptar = async () => {
    if (!pendiente || sending) return;
    setSending(true);
    setError("");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Activá la ubicación para aceptar.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const res = await marcarHombreVivoApp({
        at: new Date().toISOString(),
        clientId: pendiente.id,
        programaId: pendiente.programaId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      Vibration.cancel();
      if (pendiente.id === SIM_AVISO.id) {
        simActiva.current = false;
        AsyncStorage.setItem(SIM_KEY, "1").catch(() => {});
      }
      setResultado(textoGeo(res?.marca));
    } catch (err) {
      const msg = err?.response?.data?.message;
      setError(
        Array.isArray(msg) ? String(msg[0]) : msg || "No se pudo enviar la ubicación.",
      );
    } finally {
      setSending(false);
    }
  };

  const onCerrar = () => {
    setResultado("");
    setPendiente(null);
  };

  const visible = Boolean(pendiente || resultado);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.fondo}>
        <View style={styles.caja}>
          <Text style={styles.titulo}>Hombre vivo</Text>
          <Text style={styles.hora}>
            {pendiente?.nombre || "Confirmá el puesto"}
            {pendiente?.at ? ` · ${formatHoraBA(pendiente.at)}` : ""}
          </Text>
          {resultado ? (
            <>
              <Text style={styles.resultado}>{resultado}</Text>
              <TouchableOpacity style={styles.boton} onPress={onCerrar}>
                <Text style={styles.botonTexto}>Listo</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.detalle}>
                Aceptá para enviar tu ubicación y compararla con la geocerca de
                este objetivo.
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.boton, sending && styles.botonOff]}
                onPress={onAceptar}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botonTexto}>ACEPTAR</Text>
                )}
              </TouchableOpacity>
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
    padding: 22,
  },
  titulo: { fontSize: 22, fontWeight: "900", color: "#C0392B" },
  hora: { marginTop: 4, fontSize: 14, fontWeight: "700", color: "#1A2332" },
  detalle: { marginTop: 12, fontSize: 14, lineHeight: 20, color: "#475569" },
  resultado: { marginTop: 14, fontSize: 16, fontWeight: "800", color: "#1A2332" },
  error: { marginTop: 10, fontSize: 13, fontWeight: "700", color: "#B91C1C" },
  boton: {
    marginTop: 18,
    backgroundColor: "#C0392B",
    borderRadius: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  botonOff: { backgroundColor: "#94A3B8" },
  botonTexto: { color: "#fff", fontWeight: "900", fontSize: 18, letterSpacing: 0.4 },
});
