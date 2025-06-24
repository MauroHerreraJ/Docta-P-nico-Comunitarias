import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define la URL base
const API_URL = "https://desit-server-staging-2dab81ac495c.herokuapp.com/api/v1/user";
const API_TOKEN = "https://desit-server-staging-2dab81ac495c.herokuapp.com/api/v1/auth/token";
const API_EVENT = "https://desit-server-staging-2dab81ac495c.herokuapp.com/api/v1/event"



// Función para hacer un POST
export const postUserData = async (data) => {
  try {
    const response = await axios.post(API_URL, data, {
      headers: {
        'Content-Type': 'application/json', // Configura los headers, si es necesario
      },
    });

    return response.data; // Devuelve los datos de la respuesta
  } catch (error) {
    console.error("Error en el POST", error);
    throw error; // Lanza el error para manejarlo fuera de la función si es necesario
  }
};

//http://147.79.86.163:3000/setAlarm
{/* 
    {
    "id":"1002",
    "nCuenta":"1002",
    "event":"ALARM", 
    "user":"0201"
}
  */}

  //Función Token
  export const postToken = async(dataToken) => {
    try {
      const response = await axios.post(API_TOKEN, dataToken, {
        headers: {
          'Content-Type': 'application/json', // Configura los headers, si es necesario
        },
      });  
      return response.data; // Devuelve los datos de la respuesta
    } catch (error) {
      console.error("Error en el POST", error);
      throw error; // Lanza el error para manejarlo fuera de la función si es necesario
    }  
   };
  

  const AP = "http://147.79.86.163:3000/setAlarm"

  export const savePost = async (newPost) => {
  try {
    const response = await axios.post(AP, newPost);
    console.log("Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error posting data:", error.message);
    throw error;
  }
};

export const sendPost = async (newPost) => {
  try {
    // Recuperamos los datos almacenados en AsyncStorage
    const storedData = await AsyncStorage.getItem('@licencias');
    if (!storedData) {
      throw new Error("No se encontró el token en AsyncStorage");
    }
    // Parseamos los datos
    const parsedData = JSON.parse(storedData);
    // Extraemos solo el accessToken
    const accessToken = parsedData.token?.accessToken;
    if (!accessToken) {
      throw new Error("El accessToken es inválido o no está presente");
    }
    // Realizamos el POST utilizando el accessToken en el header Authorization
    const response = await axios.post(API_EVENT, newPost, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });    
    return response.data;
  } catch (error) {
    console.error("Error en savePost:", error);
    throw error;
  }
}