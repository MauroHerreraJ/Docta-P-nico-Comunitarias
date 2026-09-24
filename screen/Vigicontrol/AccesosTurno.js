import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { crearAccesoApp, getMisAccesosApp } from "../../util/NuevaApi";
import { formatFechaBA, formatHoraBA } from "../../util/horaBA";

const VACIO = {
  dni: "",
  nombre: "",
  apellido: "",
  vehiculo: "",
  patente: "",
  motivo: "",
};

function apiMessage(error, fallback) {
  const msg = error?.response?.data?.message;
  if (Array.isArray(msg)) return String(msg[0] || fallback);
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

export default function AccesosTurno() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getMisAccesosApp());
    } catch (error) {
      console.warn("[AccesosTurno]", error?.message || error);
      Alert.alert("Sin conexión", "No se pudo abrir Accesos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const setCampo = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onGuardar = async () => {
    if (sending) return;
    if (!data?.enCurso) {
      Alert.alert("Turno", "El turno no está en curso.");
      return;
    }
    const dni = form.dni.trim();
    const nombre = form.nombre.trim();
    const apellido = form.apellido.trim();
    const motivo = form.motivo.trim();
    if (!dni || !nombre || !apellido || !motivo) {
      Alert.alert("Faltan datos", "DNI, nombre, apellido y motivo son obligatorios.");
      return;
    }
    setSending(true);
    try {
      const res = await crearAccesoApp({
        dni,
        nombre,
        apellido,
        vehiculo: form.vehiculo.trim(),
        patente: form.patente.trim(),
        motivo,
        clientId: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });
      const creado = res?.acceso;
      if (creado) {
        setData((prev) => ({
          ...(prev || {}),
          hoy: (prev?.hoy || 0) + 1,
          accesos: [creado, ...(prev?.accesos || [])],
        }));
      }
      setForm(VACIO);
    } catch (error) {
      Alert.alert("No se guardó", apiMessage(error, "Probá de nuevo."));
    } finally {
      setSending(false);
    }
  };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16A085" />
      </View>
    );
  }

  const puede = Boolean(data?.enCurso && data?.asignacionId);
  const ahora = new Date();

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.titulo}>Acceso</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {data?.objetivo || "Sin objetivo"}
          {data?.enCurso ? "" : " · el turno no está en curso"}
        </Text>
        <Text style={styles.cuando}>
          {data?.puesto || "Puesto 1"} · {formatFechaBA(ahora)} · {formatHoraBA(ahora)}
        </Text>

        <Campo label="DNI" value={form.dni} onChange={(v) => setCampo("dni", v)} editable={puede} keyboardType="number-pad" />
        <Campo label="Nombre" value={form.nombre} onChange={(v) => setCampo("nombre", v)} editable={puede} />
        <Campo label="Apellido" value={form.apellido} onChange={(v) => setCampo("apellido", v)} editable={puede} />
        <Campo label="Vehículo" value={form.vehiculo} onChange={(v) => setCampo("vehiculo", v)} editable={puede} placeholder="A pie, auto, moto..." />
        <Campo label="Patente" value={form.patente} onChange={(v) => setCampo("patente", v)} editable={puede} autoCapitalize="characters" />
        <Campo label="Motivo" value={form.motivo} onChange={(v) => setCampo("motivo", v)} editable={puede} multiline />

        <TouchableOpacity
          style={[styles.btn, (!puede || sending) && styles.btnOff]}
          onPress={onGuardar}
          disabled={!puede || sending}
        >
          <Text style={styles.btnTexto}>{sending ? "Guardando..." : "Registrar ingreso"}</Text>
        </TouchableOpacity>

        <Text style={styles.listaTitulo}>Hoy en este objetivo</Text>
        {(data?.accesos || []).length === 0 ? (
          <Text style={styles.vacio}>Todavía no registraste ingresos.</Text>
        ) : (
          (data?.accesos || []).map((item) => (
            <View key={item._id} style={styles.fila}>
              <Text style={styles.filaHora}>
                {formatHoraBA(item.at)} · {item.apellido}, {item.nombre}
              </Text>
              <Text style={styles.filaSub}>
                DNI {item.dni}
                {item.patente ? ` · ${item.patente}` : ""}
                {item.motivo ? ` · ${item.motivo}` : ""}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({
  label,
  value,
  onChange,
  editable,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline,
}) {
  return (
    <View style={styles.campo}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        editable={editable}
        placeholder={placeholder || ""}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || "sentences"}
        multiline={Boolean(multiline)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7FA" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  titulo: { fontSize: 18, fontWeight: "800", color: "#1A2332", marginTop: 12, marginHorizontal: 16 },
  sub: { marginTop: 2, marginHorizontal: 16, fontSize: 12, color: "#6B7280" },
  cuando: {
    marginTop: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#16A085",
  },
  campo: { marginHorizontal: 16, marginTop: 8 },
  label: { marginBottom: 4, fontSize: 12, fontWeight: "700", color: "#475569" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1A2332",
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  btn: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: "#16A085",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnOff: { backgroundColor: "#94A3B8" },
  btnTexto: { color: "#fff", fontWeight: "800", fontSize: 15 },
  listaTitulo: {
    marginTop: 22,
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "800",
    color: "#1A2332",
  },
  vacio: { marginHorizontal: 16, fontSize: 13, color: "#6B7280" },
  fila: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    padding: 12,
  },
  filaHora: { fontSize: 14, fontWeight: "700", color: "#1A2332" },
  filaSub: { marginTop: 2, fontSize: 12, color: "#64748B" },
});
