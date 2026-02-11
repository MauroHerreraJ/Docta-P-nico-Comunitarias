import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🔹 URL base centralizada - Cambia esta línea para actualizar todas las URLs
const DEVELOP_URL = "https://desit-server-staging-a51a84ceec47.herokuapp.com";

const getBaseUrl = () => {
  return DEVELOP_URL;
};

// 🔹 Endpoints existentes refactorizados
const API_URL = `${getBaseUrl()}/api/v1/user`;
const API_TOKEN = `${getBaseUrl()}/api/v1/auth/token`;
const API_EVENT = `${getBaseUrl()}/api/v1/event`;
const API_PANICAPP = `${getBaseUrl()}/api/v1/panic-app`;
const API_NOTIFICATION = `${getBaseUrl()}/api/v1/push-notification/register`;

// Función para registrar el token de notificaciones
export const registerNotificationToken = async (licenseCode, fcmToken) => {
  try {
    const response = await axios.post(API_NOTIFICATION, {
      licenseCode,
      fcmToken,
    }, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error registrando el token en el servidor:", error);
    throw error;
  }
};

// Función para hacer un POST
export const postUserData = async (data) => {
  try {
    const response = await axios.post(API_URL, data, {
      headers: {
        "Content-Type": "application/json", // Configura los headers, si es necesario
      },
    });

    return response.data; // Devuelve los datos de la respuesta
  } catch (error) {
    console.error("Error en el POST", error);
    throw error; // Lanza el error para manejarlo fuera de la función si es necesario
  }
};
//Función Token

export const postToken = async (dataToken) => {
  try {
    const response = await axios.post(API_TOKEN, dataToken, {
      headers: {
        "Content-Type": "application/json", // Configura los headers, si es necesario
      },
    });
    console.log(response.status);
    return response.data; // Devuelve los datos de la respuesta
  } catch (error) {
    console.error("Error en el POST", error);
    throw error; // Lanza el error para manejarlo fuera de la función si es necesario
  }
};

// Función para validar credenciales
export const validateCredentials = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/validate`, data, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error en la validación de credenciales:", error);
    throw error;
  }
};

// Función para obtener datos del panicapp por código
export const getPanicAppByCode = async (panicAppCode) => {
  try {
    const response = await axios.get(`${API_PANICAPP}/code/${panicAppCode}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error al obtener datos del panicapp:", error);
    throw error;
  }
};

// Función para hacer un POST con el token
export const savePost = async (newPost) => {
  try {
    // Recuperamos los datos almacenados en AsyncStorage
    const storedData = await AsyncStorage.getItem("@licencias");
    if (!storedData) {
      throw new Error("No se encontró el token en AsyncStorage");
    }
    // Parseamos los datos
    var parsedData = JSON.parse(storedData);
    // Extraemos solo el accessToken
    const accessToken = parsedData.token?.accessToken;
    if (!accessToken) {
      throw new Error("El accessToken es inválido o no está presente");
    }
    // Realizamos el POST utilizando el accessToken en el header Authorization
    //console.log('parse', parsedData.result.licenseCreated.code)
    var cuenta = parsedData.result.licenseCreated.code;

    const response = await axios.post(API_EVENT, newPost, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    //console.log(response.status)
    return response.data;
  } catch (error) {
    console.error("Error en savePost:", error);
    throw error;
  }
};
