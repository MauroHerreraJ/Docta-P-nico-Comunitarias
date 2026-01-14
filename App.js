import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import AllButtons from "./screen/AllButtons";
import Configuration from "./screen/Configuration";
import User from "./screen/User";
import Welcome from "./screen/Welcome";
import GrabarBorrar from "./component/GrabarBorrar";
import { getPanicAppByCode } from "./util/Api";

const Stack = createNativeStackNavigator();
const BottomTabs = createBottomTabNavigator();

// ⚙️ CONFIGURACIÓN DE ACTUALIZACIÓN
// Cambia a 0 para forzar actualización en cada inicio (útil para desarrollo)
// Cambia a 24 para actualizar cada 24 horas (recomendado para producción)
const UPDATE_INTERVAL_HOURS = 24; // Cambia a 0 para testing

// Función de migración y actualización para usuarios existentes
async function migrateExistingUsers(storedData) {
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
    
    await AsyncStorage.setItem("@licencias", JSON.stringify(updatedData));
    console.log("Datos del panicApp actualizados exitosamente");
    
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

function AuthorizedNavigation() {
  const [logoUrl, setLogoUrl] = useState("https://i.imgur.com/aIYhRsN.png");
  const [headerBgColor, setHeaderBgColor] = useState("white");
  const [headerTxtColor, setHeaderTxtColor] = useState("Black");

  useEffect(() => {
    const loadPanicAppData = async () => {
      try {
        const storedData = await AsyncStorage.getItem("@licencias");
        console.log("📦 AuthorizedNavigation: Verificando AsyncStorage...");
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
      }}
    >
      <BottomTabs.Screen
        name="Desit"
        component={AllButtons}
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
      />
      <BottomTabs.Screen
        name="User"
        component={User}
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
      />
    </BottomTabs.Navigator>
  );
}

function NoAuthorizedNavigation() {
  return (
    <BottomTabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0F76C4", height: 100 },
        headerTintColor: "black",
      }}
    >
      <BottomTabs.Screen
        name="Welcome"
        component={Welcome}
        options={{
          headerShown: false,
          tabBarStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <BottomTabs.Screen
        name="Configuration"
        component={Configuration}
        options={{
          tabBarStyle: { display: "none" },
          title: "Configuración",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </BottomTabs.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    "open-sans": require("./fonts/OpenSans-Regular.ttf"),
    "open-sans-bold": require("./fonts/OpenSans-Bold.ttf"),
  });

  const [appIsReady, setAppIsReady] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
        
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
        const data = await AsyncStorage.getItem("@licencias");
        if (data !== null) {
          setIsAuthorized(true); // Usuario ya configurado
          
          // Migración automática para usuarios existentes
          await migrateExistingUsers(data);
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
          initialRouteName={isAuthorized ? "Principal" : "Secondary"}
        >
          <Stack.Screen
            name="Secondary"
            component={NoAuthorizedNavigation}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Principal"
            component={AuthorizedNavigation}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="GrabarBorrar"
            component={GrabarBorrar}
            options={{
              title: "Borrar",
              headerStyle: { backgroundColor: "#0d47a1" },
              headerTintColor: "white",
            }}
          />
          <Stack.Screen name="Welcome" component={Welcome} />
          <Stack.Screen
            name="User"
            component={User}
            options={{
              presentation: "modal",
              title: "Información del Sistema",
              headerStyle: { backgroundColor: "#EB7F27", height: 150 },
              headerTintColor: "white",
            }}
          />
          <Stack.Screen name="Configuration" component={Configuration} />
          <Stack.Screen name="Home" component={AllButtons} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
