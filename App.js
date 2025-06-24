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
import * as Sentry from "sentry-expo";
import AllButtons from "./screen/AllButtons";
import Configuration from "./screen/Configuration";
import User from "./screen/User";
import welcome from "./screen/Welcome";
import GrabarBorrar from "./component/GrabarBorrar";

const Stack = createNativeStackNavigator();
const BottomTabs = createBottomTabNavigator();

function AuthorizedNavigation() {
  return (
    <BottomTabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "white", height: 120 },
        headerTintColor: "Black",
        tabBarLabelStyle: { fontSize: 13, width: "100%", paddingBottom: 1 },
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
          headerLeft: () => (
            <Image
              source={require("./assets/logo_villamaria.png")}
              style={{ width: 230, height: 80, marginLeft: 90, marginTop: -20 }}
            />
          ),
        }}
      />
      <BottomTabs.Screen
        name="User"
        component={User}
        options={{
          title: "Sistema",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </BottomTabs.Navigator>
  );
}

function NoAuthorizedNavigation() {
  return (
    <BottomTabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#EB7F27", height: 100 },
        headerTintColor: "black",
      }}
    >
      <BottomTabs.Screen
        name="Welcome"
        component={welcome}
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
        // Preload fonts or any other task
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const data = await AsyncStorage.getItem("@licencias");
        if (data !== null) {
          setIsAuthorized(true); // Usuario ya configurado
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    // Inicializar Sentry
    Sentry.init({
      dsn: "https://ac5efa908f3d120b5621cbc5c631f296@o4509000362295296.ingest.us.sentry.io/4509000366555136",
      // Puedes configurar otros parámetros aquí, como enviar información adicional
      sendDefaultPii: true, // Permite enviar información personal identificable (si es necesario)
      enableInExpoDevelopment: true,
    });
    Sentry.Native.captureException(new Error("¡en pantalla de app!"));
  }, []); // El array vacío asegura que solo se ejecute una vez al inicio

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
          <Stack.Screen name="Welcome" component={welcome} />
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
