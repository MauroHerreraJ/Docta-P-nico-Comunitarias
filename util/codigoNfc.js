export function codigoNfcDocta(texto) {
  const raw = String(texto || "")
    .replace(/\u0000/g, "")
    .trim();
  const match = raw.match(/DOCTA\|nfc\|([A-Za-z0-9._-]{2,80})/i);
  return match ? match[1] : "";
}
