import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "sentry-expo";

// Define la URL base
const API_URL = "https://desit-server-3e06b7680f25.herokuapp.com/api/v1/user";
const API_TOKEN =
  "https://desit-server-3e06b7680f25.herokuapp.com/api/v1/auth/token";
const API_EVENT =
  "https://desit-server-3e06b7680f25.herokuapp.com/api/v1/event";

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
    Sentry.Native.captureException(error);
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
    Sentry.Native.captureException(error);
    console.error("Error en el POST", error);
    throw error; // Lanza el error para manejarlo fuera de la función si es necesario
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
    Sentry.Native.configureScope((scope) => {
      scope.setExtra("newPost", cuenta); // Agrega newPost como un "extra"
    });
    Sentry.Native.captureException(error);
    console.error("Error en savePost:", error);
    throw error;
  }
};
