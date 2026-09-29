import AsyncStorage from "@react-native-async-storage/async-storage";
import { cerrarRondaApp, iniciarRondaApp, marcarPuntoRondaApp } from "./NuevaApi";

const QUEUE_KEY = "@vigicontrol_ronda_queue";

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueRondaOp(op) {
  const queue = await readQueue();
  const clientId = String(op?.clientId || "");
  const next = clientId
    ? queue.filter((item) => item.clientId !== clientId)
    : queue;
  next.push(op);
  await writeQueue(next);
  return next;
}

export async function getRondaQueue() {
  return readQueue();
}

function isPermanent(error) {
  const status = error?.response?.status;
  return status === 400 || status === 404 || status === 409;
}

/** Manda marcas y cierres guardados sin red. Devuelve lo que sigue pendiente. */
export async function flushRondaQueue() {
  const queue = await readQueue();
  const starts = queue.filter((item) => item.kind === "iniciar");
  const marks = queue.filter((item) => item.kind === "marcar");
  const closes = queue.filter((item) => item.kind === "cerrar");
  const left = [];

  for (const item of starts) {
    try {
      await iniciarRondaApp(item.rondaId);
    } catch (error) {
      if (!isPermanent(error)) left.push(item);
    }
  }
  for (const item of marks) {
    try {
      await marcarPuntoRondaApp(item);
    } catch (error) {
      if (!isPermanent(error)) left.push(item);
    }
  }
  for (const item of closes) {
    try {
      await cerrarRondaApp(item.rondaId);
    } catch (error) {
      if (!isPermanent(error)) left.push(item);
    }
  }

  await writeQueue(left);
  return left;
}
