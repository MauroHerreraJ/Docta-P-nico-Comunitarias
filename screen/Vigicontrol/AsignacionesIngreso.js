import { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getMisAsignacionesApp,
  getMisDespachosApp,
  getMyVigiladorProfile,
  getStoredSession,
} from "../../util/NuevaApi";
import { formatHoraBA } from "../../util/horaBA";

function idDe(value) {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || "");
  return String(value);
}

function turnoEnCurso(asig) {
  if (!asig?.inicio || !asig?.fin) return false;
  const ahora = Date.now();
  return new Date(asig.inicio).getTime() <= ahora && new Date(asig.fin).getTime() >= ahora;
}

function perfilVacio(session) {
  const u = session?.user || {};
  const nombre = [u.nombre, u.apellido].filter(Boolean).join(" ").trim();
  return {
    nombre: nombre || u.username || u.email || "Usuario",
    rol: u.role === "vigilador" ? "Vigilador" : String(u.role || "Usuario"),
    legajo: u.documento || "",
    foto: "",
    objetivo: "Sin objetivo asignado",
    turno: "",
    enServicio: false,
  };
}

function TarjetaVigilador({ perfil, onSalir }) {
  const iniciales = String(perfil?.nombre || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
  const confirmarSalir = () => {
    Alert.alert("Salir de servicio", "¿Cerrar sesión y quedar fuera de servicio?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => onSalir && onSalir() },
    ]);
  };
  return (
    <LinearGradient
      colors={["#2A2A7A", "#191952"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.identidad}
    >
      <View style={styles.identidadFila}>
        <View style={styles.avatar}>
          {perfil?.foto ? (
            <Image source={{ uri: perfil.foto }} style={styles.avatarFoto} />
          ) : (
            <Text style={styles.avatarTexto}>{iniciales}</Text>
          )}
        </View>
        <View style={styles.identidadDatos}>
          <Text style={styles.identidadNombre} numberOfLines={1}>
            {perfil?.nombre || "Usuario"}
          </Text>
          <Text style={styles.identidadRol} numberOfLines={1}>
            {perfil?.rol || "Vigilador"}
            {perfil?.legajo ? ` · Legajo ${perfil.legajo}` : ""}
          </Text>
          <Text style={styles.identidadDetalle} numberOfLines={1}>
            {perfil?.objetivo || "Sin objetivo"}
            {perfil?.turno ? ` · ${perfil.turno}` : ""}
          </Text>
        </View>
        <View style={styles.identidadAcciones}>
          <View style={[styles.estadoChip, !perfil?.enServicio && styles.estadoOff]}>
            <View style={[styles.estadoPunto, !perfil?.enServicio && styles.puntoOff]} />
            <Text style={styles.estadoTexto}>{perfil?.enServicio ? "ON" : "OFF"}</Text>
          </View>
          <TouchableOpacity style={styles.btnSalir} onPress={confirmarSalir} activeOpacity={0.85}>
            <Ionicons name="exit-outline" size={14} color="#FFE8E6" />
            <Text style={styles.btnSalirTexto}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

export default function AsignacionesIngreso({ onAceptar, onSalir }) {
  const [loading, setLoading] = useState(true);
  const [tareas, setTareas] = useState([]);
  const [perfil, setPerfil] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [asig, desp, perfilRes, session] = await Promise.all([
        getMisAsignacionesApp(),
        getMisDespachosApp(),
        getMyVigiladorProfile().catch(() => null),
        getStoredSession().catch(() => null),
      ]);
      const activa = turnoEnCurso(asig?.activa) ? asig.activa : null;
      const turnoId = idDe(activa?._id);
      const cuenta = activa?.cuentaId;
      const base = perfilRes?.perfil
        ? { ...perfilVacio(session), ...perfilRes.perfil }
        : perfilVacio(session);
      const nombreObj = String(cuenta?.nombrefantasia || cuenta?.nombre || "").trim();
      if (activa) {
        base.objetivo = nombreObj || base.objetivo;
        base.turno = `${formatHoraBA(activa.inicio)}–${formatHoraBA(activa.fin)}`;
        base.enServicio = true;
      }
      setPerfil(base);
      const todas = [
        ...(desp?.pendientes || []),
        ...(desp?.activos || []),
        ...(desp?.historial || []),
      ].filter((item) => item?.estado !== "cancelada" && idDe(item.asignacionId) === turnoId);
      todas.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setTareas(turnoId ? todas : []);
    } catch (error) {
      console.warn("[AsignacionesIngreso]", error?.message || error);
      setTareas([]);
      setPerfil(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      {perfil ? <TarjetaVigilador perfil={perfil} onSalir={onSalir} /> : null}
      <Text style={styles.titulo}>Asignaciones</Text>
      <Text style={styles.sub}>Tareas cargadas en este turno</Text>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F76C4" />
        </View>
      ) : (
        <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 12 }}>
          {tareas.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="clipboard-outline" size={42} color="#B0B8C4" />
              <Text style={styles.emptyTitulo}>Sin tareas en este turno</Text>
              <Text style={styles.emptySub}>
                No hay asignaciones cargadas para vos en el turno en curso.
              </Text>
            </View>
          ) : (
            tareas.map((item) => (
              <View key={String(item._id)} style={styles.card}>
                <Text style={styles.cardTitulo} numberOfLines={2}>
                  {item.titulo || "Tarea"}
                </Text>
                <Text style={styles.cardMeta}>
                  {item.estado || "pendiente"} · {item.prioridad || "media"}
                  {item.createdAt ? ` · ${formatHoraBA(item.createdAt)}` : ""}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
      <TouchableOpacity
        style={[styles.btn, loading && styles.btnOff]}
        onPress={onAceptar}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Text style={styles.btnTexto}>Aceptar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  identidad: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  identidadFila: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EB7F27",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    overflow: "hidden",
  },
  avatarFoto: { width: "100%", height: "100%" },
  avatarTexto: { color: "#fff", fontSize: 16, fontWeight: "800" },
  identidadDatos: { flex: 1, minWidth: 0 },
  identidadNombre: { color: "#fff", fontSize: 16, fontWeight: "800" },
  identidadRol: { color: "#C6CCEF", fontSize: 11, marginTop: 1 },
  identidadDetalle: { color: "#DDE1F5", fontSize: 11, marginTop: 2 },
  identidadAcciones: { alignItems: "flex-end", gap: 6, marginLeft: 6 },
  estadoChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(39, 174, 96, 0.22)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  estadoOff: { backgroundColor: "rgba(231, 76, 60, 0.22)" },
  estadoPunto: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#2ECC71",
    marginRight: 5,
  },
  puntoOff: { backgroundColor: "#E74C3C" },
  estadoTexto: { color: "#fff", fontSize: 10, fontWeight: "800" },
  btnSalir: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(231, 76, 60, 0.28)",
    borderWidth: 1,
    borderColor: "rgba(255, 180, 170, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  btnSalirTexto: { color: "#FFE8E6", fontSize: 10, fontWeight: "800" },
  titulo: { fontSize: 22, fontWeight: "800", color: "#1A2332" },
  sub: { marginTop: 4, marginBottom: 12, fontSize: 13, color: "#6B7280" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  lista: { flex: 1 },
  empty: { alignItems: "center", paddingTop: 48, paddingHorizontal: 12 },
  emptyTitulo: { marginTop: 8, fontSize: 16, fontWeight: "700", color: "#1A2332" },
  emptySub: { marginTop: 4, fontSize: 13, color: "#6B7280", textAlign: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  cardTitulo: { fontSize: 16, fontWeight: "800", color: "#1A2332" },
  cardMeta: { marginTop: 4, fontSize: 13, color: "#475569" },
  btn: {
    marginTop: 8,
    backgroundColor: "#0F76C4",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnOff: { backgroundColor: "#94A3B8" },
  btnTexto: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
