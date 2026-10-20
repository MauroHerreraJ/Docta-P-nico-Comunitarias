import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://bcc447a33fe91fb113d98cd8e40510de@o4511473782161408.ingest.us.sentry.io/4511473784782848",
  debug: false, // Si está en true, verás logs de Sentry en la terminal
});

import { StatusBar } from "expo-status-bar";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, View, Text, TouchableOpacity, StyleSheet, Alert, Animated, Platform, AppState } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState, useRef } from "react";
import * as Linking from 'expo-linking';
import * as Application from 'expo-application';

// Mantener el Splash Screen visible mientras se cargan los recursos
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Ignorar errores si ya se está ocultando o en modo desarrollo */
});
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import AllButtons from "./screen/AllButtons";
import Configuration from "./screen/Configuration";
import User from "./screen/User";
import Welcome from "./screen/Welcome";
import MasterCode from "./screen/MasterCode";
import Multimedia from "./screen/Multimedia";
import { getPanicAppByCode, registerNotificationToken, onUnauthorized, onLicenseDisabled, onLicenseDeleted, fetchChatMessages, checkDeviceStatus, isLicenseDisabledPayload, isLicenseDisabledError, isLicenseDeletedError, clearDocta4LocalSession, LICENSE_DELETED_KEY } from "./util/Api";
import { extractOnboardingCode } from "./util/onboardingCode";
import { registerForPushNotificationsAsync } from "./util/Notifications";
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';

const Stack = createNativeStackNavigator();
const BottomTabs = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

const LAST_NOTIF_ID_KEY = "@last_handled_notification_id";
const CHAT_WATERMARK_KEY = "@chat_watermark";

const parseNotificationData = (content) => {
  if (!content) return {};
  let data = content.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = {};
    }
  }
  return data && typeof data === "object" ? data : {};
};

const getNotificationTipo = (content) => {
  const data = parseNotificationData(content);
  return String(data.tipo || data.type || "").toLowerCase();
};

const isChatNotification = (content) => {
  const tipo = getNotificationTipo(content);
  if (tipo === "chat") return true;
  return /tenés un mensaje nuevo|tenes un mensaje nuevo|mensaje nuevo/i.test(content?.body || "");
};

const getCurrentRouteName = () => {
  if (!navigationRef.isReady()) return null;
  let route = navigationRef.getRootState()?.routes?.[navigationRef.getRootState().index];
  while (route?.state?.routes) {
    route = route.state.routes[route.state.index];
  }
  return route?.name || null;
};

// 🔹 Función para obtener la clave de almacenamiento según el producto
const getStorageKey = (product) => {
  if (!product || product === "docta_panico" || product === "docta_legacy") return "@licencias";
  return `@licencias_${product}`;
};

const PulseIcon = ({ name, size, color }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
};

const ChatTabIcon = ({ color, size, unread }) => (
  <View>
    <Ionicons name="chatbubbles" size={size} color={color} />
    {unread ? <View style={styles.unreadDot} /> : null}
  </View>
);

function LicenseDisabledModal({ visible, onAccept }) {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onAccept}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Ionicons name="lock-closed" size={80} color="#E74C3C" />
          <Text style={styles.modalTitle}>Cuenta deshabilitada</Text>
          <Text style={styles.modalBody}>
            Su cuenta está deshabilitada, comuníquese con su administrador.
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onAccept}>
            <Text style={styles.closeButtonText}>ACEPTAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function LicenseDeletedModal({ visible, onAccept }) {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Ionicons name="trash" size={80} color="#E74C3C" />
          <Text style={styles.modalTitle}>Licencia eliminada</Text>
          <Text style={styles.modalBody}>
            Licencia eliminada, contactarse con administrador.
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onAccept}>
            <Text style={styles.closeButtonText}>ACEPTAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function EventModal({ visible, onClose, eventData, onOpenChat }) {
  if (!eventData) return null;

  const isChat = eventData.kind === "chat";

  // Función para resaltar el número de equipo en el cuerpo del mensaje
  const renderBody = (text) => {
    if (!text) return "La alarma ha sonado exitosamente en la calle.";
    
    // Buscamos el número de equipo (ej: 1005)
    const teamMatch = text.match(/(\d{4})/);
    if (teamMatch) {
      const parts = text.split(teamMatch[0]);
      return (
        <Text style={styles.modalBody}>
          {parts[0]}
          <Text style={styles.boldText}>{teamMatch[0]}</Text>
          {parts[1]}
        </Text>
      );
    }
    return <Text style={styles.modalBody}>{text}</Text>;
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Ionicons
            name={isChat ? "chatbubbles" : "notifications-circle"}
            size={80}
            color={isChat ? "#222266" : "#E74C3C"}
          />
          <Text style={styles.modalTitle}>
            {isChat ? "Tenés un mensaje nuevo" : (eventData.title || "!Alarma Activada!")}
          </Text>
          {isChat ? (
            <Text style={styles.modalBody}>La central de monitoreo te escribió.</Text>
          ) : (
            renderBody(eventData.body)
          )}

          {isChat ? (
            <>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  if (typeof onOpenChat === "function") onOpenChat();
                }}
              >
                <Text style={styles.closeButtonText}>VER MENSAJE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                <Text style={styles.secondaryButtonText}>CERRAR</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>ENTENDIDO</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ⚙️ CONFIGURACIÓN DE ACTUALIZACIÓN
// Cambia a 0 para forzar actualización en cada inicio (útil para desarrollo)
// Cambia a 24 para actualizar cada 24 horas (recomendado para producción)
const UPDATE_INTERVAL_HOURS = 24; // Cambia a 0 para testing

// Función de migración y actualización para usuarios existentes
async function migrateExistingUsers(storedData, product) {
  try {
    const parsedData = JSON.parse(storedData);
    
    // Verificar si tiene panicAppCode en la licencia
    const panicAppCode = parsedData.result?.licenseCreated?.panicAppCode;
    if (!panicAppCode) {
      console.log("No se encontró panicAppCode, no se puede actualizar");
      return;
    }
    
    // Verificar si necesita actualización
    const needsUpdate = shouldUpdatePanicAppData(parsedData);
    
    if (!needsUpdate) {
      console.log("Los datos del panicApp están actualizados");
      return;
    }
    
    console.log("Actualizando datos del panicAppCode:", panicAppCode);
    
    // Obtener los datos actualizados del panicapp desde la API
    const panicAppData = await getPanicAppByCode(panicAppCode);
    
    // Actualizar AsyncStorage con los nuevos datos
    const updatedData = {
      ...parsedData,
      panicAppData: panicAppData,
      lastPanicAppUpdate: new Date().toISOString() // Timestamp de última actualización
    };
    
    const specificKey = getStorageKey(product);
    await AsyncStorage.setItem(specificKey, JSON.stringify(updatedData));
    console.log(`Datos del panicApp actualizados exitosamente en ${specificKey}`);
    
  } catch (error) {
    console.error("Error durante la actualización:", error);
    // No lanzamos el error para que la app continúe funcionando
    // aunque la actualización falle
  }
}

// Función que determina si se deben actualizar los datos
function shouldUpdatePanicAppData(parsedData) {
  // Si no tiene panicAppData, necesita actualización (primera vez)
  if (!parsedData.panicAppData) {
    console.log("No tiene panicAppData, requiere actualización inicial");
    return true;
  }
  
  // Si no tiene timestamp de última actualización, actualizar
  if (!parsedData.lastPanicAppUpdate) {
    console.log("No tiene timestamp de actualización, actualizando");
    return true;
  }
  
  // Verificar si han pasado más de X horas desde la última actualización
  const lastUpdate = new Date(parsedData.lastPanicAppUpdate);
  const now = new Date();
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  
  if (hoursSinceUpdate >= UPDATE_INTERVAL_HOURS) {
    console.log(`Han pasado ${hoursSinceUpdate.toFixed(1)} horas, actualizando datos`);
    return true;
  }
  
  console.log(`Última actualización hace ${hoursSinceUpdate.toFixed(1)} horas, no requiere actualización`);
  return false;
}

function confirmLeaveMultimedia(onLeave) {
  Alert.alert(
    "¿Abandonar Multimedia?",
    "Si sale de esta pantalla, no podrá adjuntar más información a este reporte.",
    [
      { text: "Continuar Reportando", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: onLeave,
      },
    ]
  );
}

function multimediaTabGuard(onFinalize) {
  return ({ navigation }) => ({
    tabPress: (e) => {
      const state = navigation.getState();
      const currentRoute = state.routes[state.index];
      if (currentRoute?.name !== "Multimedia") return;

      const targetRoute = state.routes.find((route) => route.key === e.target);
      if (!targetRoute || targetRoute.name === "Multimedia") return;

      e.preventDefault();
      confirmLeaveMultimedia(() => {
        if (typeof onFinalize === "function") onFinalize();
        navigation.navigate(targetRoute.name);
      });
    },
  });
}

function AuthorizedNavigation({ activeProduct, pendingOpenChat, onChatOpened, showChatTab, chatUnread, onChatTabOpened, onChatTabClosed }) {
  const [logoUrl, setLogoUrl] = useState("https://i.imgur.com/aIYhRsN.png");
  const [headerBgColor, setHeaderBgColor] = useState("white");
  const [headerTxtColor, setHeaderTxtColor] = useState("Black");
  const [isMultimediaEnabled, setIsMultimediaEnabled] = useState(false);
  const [activePanicId, setActivePanicId] = useState(null);
  const [chatWatermark, setChatWatermark] = useState(0);
  const [chatSessionNonce, setChatSessionNonce] = useState(0);
  const [resumeChat, setResumeChat] = useState(false);
  const timerRef = useRef(null);
  const tabNavRef = useRef(null);

  const startNewChatSession = async () => {
    try {
      const prev = Number((await AsyncStorage.getItem(CHAT_WATERMARK_KEY)) || 0);
      const data = await fetchChatMessages(prev);
      const watermark = data?.ultima_secuencia != null ? data.ultima_secuencia : prev;
      await AsyncStorage.setItem(CHAT_WATERMARK_KEY, String(watermark));
      setChatWatermark(watermark);
      console.log("💬 Chat nuevo. Corte de secuencia:", watermark);
    } catch (e) {
      console.warn("No se pudo cortar el historial de chat:", e);
    } finally {
      setResumeChat(false);
      setChatSessionNonce((n) => n + 1);
    }
  };

  const activateMultimedia = (serverResult, options = {}) => {
    // Si es un usuario Legacy (Desit Server), no habilitamos Multimedia
    if (activeProduct === "docta_legacy") {
      console.log("ℹ️ Multimedia no disponible para producto Legacy");
      return;
    }

    const id = serverResult?.id || serverResult?.event_id || null;
    console.log("🔔 Multimedia activada. ID de evento vinculado:", id);
    
    setActivePanicId(id);
    setIsMultimediaEnabled(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (options.keepOpen) {
      setResumeChat(true);
      return;
    }

    startNewChatSession();
    
    // Auto-cierre en 5 minutos (pánico reciente). El chat reabierto por push no se cierra solo.
    timerRef.current = setTimeout(() => {
      setIsMultimediaEnabled(false);
      setActivePanicId(null);
    }, 300000);
  };

  const deactivateMultimedia = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsMultimediaEnabled(false);
    setActivePanicId(null);
  };

  const leaveChat = () => {
    deactivateMultimedia();
    if (typeof onChatTabClosed === "function") onChatTabClosed();
  };

  useEffect(() => {
    const loadPanicAppData = async () => {
      try {
        const specificKey = getStorageKey(activeProduct);
        const storedData = await AsyncStorage.getItem(specificKey);
        console.log(`📦 AuthorizedNavigation (${activeProduct}): Verificando AsyncStorage en ${specificKey}...`);
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          console.log("📦 panicAppData encontrado:", parsedData.panicAppData ? "SÍ" : "NO");
          if (parsedData.panicAppData) {
            if (parsedData.panicAppData.logoUrl) {
              console.log("🖼️ Logo URL encontrada:", parsedData.panicAppData.logoUrl);
              setLogoUrl(parsedData.panicAppData.logoUrl);
            } else {
              console.log("⚠️ No hay logoUrl, usando URL por defecto");
            }
            if (parsedData.panicAppData.headerBackgroundColor) {
              setHeaderBgColor(parsedData.panicAppData.headerBackgroundColor);
            }
            if (parsedData.panicAppData.headerTextColor) {
              setHeaderTxtColor(parsedData.panicAppData.headerTextColor);
            }
          } else {
            console.log("⚠️ No existe panicAppData en AsyncStorage");
          }
        } else {
          console.log("⚠️ No hay datos en AsyncStorage");
        }
      } catch (error) {
        console.error("❌ Error al cargar datos del panicapp en header:", error);
      }
    };
    loadPanicAppData();
  }, []);

  useEffect(() => {
    const loadChatWatermark = async () => {
      try {
        const stored = await AsyncStorage.getItem(CHAT_WATERMARK_KEY);
        if (stored != null) setChatWatermark(Number(stored) || 0);
      } catch (e) {
        console.warn("No se pudo leer el corte de chat:", e);
      }
    };
    loadChatWatermark();
  }, []);

  useEffect(() => {
    if (!pendingOpenChat || activeProduct === "docta_legacy") return;

    activateMultimedia({ fromPush: true }, { keepOpen: true });
    let cancelled = false;
    const tryNavigate = (attempt = 0) => {
      if (cancelled) return;
      const tabNav = tabNavRef.current;
      if (tabNav?.navigate) {
        tabNav.navigate("Multimedia");
        if (typeof onChatOpened === "function") onChatOpened();
        return;
      }
      if (navigationRef.isReady()) {
        navigationRef.navigate("Principal", { screen: "Multimedia" });
        if (typeof onChatOpened === "function") onChatOpened();
        return;
      }
      if (attempt < 12) {
        setTimeout(() => tryNavigate(attempt + 1), 200);
      }
    };
    const timer = setTimeout(() => tryNavigate(0), 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pendingOpenChat, activeProduct]);

  return (
    <BottomTabs.Navigator
      ref={tabNavRef}
      screenListeners={multimediaTabGuard(leaveChat)}
      screenOptions={{
        headerStyle: { backgroundColor: headerBgColor, height: 120 },
        headerTintColor: headerTxtColor,
        tabBarLabelStyle: { fontSize: 13, width: "100%", paddingBottom: 1 },
        headerTitleAlign: 'center',
        tabBarHideOnKeyboard: true,
      }}
    >
      <BottomTabs.Screen
        name="Desit"
        options={{
          title: "",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          headerTitle: () => (
            <Image
              source={{ uri: logoUrl }}
              style={{ width: 230, height: 80, marginTop: -20 }}
              resizeMode="contain"
            />
          ),
          headerTitleContainerStyle: {
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
        }}
      >
        {(props) => (
          <AllButtons 
            {...props} 
            activeProduct={activeProduct}
            onPanicSuccess={activateMultimedia} 
            onPanicCancel={deactivateMultimedia} 
            externalPanicId={activePanicId}
          />
        )}
      </BottomTabs.Screen>

      {/* Chat: oculto hasta un mensaje nuevo; al salir de Multimedia desaparece */}
      {activeProduct !== "docta_legacy" && (
        <BottomTabs.Screen
          name="Multimedia"
          options={{
            title: "",
            tabBarLabel: "Chat",
            ...(showChatTab ? {} : { tabBarButton: () => null }),
            tabBarIcon: ({ color, size }) => (
              <ChatTabIcon color={color} size={size} unread={chatUnread} />
            ),
            headerTitle: () => (
              <Image
                source={{ uri: logoUrl }}
                style={{ width: 230, height: 80, marginTop: -20 }}
                resizeMode="contain"
              />
            ),
            headerTitleContainerStyle: {
              left: 0,
              right: 0,
              alignItems: 'center',
              justifyContent: 'center',
            },
          }}
          listeners={{
            tabPress: () => {
              activateMultimedia({ fromChatTab: true }, { keepOpen: true });
              if (typeof onChatTabOpened === "function") onChatTabOpened();
            },
          }}
        >
          {(props) => (
            <Multimedia 
              {...props} 
              panicId={activePanicId}
              chatWatermark={chatWatermark}
              chatSessionNonce={chatSessionNonce}
              resumeChat={resumeChat}
              onFinalize={leaveChat} 
            />
          )}
        </BottomTabs.Screen>
      )}

      <BottomTabs.Screen
        name="User"
        options={{
          title: "",
          tabBarLabel: "Sistema",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
          headerTitle: () => (
            <Image
              source={{ uri: logoUrl }}
              style={{ width: 230, height: 80, marginTop: -20 }}
              resizeMode="contain"
            />
          ),
          headerTitleContainerStyle: {
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
        }}
      >
        {(props) => <User {...props} activeProduct={activeProduct} />}
      </BottomTabs.Screen>
    </BottomTabs.Navigator>
  );
}

function NoAuthorizedNavigation({ activeProduct, onAuthorized, activationData, initialOnboardingCode }) {
  const isDocta = activeProduct === "docta_panico" || activeProduct === "docta_comunitarias";
  const initialRoute = isDocta ? "Configuration" : "Welcome";
  
  return (
    <BottomTabs.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerStyle: { backgroundColor: "#0F76C4", height: 120 },
        headerTintColor: "black",
        headerTitleAlign: 'center',
        tabBarStyle: { display: 'none' },
      }}
    >
      {/* Welcome sigue existiendo para otros productos o por si se necesita */}
      <BottomTabs.Screen
        name="Welcome"
        options={{
          headerShown: false,
        }}
      >
        {(props) => (
          <Welcome 
            {...props} 
            activeProduct={activeProduct} 
            onAuthorized={onAuthorized} 
          />
        )}
      </BottomTabs.Screen>

      <BottomTabs.Screen
        name="Configuration"
        options={{
          headerTitle: "Configuración",
        }}
      >
        {(props) => (
          <Configuration 
            {...props} 
            activeProduct={activeProduct}
            onAuthorized={onAuthorized}
            initialData={activationData}
            initialOnboardingCode={initialOnboardingCode}
          />
        )}
      </BottomTabs.Screen>
    </BottomTabs.Navigator>
  );
}

function ProductSpecificNavigation({ onReset }) {
  const [productName, setProductName] = useState("Vigilantes");
  const [logoUrl, setLogoUrl] = useState("https://i.imgur.com/aIYhRsN.png");
  const [isMultimediaEnabled, setIsMultimediaEnabled] = useState(false);
  const [activePanicId, setActivePanicId] = useState(null);
  const timerRef = useRef(null);

  const activateMultimedia = (serverResult) => {
    // Para simulaciones, generamos un ID si no viene del servidor
    const id = serverResult?.id || serverResult?.event_id || "SIM-" + Date.now();
    console.log("🔔 Multimedia activada (Vigi). ID vinculado:", id);
    
    setActivePanicId(id);
    setIsMultimediaEnabled(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsMultimediaEnabled(false);
      setActivePanicId(null);
    }, 300000); // 5 min
  };

  const deactivateMultimedia = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsMultimediaEnabled(false);
    setActivePanicId(null);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const masterData = await AsyncStorage.getItem("@master_config");
        if (masterData) {
          const parsed = JSON.parse(masterData);
          if (parsed.product === "vigilantes") setProductName("Vigilantes");
          else if (parsed.product === "ciudadanos") setProductName("Ciudadanos");
          else setProductName(parsed.product.charAt(0).toUpperCase() + parsed.product.slice(1));
        }
      } catch (error) {
        console.error("Error loading master config in ProductSpecificNavigation:", error);
      }
    };
    loadData();
  }, []);

  const resetToWelcome = async () => {
    Alert.alert("Reiniciar", "¿Desea volver a la configuración inicial del producto?", [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Sí, reiniciar", 
        onPress: async () => {
          onReset(false); 
          
          const specificKey = getStorageKey(productName.toLowerCase());
          await AsyncStorage.removeItem(specificKey);
          
          try {
            // await Updates.reloadAsync();
          } catch (e) {
            console.log("Reload abortado");
          }
        } 
      }
    ]);
  };

  const resetToMaster = async () => {
    Alert.alert("Master Reset", "Esto borrará TODO y permitirá ingresar un nuevo código maestro.", [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Sí, borrar todo", 
        style: "destructive",
        onPress: async () => {
          onReset(true); 
          
          const specificKey = getStorageKey(productName.toLowerCase());
          await AsyncStorage.removeItem(specificKey);
          await AsyncStorage.removeItem("@master_config");
          await AsyncStorage.removeItem("@master_token");
          
          try {
            // await Updates.reloadAsync();
          } catch (e) {
            console.log("Reload abortado");
          }
        } 
      }
    ]);
  };

  return (
    <BottomTabs.Navigator
      screenListeners={multimediaTabGuard(deactivateMultimedia)}
      screenOptions={{
        headerStyle: { backgroundColor: 'white', height: 120 },
        headerTintColor: '#222266',
        headerTitleAlign: 'center',
        tabBarHideOnKeyboard: true,
      }}
    >
      <BottomTabs.Screen
        name="ProductHome"
        options={{
          title: "",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          headerTitle: productName,
          headerTitleStyle: { fontSize: 24, fontWeight: 'bold' }
        }}
      >
        {() => (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' }}>
            <Ionicons name="shield-checkmark-outline" size={100} color="#222266" />
            <Text style={{ fontSize: 32, fontFamily: 'open-sans-bold', color: '#222266', marginTop: 20 }}>
              {productName}
            </Text>
            <Text style={{ fontSize: 16, fontFamily: 'open-sans', color: '#666', marginTop: 10 }}>
              Panel de Control Activo
            </Text>
            <TouchableOpacity 
              onPress={activateMultimedia}
              style={{ marginTop: 20, backgroundColor: '#E74C3C', padding: 10, borderRadius: 10 }}
            >
              <Text style={{ color: 'white' }}>SIMULAR PÁNICO (Activar Multimedia)</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomTabs.Screen>

      {/* 📸 PESTAÑA MULTIMEDIA (Registrada pero oculta de la barra inferior) */}
      <BottomTabs.Screen
        name="Multimedia"
        options={{
          tabBarButton: () => null, // Ocultar de la barra inferior
          headerTitle: productName,
          headerTitleStyle: { fontSize: 24, fontWeight: 'bold' }
        }}
      >
        {(props) => (
          <Multimedia 
            {...props} 
            panicId={activePanicId}
            resumeChat
            chatSessionNonce={1}
            onFinalize={deactivateMultimedia} 
          />
        )}
      </BottomTabs.Screen>

      <BottomTabs.Screen
        name="User"
        options={{
          title: "",
          tabBarLabel: "Sistema",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
          headerTitle: "Sistema",
        }}
      >
        {() => (
          <View style={{ flex: 1, padding: 30, justifyContent: 'center', backgroundColor: '#F5F7FA' }}>
            <Text style={{ textAlign: 'center', marginBottom: 40, fontSize: 18, color: '#666', fontFamily: 'open-sans' }}>
              Gestión de {productName}
            </Text>

            <TouchableOpacity 
              onPress={resetToWelcome}
              style={{ backgroundColor: '#EB7F27', padding: 18, borderRadius: 12, marginBottom: 20, elevation: 3 }}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
                REINICIAR CONFIGURACIÓN (Ir a Welcome)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={resetToMaster}
              style={{ backgroundColor: '#222266', padding: 18, borderRadius: 12, elevation: 3 }}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
                CAMBIAR DE PRODUCTO (Ir a Master Code)
              </Text>
            </TouchableOpacity>
            
            <Text style={{ marginTop: 50, textAlign: 'center', color: '#AAA', fontSize: 12 }}>
              Desit SA - Desarrollo Independiente
            </Text>
          </View>
        )}
      </BottomTabs.Screen>
    </BottomTabs.Navigator>
  );
}

function App() {
  const [fontsLoaded] = useFonts({
    "open-sans": require("./fonts/OpenSans-Regular.ttf"),
    "open-sans-bold": require("./fonts/OpenSans-Bold.ttf"),
  });

  const [appIsReady, setAppIsReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [hasMasterCode, setHasMasterCode] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);
  const [activationData, setActivationData] = useState(null); // Nuevo: Datos del flujo maestro
  const [deepLinkCode, setDeepLinkCode] = useState(null);

  const handleActivated = (product, extraData = null) => {
    setActiveProduct(product);
    setActivationData(extraData);
    setHasMasterCode(true);
  };
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventData, setEventData] = useState(null);
  const [pendingOpenChat, setPendingOpenChat] = useState(false);
  const [showChatTab, setShowChatTab] = useState(false);
  const [chatUnread, setChatUnread] = useState(false);
  const [licenseDisabled, setLicenseDisabled] = useState(false);
  const [licenseDeleted, setLicenseDeleted] = useState(false);
  const licenseDisabledDismissedRef = useRef(false);

  onUnauthorized(() => {
    console.log("⚠️ App detectó 401: Redirigiendo a configuración...");
    licenseDisabledDismissedRef.current = false;
    setLicenseDisabled(false);
    setIsAuthorized(false);
  });
  onLicenseDisabled(() => {
    console.log("🚫 Licencia deshabilitada: se muestra aviso y se conserva la sesión.");
    licenseDisabledDismissedRef.current = false;
    setLicenseDeleted(false);
    setLicenseDisabled(true);
  });
  onLicenseDeleted(() => {
    console.log("🗑️ Licencia dada de baja: se muestra aviso para volver a Master.");
    setLicenseDisabled(false);
    setLicenseDeleted(true);
  });

  const acceptLicenseDeleted = async () => {
    try {
      await clearDocta4LocalSession();
    } catch (e) {
      console.warn("No se pudo limpiar la sesión local:", e);
    }
    setLicenseDeleted(false);
    setLicenseDisabled(false);
    setIsAuthorized(false);
    setHasMasterCode(false);
    setActiveProduct(null);
    setActivationData(null);
  };

  const dismissLicenseDisabled = () => {
    licenseDisabledDismissedRef.current = true;
    setLicenseDisabled(false);
  };

  useEffect(() => {
    const markHandled = async (identifier) => {
      if (!identifier) return true;
      const seen = await AsyncStorage.getItem(LAST_NOTIF_ID_KEY);
      if (seen === identifier) return false;
      await AsyncStorage.setItem(LAST_NOTIF_ID_KEY, identifier);
      return true;
    };

    const openChatFromPush = () => {
      console.log("📬 Push de chat: se reabre Multimedia");
      setShowChatTab(true);
      setChatUnread(false);
      setPendingOpenChat(true);
    };

    const handleEventNotification = (content, { userTapped = false } = {}) => {
      if (!content) return;

      console.log("Procesando contenido de notificación:", content);
      const tipo = getNotificationTipo(content);

      if (isChatNotification(content)) {
        if (userTapped) {
          setShowEventModal(false);
          openChatFromPush();
          return;
        }
        if (getCurrentRouteName() === "Multimedia") return;
        setEventData({
          kind: "chat",
          title: "Tenés un mensaje nuevo",
          body: content.body || "Tenés un mensaje nuevo",
        });
        setShowEventModal(true);
        return;
      }

      if (tipo === "cambio_celular") {
        return;
      }

      const body = content.body || "La alarma de su zona se ha activado.";
      setEventData({
        title: "!Alarma Activada!",
        body: body,
        data: content.data || {}
      });
      setShowEventModal(true);
    };

    const checkInitialNotification = async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response && response.notification) {
          const identifier = response.notification.request?.identifier;
          const isNew = await markHandled(identifier);
          if (!isNew) return;
          console.log("App abierta desde notificación (inicial):", response);
          handleEventNotification(response.notification.request.content, { userTapped: true });
        }
      } catch (error) {
        console.error("Error al obtener la notificación inicial:", error);
      }
    };

    checkInitialNotification();

    // Registro de notificaciones al iniciar si ya está autorizado
    const setupNotifications = async () => {
      try {
        const specificKey = getStorageKey(activeProduct);
        const data = await AsyncStorage.getItem(specificKey);
        if (data) {
          const parsedData = JSON.parse(data);
          const licenseCode = parsedData.result?.licenseCreated?.code;
          if (licenseCode) {
            registerForPushNotificationsAsync(licenseCode).then(token => setExpoPushToken(token));
          }
        }
      } catch (e) {
        console.warn("Error en setup de notificaciones:", e);
      }
    };
    
    setupNotifications();

    // Listener para cuando llega una notificación mientras la app está abierta
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      handleEventNotification(notification.request.content, { userTapped: false });
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
      console.log("Notificación tocada:", response);
      if (response && response.notification) {
        const identifier = response.notification.request?.identifier;
        const isNew = await markHandled(identifier);
        if (!isNew) return;
        handleEventNotification(response.notification.request.content, { userTapped: true });
      }
    });

    // Listener para cuando el token de notificación cambia (refresco de token)
    const pushTokenListener = Notifications.addPushTokenListener(async ({ data: token }) => {
      console.log("El token de notificación ha cambiado:", token);
      try {
        const specificKey = getStorageKey(activeProduct);
        const data = await AsyncStorage.getItem(specificKey);
        if (data) {
          const parsedData = JSON.parse(data);
          const licenseCode = parsedData.result?.licenseCreated?.code;
          if (licenseCode) {
            await registerNotificationToken(licenseCode, token);
            console.log("Token refrescado y registrado exitosamente");
          }
        }
      } catch (error) {
        console.error("Error al procesar el refresco del token:", error);
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
      pushTokenListener.remove();
    };
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        // Precargar todos los assets locales (imágenes)
        console.log("🖼️ Precargando assets locales...");
        await Asset.loadAsync([
          require("./assets/logonuevo.png"),
          require("./assets/126353.jpg"),
          require("./assets/icon.png"),
          require("./assets/adaptive-icon.png"),
          require("./assets/splash-icon.png"),
          require("./assets/botonpanico.png"),
          require("./assets/cba-logo2.png"),
          require("./assets/cba-logo3.png"),
          require("./assets/civico.jpg"),
          require("./assets/logo_villamaria.png"),
          require("./assets/puenteVillaMaria.jpg"),
          require("./assets/favicon.png"),
        ]);
        console.log("✅ Assets locales precargados exitosamente");
        
        // Preload fonts or any other task
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        const masterData = await AsyncStorage.getItem("@master_config");
        let activeProd = null;

        if (masterData !== null) {
          const parsedMaster = JSON.parse(masterData);
          activeProd = parsedMaster.product;
          setHasMasterCode(true);
          setActiveProduct(activeProd);
          
          // Reconstruir los datos de activación para la persistencia entre recargas
          setActivationData({
            initialStep: 2,
            masterConfig: parsedMaster,
            panicAppData: parsedMaster.panicAppData,
            onboardingInfo: parsedMaster.onboardingInfo
          });

          // Verificamos la licencia específica de este producto
          const specificKey = getStorageKey(activeProd);
          const licenseData = await AsyncStorage.getItem(specificKey);

          if (licenseData !== null) {
            setIsAuthorized(true);
            if (activeProd === "docta_panico") {
              await migrateExistingUsers(licenseData, activeProd);
            }
          }

          const deletedFlag = await AsyncStorage.getItem(LICENSE_DELETED_KEY);
          if (deletedFlag === "1") {
            setLicenseDeleted(true);
          }
        } else {
          // CASO LEGACY: No hay master_config, buscamos la licencia original
          const legacyData = await AsyncStorage.getItem("@licencias");
          if (legacyData !== null) {
            setIsAuthorized(true);
            setActiveProduct("docta_legacy"); // Identificado como Producto Legacy
            await migrateExistingUsers(legacyData, "docta_legacy");
          } else {
            setHasMasterCode(false);
            setActiveProduct(null);
          }
        }

        // App Link de arranque (app cerrada) + Install Referrer de Play (primera instalación)
        try {
          const initialUrl = await Linking.getInitialURL();
          const codeFromLink = extractOnboardingCode(initialUrl);
          if (codeFromLink) {
            console.log("✅ Código extraído de App Link inicial:", codeFromLink);
            setDeepLinkCode(codeFromLink);
          } else if (Platform.OS === "android") {
            const referrerChecked = await AsyncStorage.getItem("@install_referrer_checked");
            if (!referrerChecked) {
              try {
                const referrer = await Application.getInstallReferrerAsync();
                console.log("📦 Install Referrer de Play:", referrer);
                const codeFromReferrer = extractOnboardingCode(referrer);
                if (codeFromReferrer) {
                  console.log("✅ Código extraído de Install Referrer:", codeFromReferrer);
                  setDeepLinkCode(codeFromReferrer);
                }
              } catch (refError) {
                console.warn("No se pudo leer Install Referrer:", refError?.message || refError);
              }
              await AsyncStorage.setItem("@install_referrer_checked", "1");
            }
          }
        } catch (linkError) {
          console.warn("Error leyendo App Link / Referrer:", linkError);
        }
      } catch (e) {
        console.warn("❌ Error durante la preparación:", e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    const isDocta4Product =
      activeProduct === "docta_panico" || activeProduct === "docta_comunitarias";
    if (!isAuthorized || !isDocta4Product) return undefined;

    let cancelled = false;
    const verifyLicense = async () => {
      try {
        const data = await checkDeviceStatus({ silent: true });
        if (cancelled) return;
        if (isLicenseDisabledPayload(data)) {
          if (!licenseDisabledDismissedRef.current) setLicenseDisabled(true);
        } else {
          licenseDisabledDismissedRef.current = false;
          if (licenseDisabled) setLicenseDisabled(false);
        }
      } catch (error) {
        if (cancelled) return;
        if (isLicenseDeletedError(error)) {
          licenseDisabledDismissedRef.current = false;
          setLicenseDisabled(false);
          setLicenseDeleted(true);
          try {
            await AsyncStorage.setItem(LICENSE_DELETED_KEY, "1");
          } catch (e) {}
          return;
        }
        if (isLicenseDisabledError(error) && !licenseDisabledDismissedRef.current) {
          setLicenseDisabled(true);
        }
      }
    };

    verifyLicense();
    const intervalMs = licenseDisabled ? 8000 : 30000;
    const intervalId = setInterval(verifyLicense, intervalMs);
    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active") verifyLicense();
    });

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      appStateSub.remove();
    };
  }, [isAuthorized, activeProduct, licenseDisabled]);

  useEffect(() => {
    const handleDeepLink = (url) => {
      if (!url) return;
      console.log("🔗 Deep Link detectado:", url);
      const code = extractOnboardingCode(url);
      if (code) {
        console.log("✅ Código extraído de Deep Link:", code);
        setDeepLinkCode(code);
      }
    };

    // 1. Manejar URL inicial (si la app estaba cerrada)
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink(url);
    });

    // 2. Escuchar cambios de URL (si la app estaba en segundo plano)
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded && appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, appIsReady]);

  if (!fontsLoaded || !appIsReady) {
    return null; // or a custom loading component
  }
  return (
    <>
      <StatusBar style="dark" />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { height: 120 },
            headerTitleAlign: 'center',
          }}
        >
          {!isAuthorized ? (
            // FLUJO DE ACTIVACIÓN / CONFIGURACIÓN
            !hasMasterCode ? (
              <Stack.Screen 
                name="MasterCode" 
                options={{ 
                  headerShown: false,
                }}
              >
                {(props) => (
                  <MasterCode 
                    {...props} 
                    onActivated={handleActivated} 
                    initialCode={deepLinkCode}
                  />
                )}
              </Stack.Screen>
            ) : (
              // Ya tiene código máster, todos van a la configuración (Welcome -> Configuration)
              <Stack.Screen
                name="Secondary"
                options={{ 
                  headerShown: false,
                }}
              >
                {(props) => (
                  <NoAuthorizedNavigation 
                    {...props} 
                    activeProduct={activeProduct}
                    activationData={activationData}
                    initialOnboardingCode={deepLinkCode}
                    onAuthorized={() => setIsAuthorized(true)}
                  />
                )}
              </Stack.Screen>
            )
          ) : (
            // FLUJO DE APP ACTIVA
            (activeProduct === "docta_panico" || activeProduct === "docta_legacy" || activeProduct === "docta_comunitarias") ? (
              <Stack.Screen
                name="Principal"
                options={{ headerShown: false }}
              >
                {(props) => (
                  <AuthorizedNavigation
                    {...props}
                    activeProduct={activeProduct}
                    pendingOpenChat={pendingOpenChat}
                    onChatOpened={() => setPendingOpenChat(false)}
                    showChatTab={showChatTab}
                    chatUnread={chatUnread}
                    onChatTabOpened={() => setChatUnread(false)}
                    onChatTabClosed={() => {
                      setShowChatTab(false);
                      setChatUnread(false);
                    }}
                  />
                )}
              </Stack.Screen>
            ) : (
              // Nueva navegación para otros productos (Vigilantes, Ciudadanos, etc.)
              <Stack.Screen 
                name="ProductSpecific" 
                options={{ headerShown: false }} 
              >
                {(props) => (
                  <ProductSpecificNavigation 
                    {...props} 
                    onReset={(resetAll) => {
                      setIsAuthorized(false);
                      if (resetAll) {
                        setHasMasterCode(false);
                        setActiveProduct(null);
                      }
                    }}
                  />
                )}
              </Stack.Screen>
            )
          )}
          
          {/* Pantallas comunes o modales */}
          <Stack.Screen
            name="User"
            component={User}
            options={{
              presentation: "modal",
              title: "Información del Sistema",
              headerStyle: { backgroundColor: "#EB7F27", height: 120 },
              headerTintColor: "white",
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <LicenseDisabledModal
        visible={licenseDisabled && !licenseDeleted}
        onAccept={dismissLicenseDisabled}
      />
      <LicenseDeletedModal visible={licenseDeleted} onAccept={acceptLicenseDeleted} />
      <EventModal 
        visible={showEventModal && !licenseDisabled && !licenseDeleted} 
        onClose={() => {
          setShowEventModal(false);
          if (eventData?.kind === "chat") {
            setShowChatTab(true);
            setChatUnread(true);
          }
        }} 
        eventData={eventData}
        onOpenChat={() => {
          setShowEventModal(false);
          setShowChatTab(true);
          setChatUnread(false);
          setPendingOpenChat(true);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    },
  modalContent: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'open-sans-bold',
    color: '#2C3E50',
    marginTop: 15,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 16,
    fontFamily: 'open-sans',
    color: '#5D6D7E',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  closeButton: {
    marginTop: 25,
    backgroundColor: '#222266',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'open-sans-bold',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222266',
  },
  secondaryButtonText: {
    color: '#222266',
    fontSize: 16,
    fontFamily: 'open-sans-bold',
  },
  boldText: {
    fontFamily: 'open-sans-bold',
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E74C3C",
    borderWidth: 1.5,
    borderColor: "white",
  },
});

export default Sentry.wrap(App);
