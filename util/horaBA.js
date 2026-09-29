export const ZONA_BA = "America/Argentina/Buenos_Aires";

function fechaValida(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function partes(value) {
  const d = fechaValida(value) || new Date();
  const bits = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_BA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type) => bits.find((p) => p.type === type)?.value || "";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
  };
}

function hhmm(value) {
  const p = partes(value);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Hora del instante en Buenos Aires, HH:mm. */
export function formatHoraBA(value) {
  if (!fechaValida(value)) return "—";
  return hhmm(value);
}

/** Fecha del instante en Buenos Aires, dd/mm/aaaa. */
export function formatFechaBA(value) {
  const d = fechaValida(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_BA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Fecha y hora del instante en Buenos Aires. */
export function formatFechaHoraBA(value) {
  const d = fechaValida(value);
  if (!d) return "";
  const p = partes(d);
  const fecha = `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}`;
  return `${fecha} ${hhmm(d)}`;
}

/** Hora civil (0-23) en Buenos Aires. */
export function horaBA(value = new Date()) {
  return partes(value).hour;
}

/** Día calendario en Buenos Aires, yyyy-mm-dd. Si hour < 6, el día anterior. */
export function ymdOperativoBA(value = new Date()) {
  const p = partes(value);
  let { year, month, day } = p;
  if (p.hour < 6) {
    const prev = new Date(Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000);
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth() + 1;
    day = prev.getUTCDate();
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
