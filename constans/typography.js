import { Text, TextInput, Dimensions, PixelRatio } from "react-native";

const BASE_WIDTH = 375;
const MAX_FONT_MULTIPLIER = 1.5;

/**
 * Escala un tamaño de fuente al ancho del teléfono (iPhone 8 = 375).
 * Se combina con el tamaño de fuente del sistema (accesibilidad).
 */
export function scaleFont(size) {
  const { width } = Dimensions.get("window");
  const ratio = width / BASE_WIDTH;
  const clamped = Math.min(Math.max(ratio, 0.88), 1.12);
  return Math.round(PixelRatio.roundToNearestPixel(size * clamped));
}

export function getFontScale() {
  return Math.min(PixelRatio.getFontScale() || 1, MAX_FONT_MULTIPLIER);
}

export function applyAppTextDefaults() {
  Text.defaultProps = {
    ...(Text.defaultProps || {}),
    allowFontScaling: true,
    maxFontSizeMultiplier: MAX_FONT_MULTIPLIER,
  };
  TextInput.defaultProps = {
    ...(TextInput.defaultProps || {}),
    allowFontScaling: true,
    maxFontSizeMultiplier: MAX_FONT_MULTIPLIER,
  };
}

export { MAX_FONT_MULTIPLIER };
