import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getDeviceIdentity,
  loginWithUser,
  sendDeviceIdentity,
} from "../../util/NuevaApi";
import {
  authenticateBiometric,
  getBiometricCapability,
  getEnrollment,
  saveEnrollment,
} from "../../util/BiometricAuth";

/**
 * Login con biometría O usuario; la clave SIEMPRE es requerida.
 *
 * Primera vez (sin enrollment):
 *   email + enrolar biometría + password → login → saveEnrollment
 *   (sin hardware: email + password, con aviso)
 *
 * Recurrente:
 *   modo biométrico (desbloquea email guardado) O modo usuario → + password
 */
export default function LoginVigi({ onLoggedIn, productName = "Vigilantes" }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceSource, setDeviceSource] = useState("");
  const [registering, setRegistering] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [deviceOk, setDeviceOk] = useState(false);

  const [ready, setReady] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [hasEnrollment, setHasEnrollment] = useState(false);
  /** 'biometric' | 'user' — solo aplica si hay enrollment y biometría disponible */
  const [authMode, setAuthMode] = useState("user");
  const [bioUnlocked, setBioUnlocked] = useState(false);
  const [enrolledUsername, setEnrolledUsername] = useState("");
  const [enrollingBio, setEnrollingBio] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [identity, capability, enrollment] = await Promise.all([
          getDeviceIdentity(),
          getBiometricCapability(),
          getEnrollment(),
        ]);
        if (!mounted) return;

        setDeviceId(identity.deviceId || "");
        setDeviceSource(identity.source || "");

        const available = Boolean(capability?.available);
        setBioAvailable(available);

        if (enrollment?.username) {
          setHasEnrollment(true);
          setEnrolledUsername(enrollment.username);
          setUsername(enrollment.username);
          setAuthMode(available ? "biometric" : "user");
          setBioUnlocked(false);
        } else {
          setHasEnrollment(false);
          setAuthMode("user");
          if (!available) {
            // Emulador / sin biometría: aviso una sola vez al cargar
            Alert.alert(
              "Biometría no disponible",
              "Este dispositivo no tiene Face ID / huella. Podés ingresar con usuario y contraseña.",
            );
          }
        }
      } catch (error) {
        console.warn("[LoginVigi] init:", error?.message || error);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onRegisterDevice = async () => {
    setRegistering(true);
    try {
      const result = await sendDeviceIdentity({
        licenseCode: String(username || "").trim() || undefined,
      });
      setDeviceId(result?.deviceId || deviceId);
      setDeviceSource(result?.source || deviceSource);
      setDeviceOk(true);
      Alert.alert(
        "Dispositivo registrado",
        `deviceId:\n${result?.deviceId || deviceId}\n\nYa podés vincularlo a la empresa en el dashboard.`,
      );
    } catch (error) {
      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo registrar el dispositivo.",
      );
    } finally {
      setRegistering(false);
    }
  };

  const onUnlockBiometric = async () => {
    setEnrollingBio(true);
    try {
      const result = await authenticateBiometric({
        promptMessage: "Desbloqueá tu usuario con biometría",
        cancelLabel: "Cancelar",
      });
      if (!result.success) {
        if (result.error !== "user_cancel" && result.error !== "system_cancel") {
          Alert.alert(
            "Biometría",
            result.warning ||
              "No se pudo verificar. Probá de nuevo o usá usuario.",
          );
        }
        return;
      }
      setUsername(enrolledUsername);
      setBioUnlocked(true);
    } finally {
      setEnrollingBio(false);
    }
  };

  const onEnrollBiometricFirstTime = async () => {
    const user = String(username || "").trim();
    if (!user) {
      Alert.alert("Datos incompletos", "Ingresá tu email o usuario primero.");
      return;
    }
    setEnrollingBio(true);
    try {
      const result = await authenticateBiometric({
        promptMessage: "Enrolá biometría para próximos ingresos",
        cancelLabel: "Cancelar",
      });
      if (!result.success) {
        if (result.error !== "user_cancel" && result.error !== "system_cancel") {
          Alert.alert(
            "Biometría",
            result.warning ||
              "No se pudo enrolar. Podés ingresar igual con usuario y clave.",
          );
        }
        return false;
      }
      return true;
    } finally {
      setEnrollingBio(false);
    }
  };

  const onLogin = async () => {
    const pass = String(password || "");
    if (!pass) {
      Alert.alert("Datos incompletos", "La contraseña es obligatoria.");
      return;
    }

    // Primera vez con biometría: exigir enrolamiento exitoso si hay hardware
    let user = String(username || "").trim();
    let shouldSaveEnrollment = false;

    if (!hasEnrollment) {
      if (!user) {
        Alert.alert("Datos incompletos", "Ingresá usuario y clave.");
        return;
      }
      if (bioAvailable) {
        const enrolledOk = await onEnrollBiometricFirstTime();
        if (!enrolledOk) return;
        shouldSaveEnrollment = true;
      }
    } else if (authMode === "biometric") {
      if (!bioUnlocked || !enrolledUsername) {
        Alert.alert(
          "Biometría",
          "Primero desbloqueá con Face ID / huella para usar el usuario guardado.",
        );
        return;
      }
      user = enrolledUsername;
    } else {
      user = String(username || "").trim();
      if (!user) {
        Alert.alert("Datos incompletos", "Ingresá usuario y clave.");
        return;
      }
    }

    setLoggingIn(true);
    try {
      const session = await loginWithUser({
        username: user,
        password: pass,
        registerDeviceOnLogin: true,
      });
      setDeviceOk(true);
      setDeviceId(session.deviceId || deviceId);

      if (shouldSaveEnrollment || (!hasEnrollment && bioAvailable)) {
        try {
          await saveEnrollment({ username: user });
          setHasEnrollment(true);
          setEnrolledUsername(user);
          setAuthMode("biometric");
          setBioUnlocked(true);
        } catch (e) {
          console.warn("[LoginVigi] saveEnrollment:", e?.message || e);
        }
      } else if (hasEnrollment && authMode === "user" && bioAvailable) {
        // Actualizar enrollment si ingresó con otro usuario
        try {
          await saveEnrollment({ username: user });
          setEnrolledUsername(user);
        } catch {
          // no bloquear login
        }
      }

      onLoggedIn?.(session);
    } catch (error) {
      const msg =
        error?.response?.data?.message?.[0] ||
        error?.response?.data?.message ||
        error?.message ||
        "Usuario o clave inválidos.";
      Alert.alert("No se pudo ingresar", String(msg));
    } finally {
      setLoggingIn(false);
    }
  };

  const switchMode = (mode) => {
    setAuthMode(mode);
    setPassword("");
    if (mode === "biometric") {
      setUsername(enrolledUsername);
      setBioUnlocked(false);
    } else {
      setBioUnlocked(false);
      if (!username && enrolledUsername) setUsername(enrolledUsername);
    }
  };

  if (!ready) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color="#0F76C4" />
      </View>
    );
  }

  const showModeToggle = hasEnrollment && bioAvailable;
  const isFirstTime = !hasEnrollment;
  const usernameEditable =
    isFirstTime || authMode === "user" || !bioAvailable;
  const showBioUnlock =
    hasEnrollment && bioAvailable && authMode === "biometric" && !bioUnlocked;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={48} color="#0F76C4" />
          <Text style={styles.title}>{productName}</Text>
          <Text style={styles.subtitle}>Ingreso al dispositivo</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>1 · Dispositivo</Text>
          <Text style={styles.hint}>
            deviceId {deviceSource ? `(${deviceSource})` : ""}
          </Text>
          <Text selectable style={styles.deviceId}>
            {deviceId || "Leyendo..."}
          </Text>
          <TouchableOpacity
            style={[styles.btnSecondary, registering && styles.btnDisabled]}
            onPress={onRegisterDevice}
            disabled={registering || loggingIn}
          >
            {registering ? (
              <ActivityIndicator color="#0F76C4" />
            ) : (
              <Text style={styles.btnSecondaryText}>
                {deviceOk
                  ? "Volver a registrar en servidor"
                  : "Registrar dispositivo en servidor"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {showModeToggle ? (
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  authMode === "biometric" && styles.modeBtnActive,
                ]}
                onPress={() => switchMode("biometric")}
                disabled={loggingIn}
              >
                <Ionicons
                  name="finger-print"
                  size={18}
                  color={authMode === "biometric" ? "#fff" : "#0F76C4"}
                />
                <Text
                  style={[
                    styles.modeBtnText,
                    authMode === "biometric" && styles.modeBtnTextActive,
                  ]}
                >
                  Biometría
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  authMode === "user" && styles.modeBtnActive,
                ]}
                onPress={() => switchMode("user")}
                disabled={loggingIn}
              >
                <Ionicons
                  name="person"
                  size={18}
                  color={authMode === "user" ? "#fff" : "#0F76C4"}
                />
                <Text
                  style={[
                    styles.modeBtnText,
                    authMode === "user" && styles.modeBtnTextActive,
                  ]}
                >
                  Usuario
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={styles.label}>
            {isFirstTime
              ? "2 · Usuario / email"
              : authMode === "biometric"
                ? "2 · Usuario (biometría)"
                : "2 · Usuario"}
          </Text>

          {showBioUnlock ? (
            <TouchableOpacity
              style={[styles.btnBio, enrollingBio && styles.btnDisabled]}
              onPress={onUnlockBiometric}
              disabled={enrollingBio || loggingIn}
            >
              {enrollingBio ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="scan" size={22} color="#fff" />
                  <Text style={styles.btnBioText}>
                    Desbloquear con Face ID / huella
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {(usernameEditable || bioUnlocked || !showBioUnlock) && (
            <TextInput
              style={[
                styles.input,
                !usernameEditable && bioUnlocked && styles.inputLocked,
              ]}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Usuario o email"
              placeholderTextColor="#99A3A4"
              editable={usernameEditable && !loggingIn}
            />
          )}

          {isFirstTime && bioAvailable ? (
            <Text style={styles.bioHint}>
              Al ingresar se pedirá biometría para enrolar este usuario en el
              dispositivo.
            </Text>
          ) : null}

          {!bioAvailable ? (
            <Text style={styles.bioWarn}>
              Biometría no disponible en este dispositivo.
            </Text>
          ) : null}

          <Text style={[styles.label, { marginTop: 14 }]}>3 · Clave</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Contraseña (siempre requerida)"
            placeholderTextColor="#99A3A4"
            editable={!loggingIn}
            onSubmitEditing={onLogin}
          />

          <TouchableOpacity
            style={[styles.btnPrimary, loggingIn && styles.btnDisabled]}
            onPress={onLogin}
            disabled={loggingIn || enrollingBio}
          >
            {loggingIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Ingresar</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          {isFirstTime
            ? bioAvailable
              ? "Primera vez: email + biometría + contraseña."
              : "Ingresá con usuario y contraseña."
            : "Elegí biometría o usuario; la contraseña siempre es obligatoria."}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    marginTop: 10,
    fontSize: 26,
    fontFamily: "open-sans-bold",
    color: "#222266",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: "open-sans",
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  label: {
    fontSize: 13,
    fontFamily: "open-sans-bold",
    color: "#334155",
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: "open-sans",
  },
  bioHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#0F76C4",
    fontFamily: "open-sans",
  },
  bioWarn: {
    marginTop: 8,
    fontSize: 12,
    color: "#B45309",
    fontFamily: "open-sans",
  },
  deviceId: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
    fontFamily: "open-sans-bold",
    color: "#0F172A",
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#0F76C4",
    borderRadius: 10,
    paddingVertical: 10,
  },
  modeBtnActive: {
    backgroundColor: "#0F76C4",
  },
  modeBtnText: {
    color: "#0F76C4",
    fontSize: 13,
    fontFamily: "open-sans-bold",
  },
  modeBtnTextActive: {
    color: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "open-sans",
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  inputLocked: {
    backgroundColor: "#E8F4FC",
    borderColor: "#0F76C4",
  },
  btnPrimary: {
    marginTop: 18,
    backgroundColor: "#0F76C4",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "open-sans-bold",
  },
  btnSecondary: {
    borderWidth: 1.5,
    borderColor: "#0F76C4",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: "#0F76C4",
    fontSize: 14,
    fontFamily: "open-sans-bold",
  },
  btnBio: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0B5A96",
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 10,
  },
  btnBioText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "open-sans-bold",
  },
  btnDisabled: {
    opacity: 0.7,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#94A3B8",
    fontFamily: "open-sans",
    marginTop: 8,
    paddingHorizontal: 8,
  },
});
