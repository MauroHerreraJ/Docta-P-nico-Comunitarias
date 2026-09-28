import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://bcc447a33fe91fb113d98cd8e40510de@o4511473782161408.ingest.us.sentry.io/4511473784782848",
  debug: false, // Si está en true, verás logs de Sentry en la terminal
});

import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, View, Text, TouchableOpacity, StyleSheet, Alert, Animated } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState, useRef } from "react";

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
import { getPanicAppByCode, registerNotificationToken, onUnauthorized } from "./util/Api";
import { registerForPushNotificationsAsync } from "./util/Notifications";
// import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';

const Stack = createNativeStackNavigator();
const BottomTabs = createBottomTabNavigator();

// 🔹 Función para obtener la clave de almacenamiento según el producto
const getStorageKey = (product) => {
  if (!product || product === "docta_panico" || product === "docta_legacy") return "@licencias";
  return `@licencias_${product}`;
};

// 🔹 Componente para el icono animado de pánico/multimedia
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

function EventModal({ visible, onClose, eventData }) {
  if (!eventData) return null;

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
          <Ionicons name="notifications-circle" size={80} color="#E74C3C" />
          <Text style={styles.modalTitle}>{eventData.title || "!Alarma Activada!"}</Text>
          {renderBody(eventData.body)}
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>ENTENDIDO</Text>
          </TouchableOpacity>
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

function AuthorizedNavigation({ activeProduct }) {
  const [logoUrl, setLogoUrl] = useState("https://i.imgur.com/aIYhRsN.png");
  const [headerBgColor, setHeaderBgColor] = useState("white");
  const [headerTxtColor, setHeaderTxtColor] = useState("Black");
  const [isMultimediaEnabled, setIsMultimediaEnabled] = useState(false);
  const [activePanicId, setActivePanicId] = useState(null);
  const timerRef = useRef(null);

  const activateMultimedia = (serverResult) => {
    // Si es un usuario Legacy (Desit Server), no habilitamos Multimedia
    if (activeProduct === "docta_legacy") {
      console.log("ℹ️ Multimedia no disponible para producto Legacy");
      return;
    }

    // Si el servidor ya manda el ID (ej: result.id), lo guardamos. 
    // Si no, queda como null por ahora.
    const id = serverResult?.id || serverResult?.event_id || null;
    console.log("🔔 Multimedia activada. ID de evento vinculado:", id);
    
    setActivePanicId(id);
    setIsMultimediaEnabled(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Auto-cierre en 5 minutos
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

  return (
    <BottomTabs.Navigator
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

      {/* 📸 PESTAÑA MULTIMEDIA (Registrada pero oculta de la barra inferior) */}
      {activeProduct !== "docta_legacy" && (
        <BottomTabs.Screen
          name="Multimedia"
          options={{
            tabBarButton: () => null, // Ocultar de la barra inferior
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
            <Multimedia 
              {...props} 
              panicId={activePanicId} 
              onFinalize={deactivateMultimedia} 
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

function NoAuthorizedNavigation({ activeProduct, onAuthorized, activationData }) {
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

  const handleActivated = (product, extraData = null) => {
    setActiveProduct(product);
    setActivationData(extraData);
    setHasMasterCode(true);
  };
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventData, setEventData] = useState(null);

  /* 🚫 NOTIFICACIONES ANULADAS TEMPORALMENTE
  useEffect(() => {
    // Función para normalizar y mostrar los datos de la notificación
    const handleEventNotification = (content) => {
      if (!content) return;
      
      console.log("Procesando contenido de notificación:", content);
      
      // Usamos el cuerpo (body) que envía el servidor directamente
      const body = content.body || "La alarma de su zona se ha activado.";

      setEventData({
        title: "!Alarma Activada!",
        body: body,
        data: content.data || {}
      });
      setShowEventModal(true);
    };

    // Función para revisar si la app se abrió desde una notificación (cuando estaba cerrada)
    const checkInitialNotification = async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response && response.notification) {
          console.log("App abierta desde notificación (inicial):", response);
          handleEventNotification(response.notification.request.content);
        }
      } catch (error) {
        console.error("Error al obtener la notificación inicial:", error);
      }
    };

    checkInitialNotification();

    // Registro de notificaciones al iniciar si ya está autorizado
    const setupNotifications = async () => {
      const data = await AsyncStorage.getItem("@licencias");
      if (data) {
        const parsedData = JSON.parse(data);
        const licenseCode = parsedData.result?.licenseCreated?.code;
        if (licenseCode) {
          registerForPushNotificationsAsync(licenseCode).then(token => setExpoPushToken(token));
        }
      }
    };
    
    setupNotifications();

    // Listener para cuando llega una notificación mientras la app está abierta
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
      handleEventNotification(notification.request.content);
    });

    // Listener para cuando el usuario toca la notificación
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("Notificación tocada:", response);
      if (response && response.notification) {
        handleEventNotification(notification.request.content);
      }
    });

    // Listener para cuando el token de notificación cambia (refresco de token)
    const pushTokenListener = Notifications.addPushTokenListener(async ({ data: token }) => {
      console.log("El token de notificación ha cambiado:", token);
      try {
        const data = await AsyncStorage.getItem("@licencias");
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
  */

  useEffect(() => {
    // Suscribirse a errores de autenticación (401)
    onUnauthorized(() => {
      console.log("⚠️ App detectó 401: Redirigiendo a configuración...");
      setIsAuthorized(false);
      // No reseteamos hasMasterCode porque el equipo sigue siendo el mismo, 
      // solo se invalidó el token del dispositivo.
    });

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
      } catch (e) {
        console.warn("❌ Error durante la preparación:", e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
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
      <NavigationContainer>
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
                {(props) => <AuthorizedNavigation {...props} activeProduct={activeProduct} />}
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
      <EventModal 
        visible={showEventModal} 
        onClose={() => setShowEventModal(false)} 
        eventData={eventData} 
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
  boldText: {
    fontFamily: 'open-sans-bold',
    fontWeight: 'bold',
    color: '#2C3E50',
  },
});

export default Sentry.wrap(App);
