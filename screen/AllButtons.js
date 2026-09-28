import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Dimensions,
  Vibration,
  Pressable,
  Animated,
  Platform,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import { GlobalStyles } from "../constans/Colors";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { savePost, sendLocationDocta4 } from "../util/Api";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import SecondaryButton from "../component/SecondaryButton";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AllButtons = ({ onPanicSuccess, onPanicCancel, activeProduct, externalPanicId }) => {
  const navigation = useNavigation();
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [isPanicActive, setIsPanicActive] = useState(false);
  const [showInvitation, setShowInvitation] = useState(false);
  const [lastPanicId, setLastPanicId] = useState(null);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const invitationProgress = useRef(new Animated.Value(1)).current;
  const startTimeRef = useRef(null);
  const invitationTimerRef = useRef(null);
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;
  const [altoBox, setAltoBox] = useState(screenHeight / 4 - 20);
  const [anchBox, setAnchBox] = useState(screenWidth / 10);
  const [backgroundImage, setBackgroundImage] = useState("https://i.imgur.com/OGxH3he.png");

  // Función para obtener la clave de almacenamiento según el producto (espejada de App.js)
  const getStorageKey = (product) => {
    if (!product || product === "docta_panico" || product === "docta_legacy") return "@licencias";
    return `@licencias_${product}`;
  };
  
  useEffect(() => {
    // Actualizar altoBox si la altura de la pantalla cambia
    setAltoBox(screenHeight / 4 - 20);
    setAnchBox(screenWidth / 10);
  }, [screenHeight]); // Solo cuando cambia la altura de la pantalla
  //console.log("ancho", anchBox, screenWidth, "alto", altoBox, screenHeight);

  useEffect(() => {
    // Si el pánico se desactiva desde afuera (ej: botón Finalizar en Multimedia)
    // reseteamos el estado visual local
    if (!externalPanicId && isPanicActive) {
      console.log("Resetting panic button state from external signal");
      setIsPanicActive(false);
      setShowInvitation(false);
      setLastPanicId(null);
      if (invitationTimerRef.current) clearTimeout(invitationTimerRef.current);
    }
  }, [externalPanicId]);

  useEffect(() => {
    // Cargar imagen de fondo desde AsyncStorage
    const loadPanicAppData = async () => {
      try {
        const specificKey = getStorageKey(activeProduct);
        const storedData = await AsyncStorage.getItem(specificKey);
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          if (parsedData.panicAppData?.backgroundUrl) {
            setBackgroundImage(parsedData.panicAppData.backgroundUrl);
            console.log(`Imagen de fondo cargada desde ${specificKey}:`, parsedData.panicAppData.backgroundUrl);
          }
        }
      } catch (error) {
        console.error("Error al cargar datos del panicapp:", error);
      }
    };
    loadPanicAppData();

    return () => {
      if (invitationTimerRef.current) clearTimeout(invitationTimerRef.current);
    };
  }, [activeProduct]);

  const handlePressIn = () => {
    setShowProgressBar(true);
    animatedValue.setValue(0);
    // Inicia la animación y usa el callback de start
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        // La barra de progreso se llenó
        if (isPanicActive) {
          cancelarEvento();
        } else {
          enviarEvento("ALARM");
        }
        setShowProgressBar(false);
      }
    });
  };

  const cancelarEvento = async () => {
    Vibration.vibrate([100, 100, 100]); // Vibración triple para indicar cancelación
    try {
      // Intentamos enviar al servidor si hay un ID, pero no bloqueamos la UI si falla
      if (lastPanicId) {
        await savePost({
          eventCode: "140", // Código de cancelación
          relatedPanicId: lastPanicId,
        });
      }
      console.log("Evento cancelado en servidor o modo simulación");
    } catch (error) {
      console.log("Error al cancelar en servidor (normal si no está implementado), reseteando UI localmente");
    } finally {
      // Siempre reseteamos la UI para poder seguir probando
      setIsPanicActive(false);
      setShowInvitation(false);
      setLastPanicId(null);
      if (invitationTimerRef.current) clearTimeout(invitationTimerRef.current);
      if (typeof onPanicCancel === 'function') onPanicCancel();
      
      Alert.alert(
        "Evento Cancelado",
        "El aviso de pánico ha sido cancelado exitosamente.",
        [{ text: "OK" }]
      );
    }
  };

  const handlePressOut = () => {
    // Si se suelta antes de que la animación termine, se detiene
    animatedValue.stopAnimation();
    setShowProgressBar(false);
  };
  
  // Interpolación para el efecto de escala (crece desde el centro)
  const scaleValue = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  
  // Interpolación para la opacidad
  const opacityValue = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.9],
  });

  const enviarEvento = async (eventType) => {
    Vibration.vibrate(500);
    try {
      // 1. Enviar el pánico inicial
      const result = await savePost({
        eventCode: "120",
      });
      console.log(`${eventType} enviado`, result);
      
      const id = result?.id || result?.event_id || null;
      setLastPanicId(id);
      setIsPanicActive(true);
      setShowInvitation(true);

      // 3. Iniciar barra de progreso visual para la invitación (30 segundos)
      invitationProgress.setValue(1);
      setTimeout(() => {
        Animated.timing(invitationProgress, {
          toValue: 0,
          duration: 30000,
          useNativeDriver: false,
        }).start();
      }, 100);

      // 4. Iniciar temporizador para ocultar la invitación y resetear estados
      if (invitationTimerRef.current) clearTimeout(invitationTimerRef.current);
      invitationTimerRef.current = setTimeout(() => {
        setShowInvitation(false);
        setIsPanicActive(false); // El botón vuelve a su estado original
        setLastPanicId(null);    // Limpiamos el ID del evento activo
        if (typeof onPanicCancel === 'function') onPanicCancel(); // Informamos a App.js
      }, 30000);

      // 5. Activar multimedia
      if (onPanicSuccess) onPanicSuccess(result);

      // 3. Obtener y enviar ubicación precisa (Post-Pánico DOCTA 4)
      if (id && activeProduct !== "docta_legacy") {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            
            await sendLocationDocta4(id, {
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              accuracy: location.coords.accuracy,
              timestamp: new Date().toISOString(),
            });
            console.log("Ubicación post-pánico enviada con éxito");
          }
        } catch (locError) {
          console.warn("No se pudo enviar la ubicación post-pánico:", locError);
        }
      }
      
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo establecer comunicación con el centro de monitoreo.");
    }
  };

  const turnOnLight = async (eventType) => {
    Vibration.vibrate(500);
    try {
      const result = await savePost({
        eventCode: "122",
      });
      console.log(`${eventType} enviado`, result);
    } catch (error) {
      console.error(error);
    }
  };

  const turnOnSiren = async (eventType) => {
    Vibration.vibrate(500);
    try {
      const result = await savePost({
        eventCode: "121",
      });
      console.log(`${eventType} enviado`, result);
    } catch (error) {
      console.error(error);
    }
  };

  const disarm = async (eventType) => {
    Vibration.vibrate(500);
    try {
      const result = await savePost({
        eventCode: "104",
      });
      console.log(`${eventType} enviado`, result);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <ImageBackground
      source={{ uri: backgroundImage }}
      resizeMode="cover"
      style={styles.rootScreen}
    >
      {showInvitation ? (
        <View style={styles.invitationContainer}>
          <View style={styles.invitationCardWrapper}>
            <TouchableOpacity 
              style={styles.invitationCard}
              onPress={() => {
                if (invitationTimerRef.current) clearTimeout(invitationTimerRef.current);
                setShowInvitation(false);
                navigation.navigate("Multimedia");
              }}
            >
              <View style={styles.invitationIconContainer}>
                <MaterialIcons name="perm-media" size={40} color="#222266" />
              </View>
              <View style={styles.invitationTextContainer}>
                <View style={styles.statusBadge}>
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                  <Text style={styles.statusText}>Evento enviado</Text>
                </View>
                <Text style={styles.invitationTitle}>¿Desea adjuntar información?</Text>
                <Text style={styles.invitationSubtitle}>Podrá enviar fotos o audio del evento.</Text>
                <Text style={styles.invitationOptional}>(Opcional)</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#BBBBBB" />
            </TouchableOpacity>
            {/* Barra de vida de la tarjeta */}
            <View style={styles.invitationProgressContainer}>
              <Animated.View 
                style={[
                  styles.invitationProgressBar, 
                  { 
                    width: invitationProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    }) 
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.buttonRow, { marginTop: altoBox / 20 }]}>
          <SecondaryButton
            onPress={turnOnLight}
            name="wb-sunny"
            styles={StyleSheet.flatten([
              styles.baseButtonContainer,
              { height: altoBox - 15 },
              styles.lightButton,
            ])}
            text="Encender"
            text2="Reflector"
          />
          <SecondaryButton
            onPress={turnOnSiren}
            name="notifications-active"
            styles={StyleSheet.flatten([
              styles.baseButtonContainer,
              { height: altoBox - 15 },
              styles.sirenButton,
            ])}
            text="Encender"
            text2="Sirena"
          />
        </View>
      )}

      <View style={[styles.buttonRow, { marginTop: altoBox / 20 }]}>
        <SecondaryButton
          onPress={disarm}
          name="pause-circle"
          styles={StyleSheet.flatten([
            styles.baseButtonContainer1,
            { height: altoBox - 20 },
            styles.deactivationButton,
          ])}
          text=""
          text2="Desactivar"
        />
      </View>

      <View style={[styles.buttonRow, { marginTop: altoBox / 20 }]}>
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <View style={styles.panicButtonWrapper}>
            <View style={[
              styles.panicButton, 
              { height: altoBox + 5 },
              { backgroundColor: isPanicActive ? "#EB7F27" : GlobalStyles.colors.titlecolor }
            ]}>
              {showProgressBar && (
                <Animated.View 
                  style={[
                    styles.progressFillContainer,
                    {
                      transform: [{ scale: scaleValue }],
                      opacity: opacityValue,
                    }
                  ]}
                >
                  <LinearGradient
                    colors={["#ffeb3b", "#ffc107", "#ff9800"]}
                    style={styles.progressFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                </Animated.View>
              )}
              <View style={styles.panicButtonContent}>
                <Ionicons 
                  name={isPanicActive ? "close-circle" : "warning"} 
                  size={60} 
                  color="white" 
                />
                <Text style={styles.textButton}>
                  {isPanicActive ? "CANCELAR EVENTO" : "Pánico"}
                </Text>
                {isPanicActive && (
                  <Text style={styles.holdToCancelText}>
                    Mantener presionado para cancelar
                  </Text>
                )}
              </View>
            </View>
          </View>
        </Pressable>
      </View>
    </ImageBackground>
  );
}; 

export default AllButtons;

const deviceWidth = Dimensions.get("window").width;

const styles = StyleSheet.create({
  rootScreen: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  baseButtonContainer: {
    margin: 8,
    width: deviceWidth * 0.42,
    borderRadius: 26,
    overflow: Platform.OS === "android" ? "hidden" : "visible",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  baseButtonContainer1: {
    padding: 30,
    margin: 8,
    width: deviceWidth * 0.9,
    height: 150,
    borderRadius: 26,
    overflow: Platform.OS === "android" ? "hidden" : "visible",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  lightButton: {
    backgroundColor: GlobalStyles.colors.accent500,
    opacity: 0.90,
  },
  sirenButton: {
    backgroundColor: GlobalStyles.colors.colorbuttonI,
    opacity: 0.90,
  },
  deactivationButton: {
    backgroundColor: GlobalStyles.colors.gray500,
    opacity: 0.90,
  },
  panicButtonWrapper: {
    width: deviceWidth * 0.9,
  },
  panicButton: {
    position: "relative",
    width: "100%",
    borderRadius: 26,
    overflow: "hidden",
    opacity: 0.90,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  progressFillContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  progressFill: {
    width: "200%",
    height: "200%",
    borderRadius: 1000,
  },
  panicButtonContent: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  textButton: {
    color: "white",
    fontSize: 15,
  },
  invitationContainer: {
    width: deviceWidth,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  invitationCardWrapper: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
  },
  invitationCard: {
    width: "100%",
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  invitationProgressContainer: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(34, 34, 102, 0.05)",
  },
  invitationProgressBar: {
    height: "100%",
    backgroundColor: "#EB7F27",
  },
  invitationIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(34, 34, 102, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  invitationTextContainer: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  statusText: {
    color: "#4CAF50",
    fontSize: 18,
    fontFamily: "open-sans-bold",
    marginLeft: 8,
  },
  invitationTitle: {
    color: "#222266",
    fontSize: 18,
    fontFamily: "open-sans-bold",
    marginBottom: 4,
  },
  invitationSubtitle: {
    color: "#666666",
    fontSize: 14,
    fontFamily: "open-sans",
    marginBottom: 4,
  },
  invitationOptional: {
    color: "#EB7F27",
    fontSize: 12,
    fontFamily: "open-sans-bold",
  },
  holdToCancelText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    fontFamily: "open-sans",
    marginTop: 4,
  },
});
