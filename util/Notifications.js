import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { registerNotificationToken } from './Api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Solicita permisos y registra el token de notificaciones en el servidor
 * @param {string} licenseCode - El código de licencia del usuario
 */
export async function registerForPushNotificationsAsync(licenseCode) {
  let token;

  // Envoltorio de seguridad para evitar crasheos si el módulo nativo no está cargado
  try {
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
      
      try {
        // Intento obtener el token nativo
        const deviceTokenResult = await Notifications.getDevicePushTokenAsync();
        token = deviceTokenResult.data;
        console.log("Token de Dispositivo (FCM):", token);

        if (!token) {
          const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
          const expoTokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
          token = expoTokenResult.data;
          console.log("Token de Respaldo (Expo):", token);
        }

        if (licenseCode && token) {
          await registerNotificationToken(licenseCode, token);
          console.log("Token registrado exitosamente en el servidor");
        }
      } catch (e) {
        console.warn("Error al obtener el token (posible falta de módulo nativo):", e.message);
      }
    } else {
      console.log('Debes usar un dispositivo físico para las notificaciones push.');
    }
  } catch (globalError) {
    console.warn("Error global en notificaciones:", globalError.message);
  }

  return token;
}
