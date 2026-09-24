import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Vibration,
} from "react-native";
import { WebView } from "react-native-webview";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import {
  getMisRondasApp,
  iniciarRondaApp,
  marcarPuntoRondaApp,
  cerrarRondaApp,
} from "../../util/NuevaApi";
import { CERCA_M, distanceMeters, formatMetros, RADIO_M } from "../../util/rondaGeo";
import { enqueueRondaOp, flushRondaQueue, getRondaQueue } from "../../util/rondaQueue";
import { buildRondaMapHtml } from "../../util/rondaMapHtml";

function apiMessage(error, fallback) {
  const msg = error?.response?.data?.message;
  if (Array.isArray(msg)) return String(msg[0] || fallback);
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

function mergeOne(ronda, queue) {
  if (!ronda) return null;
  const marcas = [...(ronda.marcas || [])];
  for (const item of queue) {
    if (item.kind !== "marcar" || String(item.rondaId) !== String(ronda.rondaId)) {
      continue;
    }
    const puntoId = String(item.puntoId);
    if (!marcas.some((marca) => marca.puntoId === puntoId)) {
      marcas.push({ puntoId, at: item.at, pending: true });
    }
  }
  const hechas = (ronda.puntos || []).filter((punto) =>
    marcas.some((marca) => marca.puntoId === String(punto._id)),
  ).length;
  const cierrePendiente = queue.some(
    (item) => item.kind === "cerrar" && String(item.rondaId) === String(ronda.rondaId),
  );
  const inicioPendiente = queue.some(
    (item) => item.kind === "iniciar" && String(item.rondaId) === String(ronda.rondaId),
  );
  let estado = ronda.estado;
  if (ronda.estado !== "cerrada" && cierrePendiente) estado = "cierre_pendiente";
  else if (ronda.estado === "pendiente" && (inicioPendiente || hechas > 0)) estado = "en_curso";
  return { ...ronda, marcas, hechas, estado };
}

const MAP_H = 280;

function RecorridoMap({ puntos, marcas, pos, mostrarVos }) {
  const webRef = useRef(null);
  const html = useMemo(
    () => buildRondaMapHtml(puntos, marcas),
    [puntos, marcas],
  );

  useEffect(() => {
    const js =
      mostrarVos && pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng)
        ? `window.setUser && window.setUser(${Number(pos.lat)}, ${Number(pos.lng)}); true;`
        : "window.hideUser && window.hideUser(); true;";
    webRef.current?.injectJavaScript(js);
  }, [pos, mostrarVos]);

  return (
    <View style={styles.map}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://localhost" }}
        style={styles.web}
        javaScriptEnabled
        setSupportMultipleWindows={false}
        onLoadEnd={() => {
          if (
            mostrarVos &&
            pos &&
            Number.isFinite(pos.lat) &&
            Number.isFinite(pos.lng)
          ) {
            webRef.current?.injectJavaScript(
              `window.setUser && window.setUser(${Number(pos.lat)}, ${Number(pos.lng)}); true;`,
            );
          }
        }}
      />
    </View>
  );
}

export default function RondaRecorrido() {
  const route = useRoute();
  const rondaId = String(route.params?.rondaId || "");
  const [loading, setLoading] = useState(true);
  const [pack, setPack] = useState(null);
  const [ronda, setRonda] = useState(null);
  const [queue, setQueue] = useState([]);
  const [pos, setPos] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await flushRondaQueue().catch(() => {});
      const [payload, pending] = await Promise.all([
        getMisRondasApp(),
        getRondaQueue(),
      ]);
      const found = (payload?.rondas || []).find(
        (item) => String(item.rondaId) === rondaId,
      );
      setPack(payload);
      setRonda(found || null);
      setQueue(pending);
    } catch (error) {
      Alert.alert("Sin conexión", "No se pudo abrir la ronda.");
    } finally {
      setLoading(false);
    }
  }, [rondaId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    let watch = null;
    let alive = true;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!alive) return;
        if (perm.status !== "granted") {
          setGpsError("Sin permiso de ubicación");
          return;
        }
        const first = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (alive) {
          setPos({
            lat: first.coords.latitude,
            lng: first.coords.longitude,
            accuracy: first.coords.accuracy,
          });
        }
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 4,
            timeInterval: 2500,
          },
          (loc) => {
            setPos({
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
            });
          },
        );
        if (!alive) sub.remove();
        else watch = sub;
      } catch (error) {
        if (alive) setGpsError("No se pudo leer el GPS");
      }
    })();
    return () => {
      alive = false;
      watch?.remove();
    };
  }, []);

  const vista = mergeOne(ronda, queue);
  const radio = Number(pack?.radioM) || RADIO_M;
  const cerrada = vista?.estado === "cerrada" || vista?.estado === "cierre_pendiente";

  const puntosConDist = useMemo(() => {
    const puntos = vista?.puntos || [];
    return puntos.map((punto, index) => {
      const dist =
        pos && Number.isFinite(pos.lat)
          ? distanceMeters(pos.lat, pos.lng, punto.lat, punto.lng)
          : null;
      const tramo =
        index === 0
          ? 0
          : distanceMeters(
              puntos[index - 1].lat,
              puntos[index - 1].lng,
              punto.lat,
              punto.lng,
            );
      const marca = (vista?.marcas || []).find((item) => item.puntoId === punto._id);
      return { ...punto, dist, tramo, marca };
    });
  }, [vista, pos]);

  const largoAPie = useMemo(
    () => puntosConDist.reduce((sum, punto) => sum + (punto.tramo || 0), 0),
    [puntosConDist],
  );

  const candidato = useMemo(() => {
    const libres = puntosConDist.filter((punto) => !punto.marca && punto.dist != null);
    libres.sort((a, b) => a.dist - b.dist);
    return libres[0] || null;
  }, [puntosConDist]);

  const puedeMarcar =
    Boolean(candidato) &&
    candidato.dist <= radio &&
    pack?.enCurso &&
    !cerrada &&
    !busy;

  const iniciada = vista?.estado === "en_curso" || vista?.estado === "cerrada" || vista?.estado === "cierre_pendiente";

  const siguiente = useMemo(
    () => puntosConDist.find((punto) => !punto.marca) || null,
    [puntosConDist],
  );
  const cercaRef = useRef("");
  useEffect(() => {
    if (!iniciada || cerrada || !siguiente || siguiente.dist == null) return;
    const id = String(siguiente._id);
    if (siguiente.dist <= 10) {
      if (cercaRef.current !== id) {
        cercaRef.current = id;
        Vibration.vibrate(400);
      }
    } else if (siguiente.dist > 18 && cercaRef.current === id) {
      cercaRef.current = "";
    }
  }, [iniciada, cerrada, siguiente]);

  const onIniciar = async () => {
    if (!pack?.enCurso || busy || iniciada) return;
    setBusy(true);
    try {
      const res = await iniciarRondaApp(rondaId);
      if (res?.ronda) setRonda(res.ronda);
      Vibration.vibrate(180);
      setAviso("Ronda iniciada");
    } catch (error) {
      if (!error?.response) {
        await enqueueRondaOp({
          kind: "iniciar",
          rondaId,
          clientId: `i_${rondaId}`,
        });
        setQueue(await getRondaQueue());
        setAviso("Inicio guardado. Se envía cuando vuelva la red.");
      } else {
        Alert.alert("No se pudo iniciar", apiMessage(error, "Probá de nuevo."));
      }
    } finally {
      setBusy(false);
    }
  };

  const onMarcar = async () => {
    if (!puedeMarcar || !candidato || !pos) return;
    setBusy(true);
    const body = {
      kind: "marcar",
      rondaId,
      puntoId: candidato._id,
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
      at: new Date().toISOString(),
      clientId: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
    try {
      const res = await marcarPuntoRondaApp(body);
      let marcada = res?.ronda || null;
      if (
        marcada &&
        marcada.total > 0 &&
        marcada.hechas >= marcada.total &&
        marcada.estado !== "cerrada"
      ) {
        const cierre = await cerrarRondaApp(rondaId);
        if (cierre?.ronda) marcada = cierre.ronda;
      }
      if (marcada) setRonda(marcada);
      Vibration.vibrate(220);
      setAviso(
        marcada?.estado === "cerrada"
          ? "Ronda completa. Quedó cerrada."
          : `Marcado ${candidato.label || `punto ${candidato.orden}`}`,
      );
    } catch (error) {
      if (!error?.response) {
        await enqueueRondaOp(body);
        const faltan = (vista?.puntos || []).filter((punto) => {
          const id = String(punto._id);
          if (id === String(candidato._id)) return false;
          return !(vista?.marcas || []).some((marca) => marca.puntoId === id);
        });
        if (faltan.length === 0) {
          await enqueueRondaOp({
            kind: "cerrar",
            rondaId,
            clientId: `c_${rondaId}`,
          });
        }
        setQueue(await getRondaQueue());
        Alert.alert(
          "Sin conexión",
          faltan.length === 0
            ? "La ronda quedó completa en el teléfono y se cierra cuando vuelva la red."
            : "La marca quedó en el teléfono y se envía cuando vuelva la red.",
        );
      } else {
        Alert.alert("No se pudo marcar", apiMessage(error, "Probá de nuevo."));
      }
    } finally {
      setBusy(false);
    }
  };

  const onCerrar = async () => {
    if (!vista || vista.hechas < vista.total || cerrada || busy) return;
    setBusy(true);
    try {
      const res = await cerrarRondaApp(rondaId);
      if (res?.ronda) setRonda(res.ronda);
      setQueue(await getRondaQueue());
    } catch (error) {
      if (!error?.response) {
        await enqueueRondaOp({
          kind: "cerrar",
          rondaId,
          clientId: `c_${rondaId}`,
        });
        setQueue(await getRondaQueue());
        Alert.alert(
          "Sin conexión",
          "El cierre quedó en el teléfono y se envía cuando vuelva la red.",
        );
      } else {
        Alert.alert("No se pudo cerrar", apiMessage(error, "Probá de nuevo."));
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading && !vista) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2E86C1" />
      </View>
    );
  }

  if (!vista) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitulo}>Ronda no disponible</Text>
        <Text style={styles.emptySub}>No está en el turno actual.</Text>
      </View>
    );
  }

  const botonMarca = !pack?.enCurso
    ? "El turno no está en curso"
    : gpsError
      ? gpsError
      : !pos
        ? "Buscando ubicación..."
        : !candidato
          ? "Puntos completos"
          : puedeMarcar
            ? `Marcar ${candidato.label || `punto ${candidato.orden}`}`
            : candidato.dist > CERCA_M
            ? "Estás lejos del recorrido"
            : `Acercate · ${formatMetros(candidato.dist)} (máx. ${radio} m)`;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.titulo} numberOfLines={1}>
          {vista.nombre}
        </Text>
        <Text style={styles.sub}>
          {vista.hechas}/{vista.total} puntos
          {largoAPie > 0 ? ` · ${formatMetros(largoAPie)} a pie` : ""}
          {vista.horaInicio ? ` · inicio ${vista.horaInicio}` : ""}
        </Text>
      </View>

      <RecorridoMap
        puntos={vista.puntos}
        marcas={vista.marcas}
        pos={pos}
        mostrarVos={Boolean(candidato ? candidato.dist <= CERCA_M : puntosConDist.some((p) => p.dist != null && p.dist <= CERCA_M))}
      />

      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 8 }}>
        {puntosConDist.map((punto) => (
          <View key={punto._id} style={styles.fila}>
            <View
              style={[
                styles.num,
                punto.marca && styles.numHecho,
                punto.marca?.pending && styles.numPendiente,
              ]}
            >
              <Text style={styles.numTexto}>{punto.orden}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filaTitulo} numberOfLines={1}>
                {punto.label || `Punto ${punto.orden}`}
              </Text>
              <Text style={styles.filaMeta}>
                {punto.marca
                  ? punto.marca.pending
                    ? "Marcado · pendiente de envío"
                    : "Marcado"
                  : punto.tramo > 0
                    ? `${formatMetros(punto.tramo)} a pie desde el anterior${
                        punto.dist != null && punto.dist <= CERCA_M
                          ? ` · a ${formatMetros(punto.dist)} de vos`
                          : ""
                      }`
                    : punto.dist != null && punto.dist <= CERCA_M
                      ? `Inicio · a ${formatMetros(punto.dist)} de vos`
                      : "Inicio del recorrido"}
              </Text>
            </View>
            {punto.marca ? (
              <Ionicons name="checkmark-circle" size={20} color="#16A085" />
            ) : null}
          </View>
        ))}
      </ScrollView>

      {vista.estado === "cerrada" ? (
        <View style={styles.cerrada}>
          <Ionicons name="checkmark-circle" size={18} color="#16A085" />
          <Text style={styles.cerradaTexto}>Ronda cerrada</Text>
        </View>
      ) : vista.estado === "cierre_pendiente" ? (
        <View style={styles.pendienteBox}>
          <Text style={styles.pendienteTexto}>Cierre pendiente de envío</Text>
        </View>
      ) : vista.hechas >= vista.total && vista.total > 0 ? (
        <TouchableOpacity
          style={[styles.btn, styles.btnCerrar, busy && styles.btnOff]}
          onPress={onCerrar}
          disabled={busy}
        >
          <Text style={styles.btnTexto}>
            {busy ? "Guardando..." : "Cerrar ronda"}
          </Text>
        </TouchableOpacity>
      ) : !iniciada ? (
        <TouchableOpacity
          style={[styles.btn, (!pack?.enCurso || busy) && styles.btnOff]}
          onPress={onIniciar}
          disabled={!pack?.enCurso || busy}
        >
          <Text style={styles.btnTexto}>
            {busy ? "Guardando..." : pack?.enCurso ? "Iniciar ronda" : "El turno no está en curso"}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.btn, !puedeMarcar && styles.btnOff]}
          onPress={onMarcar}
          disabled={!puedeMarcar}
        >
          <Text style={styles.btnTexto}>{busy ? "Guardando..." : botonMarca}</Text>
        </TouchableOpacity>
      )}
      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 24,
  },
  header: { marginBottom: 8 },
  titulo: { fontSize: 18, fontWeight: "800", color: "#1A2332" },
  sub: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  map: {
    height: MAP_H,
    borderRadius: 14,
    backgroundColor: "#D7E3EE",
    borderWidth: 1,
    borderColor: "#D5E3EF",
    marginBottom: 10,
    overflow: "hidden",
  },
  web: {
    flex: 1,
    backgroundColor: "#e2e8f0",
  },
  lista: { flex: 1 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F76C4",
    alignItems: "center",
    justifyContent: "center",
  },
  numHecho: { backgroundColor: "#16A085" },
  numPendiente: { backgroundColor: "#D97706" },
  numTexto: { color: "#fff", fontWeight: "800", fontSize: 12 },
  filaTitulo: { fontSize: 14, fontWeight: "700", color: "#1A2332" },
  filaMeta: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  btn: {
    backgroundColor: "#2E86C1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnCerrar: { backgroundColor: "#16A085" },
  btnOff: { backgroundColor: "#94A3B8" },
  btnTexto: { color: "#fff", fontWeight: "800", fontSize: 15 },
  aviso: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: "#16A085",
  },
  cerrada: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E8F8F5",
    borderRadius: 12,
    paddingVertical: 14,
  },
  cerradaTexto: { color: "#0F766E", fontWeight: "800", fontSize: 15 },
  pendienteBox: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  pendienteTexto: { color: "#B45309", fontWeight: "800", fontSize: 14 },
  emptyTitulo: { fontSize: 16, fontWeight: "700", color: "#1A2332" },
  emptySub: { marginTop: 4, fontSize: 13, color: "#6B7280", textAlign: "center" },
});
