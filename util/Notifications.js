import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { registerNotificationToken } from './Api';

// Configuración de cómo se comportan las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

/** Permiso del sistema para las alarmas locales de Vigicontrol. No usa @licencias. */
export async function pedirPermisoNotificaciones() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Avisos",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    }).catch(() => {});
  }
  const actual = await Notifications.getPermissionsAsync();
  if (actual.status === "granted") return true;
  const pedido = await Notifications.requestPermissionsAsync();
  return pedido.status === "granted";
}

/**
 * Push remoto del producto de licencias. Sigue apagado: ese token se mandaba
 * con @licencias, y Vigicontrol entra con @vigicontrol_session.
 */
export async function registerForPushNotificationsAsync() {
  return null;

  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('¡Error! No se obtuvo permiso para las notificaciones push.');
      return;
    }
    
    // Obtener el token de Dispositivo (FCM)
    try {
      // En compilaciones nativas (APK/AAB), esto obtiene el token de FCM directamente
      token = (await Notifications.getDevicePushTokenAsync()).data;
      console.log("Token de Dispositivo (FCM):", token);

      if (!token) {
        // Intento de respaldo con Expo Token si el de dispositivo falla
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log("Token de Respaldo (Expo):", token);
      }

      if (licenseCode && token) {
        await registerNotificationToken(licenseCode, token);
        console.log("Token registrado exitosamente en el servidor");
      }
    } catch (e) {
      console.error("Error al obtener o registrar el token:", e);
    }
  } else {
    console.log('Debes usar un dispositivo físico para las notificaciones push.');
  }

  return token;
}
