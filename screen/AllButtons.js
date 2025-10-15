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
} from "react-native";

import { GlobalStyles } from "../constans/Colors";
import { Ionicons } from "@expo/vector-icons";
import { savePost } from "../util/Api";
import { LinearGradient } from "expo-linear-gradient";
import SecondaryButton from "../component/SecondaryButton";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AllButtons = () => {
  const [showProgressBar, setShowProgressBar] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const startTimeRef = useRef(null);
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;
  const [altoBox, setAltoBox] = useState(screenHeight / 4);
  const [anchBox, setAnchBox] = useState(screenHeight / 4);
  const [backgroundImage, setBackgroundImage] = useState("https://i.imgur.com/OGxH3he.png");
  
  useEffect(() => {
    // Actualizar altoBox si la altura de la pantalla cambia
    setAltoBox(screenHeight / 4 - 20);
    setAnchBox(screenWidth / 10);
  }, [screenHeight]); // Solo cuando cambia la altura de la pantalla
  //console.log("ancho", anchBox, screenWidth, "alto", altoBox, screenHeight);

  useEffect(() => {
    // Cargar imagen de fondo desde AsyncStorage
    const loadPanicAppData = async () => {
      try {
        const storedData = await AsyncStorage.getItem("@licencias");
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          if (parsedData.panicAppData?.backgroundUrl) {
            setBackgroundImage(parsedData.panicAppData.backgroundUrl);
            console.log("Imagen de fondo cargada:", parsedData.panicAppData.backgroundUrl);
          }
        }
      } catch (error) {
        console.error("Error al cargar datos del panicapp:", error);
      }
    };
    loadPanicAppData();
  }, []);

  const handlePressIn = () => {
    setShowProgressBar(true);
    animatedValue.setValue(0);
    // Inicia la animación y usa el callback de start
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        // La barra de progreso se llenó
        enviarEvento("ALARM");
        setShowProgressBar(false);
      }
    });
  };

  const handlePressOut = () => {
    // Si se suelta antes de que la animación termine, se detiene
    animatedValue.stopAnimation();
    setShowProgressBar(false);
  };
  const barWidth = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const enviarEvento = async (eventType) => {
    Vibration.vibrate(500);
    try {
      const result = await savePost({
        eventCode: "120",
      });
      console.log(`${eventType} enviado`, result);
    } catch (error) {
      console.error(error);
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
          <View style={[styles.panicButton, , { height: altoBox + 5 }]}>
            <Ionicons name="warning" size={60} color="white" />
            <Text style={styles.textButton}>Pánico</Text>
          </View>
        </Pressable>
      </View>

      {showProgressBar && (
        <View style={styles.progressBarContainer}>
          <Animated.View style={{ width: barWidth }}>
            <LinearGradient
              colors={["#ff7e5f", "#feb47b"]}
              style={styles.progressBar}
            />
          </Animated.View>
        </View>
      )}
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
    elevation: 4,
    shadowColor: "black",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
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
    elevation: 4,
    shadowColor: "black",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  lightButton: {
    backgroundColor: GlobalStyles.colors.accent500,
  },
  sirenButton: {
    backgroundColor: GlobalStyles.colors.colorbuttonI,
  },
  deactivationButton: {
    backgroundColor: GlobalStyles.colors.gray500,
  },
  panicButton: {
    width: deviceWidth * 0.9,
    borderRadius: 8,
    overflow: Platform.OS === "android" ? "hidden" : "visible",
    backgroundColor: GlobalStyles.colors.titlecolor,
    elevation: 4,
    shadowColor: "black",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textButton: {
    color: "white",
    fontSize: 15,
  },
  progressBarContainer: {
    width: "100%",
    height: 15,
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 10,
  },
  progressBar: {
    height: "100%",
    borderRadius: 8,
  },
});
