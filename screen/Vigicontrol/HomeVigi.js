import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getMyVigiladorProfile,
  getStoredSession,
} from "../../util/NuevaApi";

const CONTADORES_DEMO = {
  asignaciones: 3,
  rondas: 2,
  accesos: 7,
  novedades: 5,
  utilidades: 0,
};

const MODULOS = [
  {
    key: "asignaciones",
    titulo: "Asignaciones",
    subtitulo: "Pendientes de tomar",
    icono: "clipboard-outline",
    color: "#EB7F27",
    etiquetaBadge: (n) => `${n} pendiente${n === 1 ? "" : "s"}`,
  },
  {
    key: "rondas",
    titulo: "Rondas",
    subtitulo: "Recorridos del turno",
    icono: "walk-outline",
    color: "#2E86C1",
    etiquetaBadge: (n) => `${n} activa${n === 1 ? "" : "s"}`,
  },
  {
    key: "accesos",
    titulo: "Accesos",
    subtitulo: "Ingresos y egresos",
    icono: "log-in-outline",
    color: "#16A085",
    etiquetaBadge: (n) => `${n} hoy`,
  },
  {
    key: "novedades",
    titulo: "Novedades",
    subtitulo: "Libro de guardia",
    icono: "document-text-outline",
    color: "#8E44AD",
    etiquetaBadge: (n) => `${n} sin leer`,
  },
  {
    key: "utilidades",
    titulo: "Utilidades",
    subtitulo: "Herramientas y contactos",
    icono: "construct-outline",
    color: "#566573",
    etiquetaBadge: () => null,
  },
];

function perfilDesdeSesion(session) {
  const u = session?.user || {};
  const nombre = [u.nombre, u.apellido].filter(Boolean).join(" ").trim();
  return {
    nombre: nombre || u.username || u.email || "Usuario",
    email: u.email || "",
    rol: u.role === "vigilador" ? "Vigilador" : String(u.role || "Usuario"),
    legajo: u.documento || "—",
    documento: u.documento || "",
    foto: "",
    objetivo: "Sin objetivo asignado",
    empresa: "",
    turno: "—",
    enServicio: true,
  };
}

function TarjetaIdentidad({ perfil, s, m }) {
  const iniciales = useMemo(() => {
    return String(perfil.nombre || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0].toUpperCase())
      .join("");
  }, [perfil.nombre]);

  const tieneFoto = Boolean(String(perfil.foto || "").trim());

  return (
    <LinearGradient
      colors={["#2A2A7A", "#191952"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.identidad}
    >
      <View style={s.identidadFila}>
        <View style={s.avatar}>
          {tieneFoto ? (
            <Image
              source={{ uri: perfil.foto }}
              style={s.avatarFoto}
              resizeMode="cover"
            />
          ) : (
            <Text style={s.avatarTexto}>{iniciales}</Text>
          )}
        </View>

        <View style={s.identidadDatos}>
          <Text style={s.identidadNombre} numberOfLines={1}>
            {perfil.nombre}
          </Text>
          <Text style={s.identidadRol} numberOfLines={1}>
            {perfil.rol}
            {perfil.legajo && perfil.legajo !== "—"
              ? ` · Legajo ${perfil.legajo}`
              : ""}
          </Text>
          {perfil.email ? (
            <Text style={s.identidadEmail} numberOfLines={1}>
              {perfil.email}
            </Text>
          ) : null}
        </View>

        <View
          style={[s.estadoChip, !perfil.enServicio && s.estadoChipInactivo]}
        >
          <View
            style={[s.estadoPunto, !perfil.enServicio && s.estadoPuntoInactivo]}
          />
          <Text style={s.estadoTexto}>
            {perfil.enServicio ? "EN SERVICIO" : "FUERA"}
          </Text>
        </View>
      </View>

      <View style={s.identidadSeparador} />

      <View style={s.identidadDetalles}>
        <View style={s.identidadDetalle}>
          <Ionicons name="business-outline" size={m(15)} color="#AEB6E8" />
          <Text style={s.identidadDetalleTexto} numberOfLines={1}>
            {perfil.objetivo}
          </Text>
        </View>
        <View style={s.identidadDetalle}>
          <Ionicons name="time-outline" size={m(15)} color="#AEB6E8" />
          <Text style={s.identidadDetalleTexto} numberOfLines={1}>
            {perfil.turno}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function TarjetaModulo({ modulo, cantidad, onPress, s, m, ancha }) {
  const badge = modulo.etiquetaBadge(cantidad);

  return (
    <TouchableOpacity
      style={[s.modulo, ancha && s.moduloAncho]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[s.moduloEncabezado, ancha && s.moduloEncabezadoAncho]}>
        <View style={[s.moduloIcono, { backgroundColor: `${modulo.color}1A` }]}>
          <Ionicons name={modulo.icono} size={m(24)} color={modulo.color} />
        </View>
        {cantidad > 0 && (
          <View style={[s.moduloContador, { backgroundColor: modulo.color }]}>
            <Text style={s.moduloContadorTexto}>{cantidad}</Text>
          </View>
        )}
      </View>

      <View style={ancha && s.moduloTextosAncho}>
        <Text style={s.moduloTitulo} numberOfLines={1}>
          {modulo.titulo}
        </Text>
        <Text style={s.moduloSubtitulo} numberOfLines={1}>
          {modulo.subtitulo}
        </Text>
        {badge ? (
          <Text style={[s.moduloBadge, { color: modulo.color }]} numberOfLines={1}>
            {badge}
          </Text>
        ) : (
          <Text style={s.moduloBadgeVacio} numberOfLines={1}>
            Disponible
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function HomeVigi({
  onActivateMultimedia,
  contadores = CONTADORES_DEMO,
  onOpenModule,
}) {
  const { width, height } = useWindowDimensions();
  const horizontal = width > height;
  const columnas = horizontal ? 3 : 2;

  const [perfil, setPerfil] = useState(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);

  const escala = Math.max(0.8, Math.min(1.15, height / 780));
  const m = useMemo(() => (valor) => Math.round(valor * escala), [escala]);
  const s = useMemo(
    () => crearEstilos({ escala, horizontal }),
    [escala, horizontal]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingPerfil(true);
      try {
        const session = await getStoredSession();
        if (!mounted) return;
        setPerfil(perfilDesdeSesion(session));

        const data = await getMyVigiladorProfile();
        if (!mounted) return;
        if (data?.perfil) {
          setPerfil(data.perfil);
        }
      } catch (error) {
        console.warn("[HomeVigi] perfil:", error?.message || error);
        // se queda con lo de AsyncStorage
      } finally {
        if (mounted) setLoadingPerfil(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filas = useMemo(() => {
    const out = [];
    for (let i = 0; i < MODULOS.length; i += columnas) {
      out.push(MODULOS.slice(i, i + columnas));
    }
    return out;
  }, [columnas]);

  const abrirModulo = (modulo) => {
    if (onOpenModule) {
      onOpenModule(modulo.key);
      return;
    }
    Alert.alert(
      modulo.titulo,
      `El módulo "${modulo.titulo}" todavía no está implementado.`
    );
  };

  const confirmarEmergencia = () => {
    Alert.alert(
      "Reportar emergencia",
      "Se abrirá la carga de fotos y audio para adjuntar al reporte.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () => onActivateMultimedia && onActivateMultimedia(),
        },
      ]
    );
  };

  if (loadingPerfil && !perfil) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#0F76C4" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <TarjetaIdentidad
        perfil={perfil || perfilDesdeSesion(null)}
        s={s}
        m={m}
      />

      <Text style={s.seccionTitulo}>Mi escritorio</Text>

      <View style={s.grilla}>
        {filas.map((fila, indice) => (
          <View key={`fila-${indice}`} style={s.fila}>
            {fila.map((modulo) => (
              <TarjetaModulo
                key={modulo.key}
                modulo={modulo}
                cantidad={contadores[modulo.key] || 0}
                onPress={() => abrirModulo(modulo)}
                s={s}
                m={m}
                ancha={fila.length === 1}
              />
            ))}
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={s.emergencia}
        onPress={confirmarEmergencia}
        activeOpacity={0.85}
      >
        <Ionicons name="alert-circle" size={m(24)} color="white" />
        <Text style={s.emergenciaTexto}>REPORTAR EMERGENCIA</Text>
      </TouchableOpacity>
    </View>
  );
}

function crearEstilos({ escala, horizontal }) {
  const m = (valor) => Math.round(valor * escala);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#F5F7FA",
      paddingHorizontal: m(14),
      paddingTop: m(12),
      paddingBottom: m(12),
    },

    identidad: {
      borderRadius: m(16),
      padding: m(14),
      elevation: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 5,
    },
    identidadFila: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatar: {
      width: m(52),
      height: m(52),
      borderRadius: m(26),
      backgroundColor: "#EB7F27",
      justifyContent: "center",
      alignItems: "center",
      marginRight: m(12),
      overflow: "hidden",
    },
    avatarFoto: {
      width: "100%",
      height: "100%",
    },
    avatarTexto: {
      color: "white",
      fontSize: m(19),
      fontFamily: "open-sans-bold",
    },
    identidadDatos: {
      flex: 1,
    },
    identidadNombre: {
      color: "white",
      fontSize: m(18),
      fontFamily: "open-sans-bold",
    },
    identidadRol: {
      color: "#C6CCEF",
      fontSize: m(12),
      fontFamily: "open-sans",
      marginTop: 1,
    },
    identidadEmail: {
      color: "#AEB6E8",
      fontSize: m(11),
      fontFamily: "open-sans",
      marginTop: 1,
    },
    estadoChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(39, 174, 96, 0.22)",
      paddingHorizontal: m(9),
      paddingVertical: m(4),
      borderRadius: m(20),
      marginLeft: m(8),
    },
    estadoChipInactivo: {
      backgroundColor: "rgba(231, 76, 60, 0.22)",
    },
    estadoPunto: {
      width: m(7),
      height: m(7),
      borderRadius: m(4),
      backgroundColor: "#2ECC71",
      marginRight: m(5),
    },
    estadoPuntoInactivo: {
      backgroundColor: "#E74C3C",
    },
    estadoTexto: {
      color: "white",
      fontSize: m(10),
      fontFamily: "open-sans-bold",
      letterSpacing: 0.4,
    },
    identidadSeparador: {
      height: 1,
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      marginVertical: m(10),
    },
    identidadDetalles: {
      flexDirection: horizontal ? "row" : "column",
      gap: horizontal ? m(18) : m(5),
    },
    identidadDetalle: {
      flexDirection: "row",
      alignItems: "center",
      flexShrink: 1,
      ...(horizontal ? { flex: 1 } : {}),
    },
    identidadDetalleTexto: {
      color: "#DDE1F5",
      fontSize: m(12),
      fontFamily: "open-sans",
      marginLeft: m(7),
      flexShrink: 1,
    },

    seccionTitulo: {
      fontSize: m(15),
      fontFamily: "open-sans-bold",
      color: "#222266",
      marginTop: m(14),
      marginBottom: m(8),
    },
    grilla: {
      flex: 1,
      gap: m(10),
    },
    fila: {
      flex: 1,
      flexDirection: "row",
      gap: m(10),
    },
    modulo: {
      flex: 1,
      backgroundColor: "white",
      borderRadius: m(14),
      padding: m(11),
      justifyContent: "space-between",
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    moduloAncho: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
    },
    moduloEncabezado: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    moduloEncabezadoAncho: {
      flex: 0,
      marginRight: m(12),
    },
    moduloTextosAncho: {
      flex: 1,
    },
    moduloIcono: {
      width: m(42),
      height: m(42),
      borderRadius: m(12),
      justifyContent: "center",
      alignItems: "center",
    },
    moduloContador: {
      minWidth: m(22),
      height: m(22),
      borderRadius: m(11),
      paddingHorizontal: m(6),
      justifyContent: "center",
      alignItems: "center",
    },
    moduloContadorTexto: {
      color: "white",
      fontSize: m(11),
      fontFamily: "open-sans-bold",
    },
    moduloTitulo: {
      fontSize: m(15),
      fontFamily: "open-sans-bold",
      color: "#2C3E50",
    },
    moduloSubtitulo: {
      fontSize: m(11),
      fontFamily: "open-sans",
      color: "#7F8C8D",
      marginTop: 1,
    },
    moduloBadge: {
      fontSize: m(11),
      fontFamily: "open-sans-bold",
      marginTop: m(4),
    },
    moduloBadgeVacio: {
      fontSize: m(11),
      fontFamily: "open-sans",
      color: "#B2BABB",
      marginTop: m(4),
    },

    emergencia: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#E74C3C",
      borderRadius: m(12),
      paddingVertical: m(13),
      marginTop: m(12),
      elevation: 3,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    emergenciaTexto: {
      color: "white",
      fontSize: m(15),
      fontFamily: "open-sans-bold",
      letterSpacing: 0.4,
      marginLeft: m(9),
    },
  });
}

export default HomeVigi;
