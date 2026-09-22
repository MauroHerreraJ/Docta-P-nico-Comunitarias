import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  ScrollView,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { 
  useAudioRecorder, 
  useAudioRecorderState, 
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync
} from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  savePost, 
  sendChatMessage, 
  fetchChatMessages, 
  uploadChatAttachment, 
  generateUUID 
} from "../util/Api";

// 🎵 Sub-componente para reproducir audios en el chat
const AudioMessage = ({ uri, isMine }) => {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    player.loop = false; // Asegurar que no esté en bucle
  }, [player]);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish]);

  const handlePlayPause = async () => {
    if (status.playing) {
      player.pause();
    } else {
      // 🔊 Forzar salida por altavoz antes de reproducir
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
      } catch (e) {
        console.warn("Error configurando audio para altavoz:", e);
      }
      player.play();
    }
  };

  return (
    <View style={styles.audioBubbleContent}>
      <TouchableOpacity 
        onPress={handlePlayPause}
        style={styles.playButton}
      >
        <Ionicons name={status.playing ? "pause" : "play"} size={24} color="#222266" />
      </TouchableOpacity>
      <View style={styles.audioInfo}>
        <View style={styles.waveformPlaceholder}>
          <View style={[styles.waveformBar, { height: 10 }]} />
          <View style={[styles.waveformBar, { height: 20 }]} />
          <View style={[styles.waveformBar, { height: 15 }]} />
          <View style={[styles.waveformBar, { height: 25 }]} />
          <View style={[styles.waveformBar, { height: 10 }]} />
        </View>
        <Text style={styles.audioDuration}>
          {status.playing ? "Reproduciendo..." : "Audio"}
        </Text>
      </View>
      <Ionicons name="mic" size={20} color={isMine ? "#222266" : "#999"} style={{ marginLeft: 5 }} />
    </View>
  );
};

function Multimedia({ onFinalize, panicId }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [messages, setMessages] = useState([]);
  const [lastSequence, setLastSequence] = useState(0);
  const [loading, setLoading] = useState({ text: false, image: false, audio: false, messages: false });
  const [audioUri, setAudioUri] = useState(null);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  
  const recordingTimer = useRef(null);
  const pollTimer = useRef(null);
  const flatListRef = useRef(null);
  const waveformAnim = useRef(new Animated.Value(0)).current;

  // Configuración del grabador de audio
  const audioRecorder = useAudioRecorder({
    extension: '.m4a',
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  });

  const { isRecording } = useAudioRecorderState(audioRecorder);
  const player = useAudioPlayer(audioUri);

  // Animación del espectro de audio
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveformAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(waveformAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      waveformAnim.setValue(0);
    }
  }, [isRecording]);

  const lastSequenceRef = useRef(0);

  // Actualizar la referencia cada vez que cambie el estado (para el polling)
  useEffect(() => {
    lastSequenceRef.current = lastSequence;
  }, [lastSequence]);

  // Carga inicial y polling de mensajes
  useEffect(() => {
    loadInitialMessages();
    startPolling();
    return () => {
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const loadInitialMessages = async () => {
    setLoading(prev => ({ ...prev, messages: true }));
    try {
      const data = await fetchChatMessages(0);
      if (data.mensajes) {
        setMessages(data.mensajes);
        setLastSequence(data.ultima_secuencia);
      }
    } catch (error) {
      console.error("Error al cargar mensajes iniciales:", error);
    } finally {
      setLoading(prev => ({ ...prev, messages: false }));
    }
  };

  const startPolling = () => {
    pollTimer.current = setInterval(async () => {
      try {
        const data = await fetchChatMessages(lastSequenceRef.current);
        if (data.mensajes && data.mensajes.length > 0) {
          setMessages(prev => {
            let updatedList = [...prev];
            data.mensajes.forEach(nm => {
              const index = updatedList.findIndex(pm => 
                pm.client_message_id && pm.client_message_id === nm.client_message_id
              );
              
              if (index !== -1) {
                // Actualizamos el mensaje optimista con los datos reales del servidor
                updatedList[index] = { ...updatedList[index], ...nm, loading: false };
              } else if (!updatedList.some(pm => pm.secuencia === nm.secuencia)) {
                // Es un mensaje nuevo (ej: del operador)
                updatedList.push(nm);
              }
            });
            // Ordenar siempre por secuencia para evitar desorden por retardos de red
            return updatedList.sort((a, b) => (a.secuencia || 0) - (b.secuencia || 0));
          });
          setLastSequence(data.ultima_secuencia);
        }
      } catch (error) {
        console.warn("Error en polling de chat:", error);
      }
    }, 5000); // Cada 5 segundos
  };

  const handleSend = async () => {
    if (!text.trim() && images.length === 0 && !audioUri) return;

    const messageId = generateUUID();
    const tempText = text.trim();
    const pendingImages = [...images];
    const pendingAudio = audioUri;
    
    // Optimistic UI
    const newMsg = {
      client_message_id: messageId,
      texto: tempText,
      autor: "vecino",
      recibido_utc: new Date().toISOString(),
      loading: true,
      adjunto: pendingAudio 
        ? { tipo: "audio", url: pendingAudio } 
        : (pendingImages.length > 0 ? { tipo: "imagen", url: pendingImages[0] } : null)
    };

    setMessages(prev => [...prev, newMsg]);
    setText("");
    setImages([]);
    setAudioUri(null);

    try {
      let adjuntoId = null;

      // 1. Subir primer adjunto si existe (la API actual parece soportar uno por mensaje)
      if (pendingImages.length > 0) {
        const uploadResult = await uploadChatAttachment(pendingImages[0], "imagen");
        adjuntoId = uploadResult.adjunto_id;
      } else if (pendingAudio) {
        const uploadResult = await uploadChatAttachment(pendingAudio, "audio");
        adjuntoId = uploadResult.adjunto_id;
      }

      // 2. Enviar mensaje de chat
      await sendChatMessage({
        texto: tempText || (adjuntoId ? "" : "..."),
        client_message_id: messageId,
        adjunto_id: adjuntoId
      });
      
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      Alert.alert("Error", "No se pudo enviar el mensaje o los adjuntos.");
      // Opcionalmente remover el mensaje optimista o marcarlo como error
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
      // En un flujo real, aquí subiríamos la foto y luego enviaríamos el mensaje de chat
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

      // 🎙️ Configurar sesión para grabación
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      } catch (e) {
        console.warn("Error configurando audio para grabación:", e);
      }

      setRecordingStartTime(Date.now());
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      recordingTimer.current = setTimeout(() => stopRecording(), 60000);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    const now = Date.now();
    const duration = now - (recordingStartTime || 0);
    if (duration < 1000) {
      setTimeout(async () => await finalizeRecording(), 1000 - duration);
    } else {
      await finalizeRecording();
    }
  };

  const finalizeRecording = async () => {
    setLoading(prev => ({ ...prev, audio: true }));
    try {
      await audioRecorder.stop();
      setAudioUri(audioRecorder.uri);
    } catch (error) {
      console.error("Failed to stop recording", error);
    } finally {
      setLoading(prev => ({ ...prev, audio: false }));
      setRecordingStartTime(null);
    }
  };

  const renderMessage = ({ item }) => {
    const isMine = item.autor === "vecino";
    
    // Función para asegurar que la fecha se interprete como UTC
    const getValidDate = (dateStr) => {
      if (!dateStr) return new Date();
      try {
        let sanitized = dateStr;
        // Si viene con espacio, lo cambiamos por T para formato ISO
        sanitized = sanitized.replace(" ", "T");
        // Si no tiene indicador de zona horaria (Z o +00:00), se lo agregamos como UTC
        if (!sanitized.endsWith("Z") && !sanitized.includes("+") && sanitized.includes("T")) {
          sanitized += "Z";
        }
        const d = new Date(sanitized);
        return isNaN(d.getTime()) ? new Date() : d;
      } catch (e) {
        return new Date();
      }
    };

    return (
      <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.opMessage]}>
        {!isMine && <Text style={styles.authorName}>{item.autor_nombre || "Operador"}</Text>}
        {item.texto && <Text style={[styles.messageText, isMine ? styles.myText : styles.opText]}>{item.texto}</Text>}
        {item.adjunto && item.adjunto.tipo === "imagen" && (
          <Image source={{ uri: item.adjunto.url }} style={styles.messageImage} resizeMode="cover" />
        )}
        {item.adjunto && item.adjunto.tipo === "audio" && (
          <AudioMessage uri={item.adjunto.url} isMine={isMine} />
        )}
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>
            {getValidDate(item.recibido_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMine && (
            <Ionicons 
              name={item.loading ? "time-outline" : "checkmark-done"} 
              size={14} 
              color={item.loading ? "#999" : "#34B7F1"} 
              style={{ marginLeft: 5 }}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.emergencyBadge}>
          <Ionicons name="warning" size={16} color="white" />
          <Text style={styles.emergencyText}>CANAL DE EMERGENCIA ACTIVO</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item.secuencia?.toString() || item.client_message_id || index.toString()}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          loading.messages ? (
            <ActivityIndicator style={{ marginTop: 20 }} color="#222266" />
          ) : (
            <Text style={styles.emptyChatText}>Inicie el chat describiendo su situación...</Text>
          )
        }
      />

      {/* Área de adjuntos pendientes */}
      {(images.length > 0 || audioUri) && (
        <View style={styles.pendingAttachments}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {images.map((uri, index) => (
              <View key={`img-${index}`} style={styles.thumbWrapper}>
                <Image source={{ uri }} style={styles.thumb} />
                <TouchableOpacity style={styles.removeThumb} onPress={() => removeImage(index)}>
                  <Ionicons name="close-circle" size={20} color="#E74C3C" />
                </TouchableOpacity>
              </View>
            ))}
            {audioUri && (
              <View style={styles.thumbWrapper}>
                <View style={[styles.thumb, styles.audioThumb]}>
                  <Ionicons name="mic" size={30} color="#222266" />
                </View>
                <TouchableOpacity style={styles.removeThumb} onPress={() => setAudioUri(null)}>
                  <Ionicons name="close-circle" size={20} color="#E74C3C" />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Barra de entrada */}
      <View style={styles.inputArea}>
        <TouchableOpacity style={styles.iconBtn} onPress={takePhoto}>
          <Ionicons name="camera" size={28} color="#222266" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.iconBtn} onPress={isRecording ? stopRecording : startRecording}>
          <Ionicons name={isRecording ? "stop-circle" : "mic"} size={28} color={isRecording ? "#E74C3C" : "#222266"} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Escriba un mensaje..."
          value={text}
          onChangeText={setText}
          multiline
        />

        <TouchableOpacity 
          style={[styles.sendBtn, (!text.trim() && images.length === 0 && !audioUri) && styles.sendBtnDisabled]} 
          onPress={handleSend}
          disabled={!text.trim() && images.length === 0 && !audioUri}
        >
          <Ionicons name="send" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.finalizeBtn} onPress={onFinalize}>
        <Text style={styles.finalizeBtnText}>FINALIZAR REPORTE</Text>
      </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F2F5" },
  header: { padding: 10, alignItems: "center", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#DDD" },
  emergencyBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#E74C3C", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 15 },
  emergencyText: { color: "white", fontSize: 10, fontFamily: "open-sans-bold", marginLeft: 5 },
  
  messageList: { padding: 15, paddingBottom: 20 },
  messageBubble: { maxWidth: "80%", padding: 10, borderRadius: 15, marginBottom: 10, elevation: 1 },
  myMessage: { alignSelf: "flex-end", backgroundColor: "#DCF8C6", borderBottomRightRadius: 2 },
  opMessage: { alignSelf: "flex-start", backgroundColor: "white", borderBottomLeftRadius: 2 },
  authorName: { fontSize: 11, color: "#222266", fontWeight: "bold", marginBottom: 3 },
  messageText: { fontSize: 16, color: "#333" },
  myText: { color: "#000" },
  opText: { color: "#333" },
  messageImage: { width: 200, height: 150, borderRadius: 10, marginTop: 5 },
  
  // Estilos de Audio en el Chat
  audioBubbleContent: { flexDirection: "row", alignItems: "center", padding: 5, minWidth: 150 },
  playButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(34, 34, 102, 0.1)", justifyContent: "center", alignItems: "center" },
  audioInfo: { flex: 1, marginLeft: 10 },
  waveformPlaceholder: { flexDirection: "row", alignItems: "center", height: 30 },
  waveformBar: { width: 3, backgroundColor: "#222266", marginHorizontal: 1, borderRadius: 2 },
  audioDuration: { fontSize: 10, color: "#666" },

  messageFooter: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", marginTop: 4 },
  messageTime: { fontSize: 10, color: "#999" },
  emptyChatText: { textAlign: "center", color: "#999", marginTop: 50, fontFamily: "open-sans" },

  inputArea: { flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#EEE" },
  input: { flex: 1, backgroundColor: "#F0F2F5", borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, marginHorizontal: 10, maxHeight: 100, fontSize: 16 },
  iconBtn: { padding: 5 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#222266", justifyContent: "center", alignItems: "center" },
  sendBtnDisabled: { backgroundColor: "#CCC" },

  pendingAttachments: { backgroundColor: "white", padding: 10, borderTopWidth: 1, borderTopColor: "#EEE" },
  thumbWrapper: { marginRight: 10, position: "relative" },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  audioThumb: { backgroundColor: "#DCF8C6", justifyContent: "center", alignItems: "center" },
  removeThumb: { position: "absolute", top: -5, right: -5, backgroundColor: "white", borderRadius: 10 },

  finalizeBtn: { padding: 15, backgroundColor: "white", alignItems: "center", borderTopWidth: 1, borderTopColor: "#DDD" },
  finalizeBtnText: { color: "#E74C3C", fontWeight: "bold", letterSpacing: 1 }
});

export default Multimedia;
