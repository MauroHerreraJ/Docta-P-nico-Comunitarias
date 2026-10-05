import { useCallback, useRef, useState } from "react";
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
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { crearNovedadApp, getMisNovedadesApp } from "../../util/NuevaApi";
import { formatHoraBA } from "../../util/horaBA";

let speechApi = null;
try {
  speechApi = require("expo-speech-recognition");
} catch {
  speechApi = null;
}

function DictadoEventos({ onStart, onEnd, onResult, onError }) {
  const { useSpeechRecognitionEvent } = speechApi;
  useSpeechRecognitionEvent("start", onStart);
  useSpeechRecognitionEvent("end", onEnd);
  useSpeechRecognitionEvent("result", onResult);
  useSpeechRecognitionEvent("error", onError);
  return null;
}

function apiMessage(error, fallback) {
  const msg = error?.response?.data?.message;
  if (Array.isArray(msg)) return String(msg[0] || fallback);
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

export default function NovedadesTurno() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [audioUri, setAudioUri] = useState("");
  const baseRef = useRef("");
  const grabacionInicio = useRef(0);
  const grabacionTimer = useRef(null);
  const audioRecorder = useAudioRecorder({
    extension: ".m4a",
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
  });
  const { isRecording } = useAudioRecorderState(audioRecorder);

  const onDictadoStart = useCallback(() => setEscuchando(true), []);
  const onDictadoEnd = useCallback(() => setEscuchando(false), []);
  const onDictadoResult = useCallback((event) => {
    const dicho = String(event.results?.[0]?.transcript || "").trim();
    if (!dicho) return;
    const base = baseRef.current;
    setTexto([base, dicho].filter(Boolean).join(" ").slice(0, 2000));
  }, []);
  const onDictadoError = useCallback((event) => {
    setEscuchando(false);
    if (
      event.error === "no-speech" ||
      event.error === "aborted" ||
      event.error === "speech-timeout"
    ) {
      return;
    }
    Alert.alert("No se pudo dictar", "Probá de nuevo o escribí la novedad.");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await getMisNovedadesApp();
      setData(payload);
    } catch (error) {
      console.warn("[NovedadesTurno]", error?.message || error);
      Alert.alert("Sin conexión", "No se pudo abrir el libro de novedades.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onDictar = async () => {
    if (!puedeEscribir || sending) return;
    const modulo = speechApi?.ExpoSpeechRecognitionModule;
    if (!modulo) {
      Alert.alert(
        "Dictado",
        "El reconocimiento de voz entra con la próxima compilación de la app.",
      );
      return;
    }
    if (escuchando) {
      modulo.stop();
      return;
    }
    try {
      const perm = await modulo.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Micrófono", "Hace falta el micrófono para dictar la novedad.");
        return;
      }
      baseRef.current = String(texto || "").trim();
      modulo.start({
        lang: "es-AR",
        interimResults: true,
        continuous: false,
      });
    } catch {
      setEscuchando(false);
      Alert.alert(
        "Dictado",
        "El reconocimiento de voz entra con la próxima compilación de la app.",
      );
    }
  };

  const onEnviar = async () => {
    const nota = String(texto || "").trim();
    if (!nota || sending) return;
    if (escuchando) speechApi?.ExpoSpeechRecognitionModule?.stop?.();
    if (isRecording) {
      Alert.alert("Audio", "Detené la grabación antes de enviar.");
      return;
    }
    if (!data?.enCurso) {
      Alert.alert("Turno", "El turno no está en curso.");
      return;
    }
    setSending(true);
    try {
      const res = await crearNovedadApp({
        texto: nota,
        at: new Date().toISOString(),
        clientId: `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        fotos,
        audio: audioUri ? { uri: audioUri } : null,
      });
      const creada = res?.novedad;
      if (creada) {
        setData((prev) => ({
          ...(prev || {}),
          novedades: [...(prev?.novedades || []), creada],
        }));
      }
      setTexto("");
      setFotos([]);
      setAudioUri("");
    } catch (error) {
      Alert.alert("No se guardó", apiMessage(error, "Probá de nuevo."));
    } finally {
      setSending(false);
    }
  };

  const onFoto = async () => {
    if (!puedeEscribir || sending || fotos.length >= 3) return;
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Cámara", "Hace falta la cámara para adjuntar una foto.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      allowsEditing: false,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setFotos((prev) =>
      [...prev, { uri: asset.uri, type: "image/jpeg", name: "foto.jpg" }].slice(0, 3),
    );
  };

  const cortarGrabacion = async () => {
    if (grabacionTimer.current) {
      clearTimeout(grabacionTimer.current);
      grabacionTimer.current = null;
    }
    const transcurrido = Date.now() - (grabacionInicio.current || 0);
    if (transcurrido < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 1000 - transcurrido));
    }
    await audioRecorder.stop();
    setAudioUri(audioRecorder.uri || "");
    grabacionInicio.current = 0;
  };

  const onGrabar = async () => {
    if (!puedeEscribir || sending || escuchando) return;
    if (isRecording) {
      try {
        await cortarGrabacion();
      } catch {
        Alert.alert("Audio", "No se pudo guardar la grabación.");
      }
      return;
    }
    if (audioUri) {
      setAudioUri("");
      return;
    }
    const permiso = await requestRecordingPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Micrófono", "Hace falta el micrófono para grabar el audio.");
      return;
    }
    try {
      grabacionInicio.current = Date.now();
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      grabacionTimer.current = setTimeout(() => {
        cortarGrabacion().catch(() => {});
      }, 60000);
    } catch {
      Alert.alert("Audio", "No se pudo empezar a grabar.");
    }
  };

  const dictado = speechApi ? (
    <DictadoEventos
      onStart={onDictadoStart}
      onEnd={onDictadoEnd}
      onResult={onDictadoResult}
      onError={onDictadoError}
    />
  ) : null;

  if (loading && !data) {
    return (
      <View style={styles.center}>
        {dictado}
        <ActivityIndicator size="large" color="#8E44AD" />
      </View>
    );
  }

  const novedades = data?.novedades || [];
  const puedeEscribir = Boolean(data?.enCurso && data?.asignacionId);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {dictado}
      <View style={styles.header}>
        <Text style={styles.titulo}>Libro de novedades</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {data?.objetivo || "Sin objetivo"}
          {data?.enCurso ? "" : " · el turno no está en curso"}
        </Text>
      </View>

      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 8 }}>
        {novedades.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={40} color="#B0B8C4" />
            <Text style={styles.emptyTitulo}>Sin novedades</Text>
            <Text style={styles.emptySub}>
              {data?.asignacionId
                ? "Lo que anotes queda en este turno."
                : "Cuando tengas un turno, el libro aparece acá."}
            </Text>
          </View>
        ) : (
          novedades.map((item) => (
            <View key={item._id} style={styles.nota}>
              <Text style={styles.hora}>{formatHoraBA(item.at)}</Text>
              <Text style={styles.cuerpo}>{item.texto}</Text>
              {(item.adjuntos || []).some((adj) => adj.tipo === "foto") ? (
                <View style={styles.fotos}>
                  {(item.adjuntos || [])
                    .filter((adj) => adj.tipo === "foto" && adj.url)
                    .map((adj) => (
                      <Image key={adj.url} source={{ uri: adj.url }} style={styles.foto} />
                    ))}
                </View>
              ) : null}
              {(item.adjuntos || []).some((adj) => adj.tipo === "audio") ? (
                <Text style={styles.audioNota}>Audio</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.adjuntosBar}>
        <TouchableOpacity
          style={[styles.chip, (!puedeEscribir || sending || fotos.length >= 3) && styles.btnOff]}
          onPress={onFoto}
          disabled={!puedeEscribir || sending || fotos.length >= 3}
        >
          <Ionicons name="camera" size={16} color="#fff" />
          <Text style={styles.chipTexto}>Foto {fotos.length ? fotos.length : ""}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, isRecording && styles.micOn, (!puedeEscribir || sending) && styles.btnOff]}
          onPress={onGrabar}
          disabled={!puedeEscribir || sending || escuchando}
        >
          <Ionicons name={isRecording ? "stop" : audioUri ? "trash" : "mic-circle"} size={16} color="#fff" />
          <Text style={styles.chipTexto}>
            {isRecording ? "Detener" : audioUri ? "Quitar audio" : "Grabar"}
          </Text>
        </TouchableOpacity>
      </View>
      {fotos.length || audioUri ? (
        <View style={styles.previas}>
          {fotos.map((foto) => (
            <Image key={foto.uri} source={{ uri: foto.uri }} style={styles.foto} />
          ))}
          {audioUri ? <Text style={styles.audioNota}>Audio listo</Text> : null}
        </View>
      ) : null}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder={
            escuchando
              ? "Hablá la novedad…"
              : puedeEscribir
                ? "Anotá o dictá una novedad"
                : "El turno no está en curso"
          }
          placeholderTextColor="#9CA3AF"
          multiline
          editable={puedeEscribir && !sending}
          maxLength={2000}
        />
        <TouchableOpacity
          style={[
            styles.mic,
            escuchando && styles.micOn,
            (!puedeEscribir || sending) && styles.btnOff,
          ]}
          onPress={onDictar}
          disabled={!puedeEscribir || sending || isRecording}
          accessibilityLabel={escuchando ? "Detener dictado" : "Dictar novedad"}
        >
          <Ionicons name={escuchando ? "stop" : "mic"} size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, (!puedeEscribir || !texto.trim() || sending) && styles.btnOff]}
          onPress={onEnviar}
          disabled={!puedeEscribir || !texto.trim() || sending}
        >
          <Text style={styles.btnTexto}>{sending ? "..." : "Enviar"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  header: { marginBottom: 8 },
  titulo: { fontSize: 18, fontWeight: "800", color: "#1A2332" },
  sub: { marginTop: 2, fontSize: 12, color: "#6B7280" },
  lista: { flex: 1 },
  nota: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  hora: { fontSize: 12, fontWeight: "800", color: "#8E44AD" },
  cuerpo: { marginTop: 4, fontSize: 14, lineHeight: 20, color: "#1A2332" },
  fotos: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  foto: { width: 64, height: 64, borderRadius: 8, backgroundColor: "#E8ECF1" },
  audioNota: { marginTop: 6, fontSize: 12, fontWeight: "700", color: "#8E44AD" },
  adjuntosBar: { flexDirection: "row", gap: 8, marginTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#8E44AD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipTexto: { color: "#fff", fontWeight: "700", fontSize: 12 },
  previas: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  emptyTitulo: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "700",
    color: "#1A2332",
  },
  emptySub: {
    marginTop: 4,
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 17,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1A2332",
  },
  mic: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#8E44AD",
    alignItems: "center",
    justifyContent: "center",
  },
  micOn: { backgroundColor: "#DC2626" },
  btn: {
    backgroundColor: "#8E44AD",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btnOff: { backgroundColor: "#94A3B8" },
  btnTexto: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
