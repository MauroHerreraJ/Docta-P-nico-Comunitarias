import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { 
  useAudioRecorder, 
  useAudioRecorderState, 
  requestRecordingPermissionsAsync,
  useAudioPlayer 
} from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { savePost } from "../util/Api";

function Multimedia({ onFinalize }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState({ text: false, image: false, audio: false });
  const [audioUri, setAudioUri] = useState(null);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  
  const recordingTimer = useRef(null);
  const waveformAnim = useRef(new Animated.Value(0)).current;

  // Configuración manual del grabador de audio
  const audioRecorder = useAudioRecorder({
    extension: '.m4a',
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  });

  const { isRecording } = useAudioRecorderState(audioRecorder);

  // Reproductor para oír el audio grabado
  const player = useAudioPlayer(audioUri);

  // Animación del espectro
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveformAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(waveformAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      waveformAnim.setValue(0);
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
    };
  }, []);

  const handleSendText = async () => {
    if (!text.trim()) {
      Alert.alert("Error", "Por favor, escriba un mensaje.");
      return;
    }

    setLoading(prev => ({ ...prev, text: true }));
    try {
      await savePost({
        eventCode: "130",
        multimediaText: text.trim()
      });
      Alert.alert("Éxito", "Mensaje enviado correctamente.");
      setText("");
    } catch (error) {
      console.error("Error al enviar texto multimedia:", error);
      Alert.alert("Error", "No se pudo enviar el mensaje.");
    } finally {
      setLoading(prev => ({ ...prev, text: false }));
    }
  };

  const takePhoto = async () => {
    if (images.length >= 3) {
      Alert.alert("Límite alcanzado", "Solo puede adjuntar hasta 3 imágenes.");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso denegado", "Se necesita permiso para usar la cámara.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.6,
    });

    if (!result.canceled) {
      const newUri = result.assets[0].uri;
      setImages(prev => [...prev, newUri]);
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert("Permiso denegado", "Se necesita permiso para grabar audio.");
        return;
      }

      setRecordingStartTime(Date.now());
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      recordingTimer.current = setTimeout(() => {
        stopRecording();
      }, 60000);

    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Error", "No se pudo iniciar la grabación.");
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    
    const now = Date.now();
    const duration = now - (recordingStartTime || 0);

    // FIX: Evitar el error de java.lang.RuntimeException: stop failed en Android
    // si se detiene la grabación demasiado rápido (< 1 seg)
    if (duration < 1000) {
      console.warn("Grabación demasiado corta, esperando...");
      setTimeout(async () => {
        await finalizeRecording();
      }, 1000 - duration);
    } else {
      await finalizeRecording();
    }
  };

  const finalizeRecording = async () => {
    setLoading(prev => ({ ...prev, audio: true }));
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setAudioUri(uri);
      console.log("Audio grabado en:", uri);
      // No alertamos aquí para no interrumpir el flujo del usuario
    } catch (error) {
      console.error("Failed to stop recording", error);
    } finally {
      setLoading(prev => ({ ...prev, audio: false }));
      setRecordingStartTime(null);
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
    }
  };

  const handleAudioAction = () => {
    if (audioUri && !isRecording) {
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
    }
  };

  const handleFinalize = async () => {
    setLoading(prev => ({ ...prev, text: true }));
    try {
      console.log("Enviando reporte final:", { images, text, audioUri });
      Alert.alert("Reporte Enviado", "Toda la información ha sido enviada con éxito.", [
        { text: "OK", onPress: onFinalize }
      ]);
    } catch (error) {
      Alert.alert("Error", "No se pudo finalizar el envío.");
    } finally {
      setLoading(prev => ({ ...prev, text: false }));
    }
  };

  const RecordingWaveform = () => (
    <View style={styles.waveformContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveformBar,
            {
              transform: [{
                scaleY: waveformAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1 + (i * 0.5)]
                })
              }]
            }
          ]}
        />
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {images.length === 0 && !audioUri && (
          <View style={styles.header}>
            <View style={styles.emergencyBadge}>
              <Ionicons name="warning" size={20} color="white" />
              <Text style={styles.emergencyText}>EMERGENCIA ACTIVA</Text>
            </View>
            <Text style={styles.title}>Información Adicional</Text>
          </View>
        )}

        {/* Ventana Superior de Galería (Preview) */}
        {images.length > 0 && (
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Imágenes Capturadas ({images.length}/3)</Text>
            </View>
            <View style={styles.galleryRow}>
              {images.map((uri, index) => (
                <View key={index} style={styles.thumbnailWrapper}>
                  <Image source={{ uri }} style={styles.thumbnail} />
                  <TouchableOpacity 
                    style={styles.deleteBadge}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mensaje de Texto</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Describa la situación..."
            multiline
            numberOfLines={4}
            value={text}
            onChangeText={setText}
            placeholderTextColor="#999"
          />
          <TouchableOpacity 
            style={[styles.sendButton, (!text.trim() || loading.text) && styles.buttonDisabled]}
            onPress={handleSendText}
            disabled={!text.trim() || loading.text}
          >
            {loading.text ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.buttonText}>ENVIAR TEXTO</Text>
                <Ionicons name="send" size={18} color="white" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity 
            style={[styles.actionCard, (loading.image || images.length >= 3) && styles.cardDisabled]}
            onPress={takePhoto}
            disabled={loading.image || images.length >= 3}
          >
            {loading.image ? (
              <ActivityIndicator color="#222266" />
            ) : (
              <>
                <View style={[styles.iconCircle, { backgroundColor: "#E3F2FD" }]}>
                  <MaterialIcons name="photo-camera" size={32} color="#1976D2" />
                </View>
                <Text style={styles.actionLabel}>
                  {images.length >= 3 ? "LÍMITE ALCANZADO" : "TOMAR FOTO"}
                </Text>
                {images.length > 0 && images.length < 3 && (
                  <Text style={styles.imageCount}>{images.length}/3 fotos</Text>
                )}
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, isRecording && styles.cardRecording]}
            onPress={handleAudioAction}
            onLongPress={startRecording}
            onPressOut={stopRecording}
            delayLongPress={200}
          >
            {loading.audio ? (
              <ActivityIndicator color="#222266" />
            ) : (
              <>
                <View style={[
                  styles.iconCircle, 
                  isRecording ? { backgroundColor: "#FFEBEE" } : (audioUri ? { backgroundColor: "#E8F5E9" } : { backgroundColor: "#F3E5F5" })
                ]}>
                  <Ionicons 
                    name={isRecording ? "stop-circle" : (audioUri ? (player.playing ? "pause" : "play") : "mic")} 
                    size={32} 
                    color={isRecording ? "#D32F2F" : (audioUri ? "#2E7D32" : "#7B1FA2")} 
                  />
                </View>
                <Text style={[
                  styles.actionLabel, 
                  isRecording && { color: "#D32F2F" },
                  audioUri && !isRecording && { color: "#2E7D32" }
                ]}>
                  {isRecording ? "GRABANDO..." : (audioUri ? "OÍR / RE-GRABAR" : "GRABAR AUDIO")}
                </Text>
                {isRecording && <RecordingWaveform />}
                {!isRecording && audioUri && <Text style={styles.audioHint}>Mantenga para re-grabar</Text>}
                {!isRecording && !audioUri && <Text style={styles.audioHint}>Mantenga para grabar</Text>}
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.finalizeButton}
          onPress={handleFinalize}
        >
          <Text style={styles.finalizeButtonText}>ENVIAR Y FINALIZAR REPORTE</Text>
          <Ionicons name="cloud-upload" size={20} color="#222266" style={{ marginLeft: 10 }} />
        </TouchableOpacity>
        
        <Text style={styles.footerText}>La información será enviada a la central de monitoreo.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 20, marginTop: 10 },
  emergencyBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#E74C3C", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 15 },
  emergencyText: { color: "white", fontSize: 12, fontFamily: "open-sans-bold", marginLeft: 6 },
  title: { fontSize: 24, fontFamily: "open-sans-bold", color: "#222266", textAlign: "center" },
  
  previewContainer: { backgroundColor: "white", borderRadius: 15, padding: 15, marginBottom: 20, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 5 },
  previewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  previewTitle: { fontSize: 14, fontFamily: "open-sans-bold", color: "#666" },
  galleryRow: { flexDirection: "row", justifyContent: "flex-start" },
  thumbnailWrapper: { marginRight: 15, position: "relative" },
  thumbnail: { width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: "#DDD" },
  deleteBadge: { position: "absolute", top: -8, right: -8, backgroundColor: "white", borderRadius: 10 },

  card: { backgroundColor: "white", borderRadius: 15, padding: 20, marginBottom: 20, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardTitle: { fontSize: 16, fontFamily: "open-sans-bold", color: "#222266", marginBottom: 15 },
  textInput: { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 15, fontSize: 16, fontFamily: "open-sans", color: "#333", borderWidth: 1, borderColor: "#E5E7EB", textAlignVertical: "top", minHeight: 100 },
  sendButton: { backgroundColor: "#222266", flexDirection: "row", height: 50, borderRadius: 10, justifyContent: "center", alignItems: "center", marginTop: 15 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "white", fontSize: 16, fontFamily: "open-sans-bold" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 25 },
  actionCard: { backgroundColor: "white", width: "48%", borderRadius: 15, padding: 20, alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardDisabled: { opacity: 0.5 },
  cardRecording: { borderColor: "#E74C3C", borderWidth: 1 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  actionLabel: { fontSize: 12, fontFamily: "open-sans-bold", color: "#222266", textAlign: "center" },
  imageCount: { fontSize: 10, color: "#1976D2", marginTop: 4, fontFamily: "open-sans-bold" },
  audioHint: { fontSize: 10, color: "#666", marginTop: 4 },
  finalizeButton: { flexDirection: "row", borderWidth: 2, borderColor: "#222266", height: 55, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 10 },
  finalizeButtonText: { color: "#222266", fontSize: 16, fontFamily: "open-sans-bold" },
  footerText: { textAlign: "center", color: "#999", fontSize: 12, marginTop: 20, fontFamily: "open-sans" },

  // Waveform Styles
  waveformContainer: { flexDirection: "row", height: 20, alignItems: "center", marginTop: 10 },
  waveformBar: { width: 3, height: 8, backgroundColor: "#E74C3C", marginHorizontal: 2, borderRadius: 2 },
});

export default Multimedia;
