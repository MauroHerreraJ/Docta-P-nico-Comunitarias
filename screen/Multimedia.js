import React, { useState, useRef, useEffect, useCallback } from "react";
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
  PanResponder,
  Vibration,
  Keyboard,
  BackHandler,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
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
  const navigation = useNavigation();
  const inputRef = useRef(null);
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [messages, setMessages] = useState([]);
  const [lastSequence, setLastSequence] = useState(0);
  const [loading, setLoading] = useState({ text: false, image: false, audio: false, messages: false });
  const [audioUri, setAudioUri] = useState(null);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Refs para evitar cierres obsoletos en PanResponder
  const recordingStartTimeRef = useRef(null);
  const isRecordingRef = useRef(false);

  const recordingTimer = useRef(null);
  const durationInterval = useRef(null);
  const isPreparing = useRef(false);
  const pollTimer = useRef(null);
  const wasFocusedBeforeRecording = useRef(false);
  const flatListRef = useRef(null);
  const waveformAnim = useRef(new Animated.Value(0)).current;
  const micScale = useRef(new Animated.Value(1)).current;
  const cancelTranslateX = useRef(new Animated.Value(0)).current;

  // Manejar botón de atrás del dispositivo
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          "¿Abandonar Multimedia?",
          "Si sale de esta pantalla, no podrá adjuntar más información a este reporte.",
          [
            { text: "Continuar Reportando", style: "cancel", onPress: () => {} },
            { 
              text: "Salir", 
              style: "destructive", 
              onPress: () => {
                if (typeof onFinalize === 'function') onFinalize();
                navigation.navigate("Desit");
              } 
            },
          ]
        );
        return true;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);

      return () => subscription.remove();
    }, [onFinalize, navigation])
  );

  // Configuración del grabador de audio
  const audioRecorder = useAudioRecorder({
    extension: '.m4a',
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  });

  const { isRecording } = useAudioRecorderState(audioRecorder);
  const player = useAudioPlayer(audioUri);

  // Sincronizar refs con el estado para que el PanResponder los vea
  useEffect(() => {
    isRecordingRef.current = isRecording;
    // Si empezamos a grabar y el teclado estaba abierto, nos aseguramos de mantener el foco
    if (isRecording && wasFocusedBeforeRecording.current) {
      inputRef.current?.focus();
    }
  }, [isRecording]);

  useEffect(() => {
    recordingStartTimeRef.current = recordingStartTime;
  }, [recordingStartTime]);

  // PanResponder para el gesto de deslizar para cancelar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Guardamos si el teclado estaba abierto antes de empezar
        wasFocusedBeforeRecording.current = inputRef.current?.isFocused();
        
        // Solo intentamos mantener el foco si ya estaba enfocado
        if (wasFocusedBeforeRecording.current) {
          setTimeout(() => {
            inputRef.current?.focus();
          }, 10);
        }
        
        if (!isPreparing.current && !recordingStartTimeRef.current) {
          startRecording();
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < -50) {
          setIsCancelling(true);
        } else {
          setIsCancelling(false);
        }
        
        // Mover el texto de "Desliza para cancelar" un poco
        if (gestureState.dx < 0) {
          cancelTranslateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -100) {
          cancelRecording();
        } else {
          stopRecording();
        }
        // Resetear animaciones
        Animated.spring(cancelTranslateX, { toValue: 0, useNativeDriver: true }).start();
        setIsCancelling(false);
      },
      onPanResponderTerminate: () => {
        stopRecording();
        setIsCancelling(false);
      },
    })
  ).current;

  const cancelRecording = async () => {
    try {
      if (durationInterval.current) clearInterval(durationInterval.current);
      
      // Detener grabación si está activa
      if (isRecordingRef.current) {
        await audioRecorder.stop();
      }
      
      // Resetear estados
      setRecordingStartTime(null);
      setRecordingDuration(0);
      isPreparing.current = false;
      
      // Resetear animación del micrófono aquí también
      Animated.spring(micScale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();

      Vibration.vibrate(50); // Feedback táctil corto de cancelación
    } catch (e) {
      console.error("Error al cancelar grabación", e);
    }
  };

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
    const setupChat = async () => {
      // Configurar audio globalmente para esta pantalla una sola vez
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.warn("Error configurando modo de audio inicial:", e);
      }

      await initializeChat();
      startPolling();
    };
    
    setupChat();

    return () => {
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const initializeChat = async () => {
    setLoading(prev => ({ ...prev, messages: true }));
    try {
      // Obtenemos la última secuencia actual para ignorar el historial
      const data = await fetchChatMessages(0);
      if (data.ultima_secuencia) {
        setLastSequence(data.ultima_secuencia);
        console.log("Chat inicializado desde secuencia:", data.ultima_secuencia);
      }
      setMessages([]); // Aseguramos que el chat empiece vacío visualmente
    } catch (error) {
      console.error("Error al inicializar chat:", error);
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
    Keyboard.dismiss();

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
    if (isPreparing.current || isRecordingRef.current || recordingStartTimeRef.current) return;
    isPreparing.current = true;

    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert("Permiso denegado", "Se necesita permiso para grabar audio.");
        isPreparing.current = false;
        return;
      }

      Vibration.vibrate(60); // Feedback táctil de inicio
      
      // Animación del micrófono
      Animated.spring(micScale, {
        toValue: 1.5,
        friction: 4,
        useNativeDriver: true,
      }).start();

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setRecordingStartTime(Date.now());
      setRecordingDuration(0);

      // Iniciar contador de tiempo
      if (durationInterval.current) clearInterval(durationInterval.current);
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      recordingTimer.current = setTimeout(() => stopRecording(), 60000);
    } catch (err) {
      console.error("Failed to start recording", err);
    } finally {
      isPreparing.current = false;
    }
  };

  const stopRecording = async () => {
    // Si todavía se está preparando, esperamos un poco o forzamos el stop después
    if (isPreparing.current) {
      setTimeout(() => stopRecording(), 100);
      return;
    }

    if (!isRecordingRef.current && !recordingStartTimeRef.current) return;
    
    // Resetear animación del micrófono
    Animated.spring(micScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    if (durationInterval.current) clearInterval(durationInterval.current);

    const now = Date.now();
    const duration = now - (recordingStartTimeRef.current || 0);
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
      Vibration.vibrate(40); // Feedback táctil de fin
    } catch (error) {
      console.error("Failed to stop recording", error);
    } finally {
      setLoading(prev => ({ ...prev, audio: false }));
      setRecordingStartTime(null);
      setRecordingDuration(0);
      isPreparing.current = false;
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 80}
    >
      <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => {
              Alert.alert(
                "¿Abandonar Multimedia?",
                "Si sale de esta pantalla, no podrá adjuntar más información a este reporte.",
                [
                  { text: "Continuar Reportando", style: "cancel", onPress: () => {} },
                  { 
                    text: "Salir", 
                    style: "destructive", 
                    onPress: () => {
                      if (typeof onFinalize === 'function') onFinalize();
                      navigation.navigate("Desit");
                    } 
                  },
                ]
              );
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#222266" />
          </TouchableOpacity>
          <View style={styles.emergencyBadge}>
            <Ionicons name="warning" size={16} color="white" />
            <Text style={styles.emergencyText}>CANAL DE EMERGENCIA ACTIVO</Text>
          </View>
          <View style={{ width: 40 }} /> 
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyboardShouldPersistTaps="always"
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

      {/* Barra de entrada dinámica estilo WhatsApp */}
      <View style={styles.inputArea}>
        <View style={styles.inputMainContainer}>
          {/* El Input se mantiene siempre en el DOM para no perder el foco del teclado */}
          <View style={[
            styles.inputControlsContainer, 
            isRecording && { opacity: 0 }
          ]}>
            <TouchableOpacity style={styles.iconBtn} onPress={takePhoto}>
              <Ionicons name="camera" size={28} color="#222266" />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Escriba un mensaje..."
              value={text}
              onChangeText={setText}
              multiline
              blurOnSubmit={false}
            />
          </View>

          {/* Interfaz de grabación que aparece sobre el input */}
          {isRecording && (
            <View style={[styles.recordingContainer, { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'white' }]}>
              <View style={styles.recordingInfo}>
                <Animated.View style={[styles.redDot, { opacity: waveformAnim }]} />
                <Text style={styles.timerText}>{formatTimer(recordingDuration)}</Text>
              </View>
              
              <Animated.View 
                style={[
                  styles.cancelHintContainer, 
                  { transform: [{ translateX: cancelTranslateX }] }
                ]}
              >
                <Text style={[styles.cancelHint, isCancelling && { color: '#E74C3C' }]}>
                  {isCancelling ? "Suelta para borrar" : "◀ Desliza para cancelar"}
                </Text>
              </Animated.View>
              <View style={{ width: 50 }} /> 
            </View>
          )}
        </View>

        {/* Botón de Acción Estable (Micrófono/Enviar) */}
        <View style={styles.actionButtonContainer}>
          {(!text.trim() && images.length === 0 && !audioUri) ? (
            <Animated.View 
              {...panResponder.panHandlers}
              style={[
                styles.micBtnContainer, 
                isRecording && styles.micBtnContainerActive,
                { transform: [{ scale: micScale }] }
              ]}
            >
              <Ionicons 
                name="mic" 
                size={isRecording ? 32 : 28} 
                color={isRecording ? "#E74C3C" : "#222266"} 
              />
            </Animated.View>
          ) : (
            <TouchableOpacity 
              style={[styles.sendBtn, styles.sendBtnActive]} 
              onPress={handleSend}
            >
              <Ionicons name="send" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TouchableOpacity 
        style={styles.finalizeBtn} 
        onPress={() => {
          if (onFinalize) onFinalize();
          navigation.navigate("Desit");
        }}
      >
        <Text style={styles.finalizeBtnText}>FINALIZAR REPORTE</Text>
      </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F2F5" },
  header: { padding: 10, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#DDD" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  backButton: { padding: 5 },
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

  inputArea: { 
    flexDirection: "row", 
    alignItems: "center", 
    padding: 10, 
    backgroundColor: "white", 
    borderTopWidth: 1, 
    borderTopColor: "#EEE" 
  },
  inputMainContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  inputControlsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  actionButtonContainer: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 5,
  },
  input: { 
    flex: 1, 
    backgroundColor: "#F0F2F5", 
    borderRadius: 20, 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    marginHorizontal: 10, 
    maxHeight: 100, 
    fontSize: 16 
  },
  iconBtn: { padding: 5 },
  sendBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: "#222266", 
    justifyContent: "center", 
    alignItems: "center" 
  },
  sendBtnDisabled: { backgroundColor: "#CCC" },
  sendBtnActive: { backgroundColor: "#222266" },

  micBtnContainer: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  micBtnContainerActive: {
    backgroundColor: "rgba(231, 76, 60, 0.1)",
    borderRadius: 22,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
  },
  recordingInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E74C3C",
    marginRight: 8,
  },
  timerText: {
    fontSize: 16,
    color: "#333",
    fontFamily: "open-sans-bold",
  },
  cancelHintContainer: {
    flex: 1,
    alignItems: "center",
    marginRight: 40,
  },
  cancelHint: {
    fontSize: 14,
    color: "#999",
    fontFamily: "open-sans",
  },

  pendingAttachments: { backgroundColor: "white", padding: 10, borderTopWidth: 1, borderTopColor: "#EEE" },
  thumbWrapper: { marginRight: 10, position: "relative" },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  audioThumb: { backgroundColor: "#DCF8C6", justifyContent: "center", alignItems: "center" },
  removeThumb: { position: "absolute", top: -5, right: -5, backgroundColor: "white", borderRadius: 10 },

  finalizeBtn: { padding: 15, backgroundColor: "white", alignItems: "center", borderTopWidth: 1, borderTopColor: "#DDD" },
  finalizeBtnText: { color: "#E74C3C", fontWeight: "bold", letterSpacing: 1 }
});

export default Multimedia;
