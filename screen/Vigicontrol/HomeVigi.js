import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getMyVigiladorProfile,
  getMisAsignacionesApp,
  getMisDespachosApp,
  getMisRondasApp,
  getMisNovedadesApp,
  getMisAccesosApp,
  getMiHombreVivoApp,
  getGeoInterval,
  getStoredSession,
} from "../../util/NuevaApi";
import { formatHoraBA } from "../../util/horaBA";

const CONTADORES_DEMO = {
  asignaciones: 0,
  rondas: 0,
  accesos: 0,
  novedades: 0,
  hombreVivo: 0,
};

const MODULOS = [
  {
    key: "asignaciones",
    titulo: "Asignaciones",
    subtitulo: "Pendientes de tomar",
    icono: "clipboard-outline",
    color: "#EB7F27",
    etiquetaBadge: (n) =>
      n > 0 ? `${n} pendiente${n === 1 ? "" : "s"}` : "Sin pendientes",
  },
  {
    key: "rondas",
    titulo: "Rondas",
    subtitulo: "Recorridos del turno",
    icono: "walk-outline",
    color: "#2E86C1",
    etiquetaBadge: (n) =>
      n > 0 ? `${n} activa${n === 1 ? "" : "s"}` : "Sin activas",
  },
  {
    key: "accesos",
    titulo: "Accesos",
    subtitulo: "Ingresos y egresos",
    icono: "log-in-outline",
    color: "#16A085",
    etiquetaBadge: (n) => (n > 0 ? `${n} hoy` : "0 hoy"),
  },
  {
    key: "novedades",
    titulo: "Novedades",
    subtitulo: "Libro de guardia",
    icono: "document-text-outline",
    color: "#8E44AD",
    etiquetaBadge: (n) => (n > 0 ? `${n} en el turno` : "Sin novedades"),
  },
  {
    key: "hombreVivo",
    titulo: "Hombre vivo",
    subtitulo: "Confirmá el puesto",
    icono: "pulse",
    color: "#C0392B",
    etiquetaBadge: (n) => (n > 0 ? `${n} en el turno` : "Sin marcas"),
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

function objetivoLabel(cuenta) {
  if (!cuenta || typeof cuenta !== "object") return "Objetivo";
  return (
    String(cuenta.nombrefantasia || "").trim() ||
    String(cuenta.nombre || "").trim() ||
    "Objetivo"
  );
}

function formatHora(dateLike) {
  return formatHoraBA(dateLike);
}

function estadoLabel(estado) {
  const map = {
    programado: "Programado",
    activa: "En curso",
    suspendida: "Suspendida",
    finalizada: "Finalizada",
    cancelado: "Cancelado",
  };
  return map[estado] || estado || "—";
}

function isTurnoEnCurso(asig, ahora = new Date()) {
  if (!asig) return false;
  const ini = new Date(asig.inicio || asig.desde);
  const fin = new Date(asig.fin || asig.hasta);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return false;
  return (
    ["programado", "activa"].includes(asig.estado) &&
    ini.getTime() <= ahora.getTime() &&
    fin.getTime() >= ahora.getTime()
  );
}

function TarjetaIdentidad({ perfil, onSalirServicio, s, m }) {
  const iniciales = useMemo(() => {
    return String(perfil.nombre || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0].toUpperCase())
      .join("");
  }, [perfil.nombre]);

  const tieneFoto = Boolean(String(perfil.foto || "").trim());

  const confirmarSalir = () => {
    Alert.alert(
      "Salir de servicio",
      "¿Cerrar sesión y quedar fuera de servicio?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salir",
          style: "destructive",
          onPress: () => onSalirServicio && onSalirServicio(),
        },
      ],
    );
  };

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
          <Text style={s.identidadDetalleTexto} numberOfLines={1}>
            {perfil.objetivo}
            {perfil.turno && perfil.turno !== "—" ? ` · ${perfil.turno}` : ""}
          </Text>
        </View>

        <View style={s.identidadAcciones}>
          <View
            style={[s.estadoChip, !perfil.enServicio && s.estadoChipInactivo]}
          >
            <View
              style={[
                s.estadoPunto,
                !perfil.enServicio && s.estadoPuntoInactivo,
              ]}
            />
            <Text style={s.estadoTexto}>
              {perfil.enServicio ? "ON" : "OFF"}
            </Text>
          </View>

          <TouchableOpacity
            style={s.btnSalir}
            onPress={confirmarSalir}
            activeOpacity={0.85}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="exit-outline" size={m(14)} color="#FFE8E6" />
            <Text style={s.btnSalirTexto}>Salir</Text>
          </TouchableOpacity>
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

function TarjetaVigiladorActivo({ activa, loading, geoMin, s, m }) {
  const enCurso = isTurnoEnCurso(activa);
  const tiene = Boolean(activa);

  return (
    <View style={s.cardServicio}>
      <View style={s.cardServicioHeader}>
        <View style={[s.cardServicioIcono, { backgroundColor: "rgba(39,174,96,0.12)" }]}>
          <Ionicons name="shield-checkmark" size={m(20)} color="#27AE60" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardServicioTitulo} numberOfLines={1}>
            {loading
              ? "Cargando turno…"
              : tiene
                ? objetivoLabel(activa.cuentaId)
                : "Sin turno activo"}
          </Text>
          <Text style={s.cardServicioSub} numberOfLines={1}>
            {loading
              ? "…"
              : tiene
                ? `${formatHora(activa.inicio)}–${formatHora(activa.fin)}${
                    activa.notas ? ` · ${activa.notas}` : ""
                  }`
                : "Sin asignación programada"}
          </Text>
          <Text style={s.cardServicioSub} numberOfLines={1}>
            {geoMin ? `Ubicación cada ${geoMin} min` : "Ubicación cada 15 min"}
          </Text>
        </View>
        <View
          style={[
            s.estadoPill,
            enCurso ? s.estadoPillOn : s.estadoPillOff,
          ]}
        >
          <View
            style={[
              s.estadoPillDot,
              { backgroundColor: enCurso ? "#2ECC71" : "#95A5A6" },
            ]}
          />
          <Text style={s.estadoPillTexto}>
            {enCurso ? "ACTIVO" : tiene ? estadoLabel(activa.estado).toUpperCase() : "OFF"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function HomeVigi({
  onActivateMultimedia,
  onSalirServicio,
  contadores = CONTADORES_DEMO,
  onOpenModule,
}) {
  const navigation = useNavigation();
  const { height } = useWindowDimensions();
  const columnas = 2;

  const [perfil, setPerfil] = useState(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [activa, setActiva] = useState(null);
  const [loadingAsig, setLoadingAsig] = useState(true);
  const [pendientesCount, setPendientesCount] = useState(0);
  const [rondasCount, setRondasCount] = useState(0);
  const [novedadesCount, setNovedadesCount] = useState(0);
  const [hombreVivoCount, setHombreVivoCount] = useState(0);
  const [accesosCount, setAccesosCount] = useState(0);
  const [geoMin, setGeoMin] = useState(15);

  const escala = Math.max(0.8, Math.min(1.15, height / 780));
  const m = useMemo(() => (valor) => Math.round(valor * escala), [escala]);
  const s = useMemo(
    () => crearEstilos({ escala, horizontal: false }),
    [escala],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingPerfil(true);
      setLoadingAsig(true);
      try {
        const session = await getStoredSession();
        if (!mounted) return;
        setPerfil(perfilDesdeSesion(session));

        const [perfilRes, asigRes, despachoRes, rondasRes, novedadesRes, vivoRes, accesosRes, geoRes] =
          await Promise.all([
          getMyVigiladorProfile().catch((err) => {
            console.warn("[HomeVigi] perfil:", err?.message || err);
            return null;
          }),
          getMisAsignacionesApp().catch((err) => {
            console.warn("[HomeVigi] asignaciones:", err?.message || err);
            return null;
          }),
          getMisDespachosApp().catch((err) => {
            console.warn("[HomeVigi] despachos:", err?.message || err);
            return null;
          }),
          getMisRondasApp().catch((err) => {
            console.warn("[HomeVigi] rondas:", err?.message || err);
            return null;
          }),
          getMisNovedadesApp().catch((err) => {
            console.warn("[HomeVigi] novedades:", err?.message || err);
            return null;
          }),
          getMiHombreVivoApp().catch((err) => {
            console.warn("[HomeVigi] hombre vivo:", err?.message || err);
            return null;
          }),
          getMisAccesosApp().catch((err) => {
            console.warn("[HomeVigi] accesos:", err?.message || err);
            return null;
          }),
          getGeoInterval().catch((err) => {
            console.warn("[HomeVigi] keep alive:", err?.message || err);
            return null;
          }),
        ]);

        if (!mounted) return;

        if (perfilRes?.perfil) {
          const next = { ...perfilRes.perfil };
          const act = asigRes?.activa;
          if (act) {
            next.objetivo = objetivoLabel(act.cuentaId) || next.objetivo;
            next.turno = `${formatHora(act.inicio)}–${formatHora(act.fin)}`;
            next.enServicio = isTurnoEnCurso(act) || next.enServicio;
          }
          setPerfil(next);
        }

        setActiva(asigRes?.activa || null);
        setPendientesCount(Number(despachoRes?.pendientesCount) || 0);
        const abiertas = (rondasRes?.rondas || []).filter(
          (item) => item?.estado !== "cerrada",
        ).length;
        setRondasCount(abiertas);
        setNovedadesCount((novedadesRes?.novedades || []).length);
        setHombreVivoCount((vivoRes?.marcas || []).length);
        setAccesosCount(Number(accesosRes?.hoy) || 0);
        const minutos = Number(geoRes?.geoIntervalMin);
        if (Number.isFinite(minutos) && minutos >= 1) setGeoMin(Math.round(minutos));
      } catch (error) {
        console.warn("[HomeVigi] load:", error?.message || error);
      } finally {
        if (mounted) {
          setLoadingPerfil(false);
          setLoadingAsig(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const refresh = async () => {
        try {
          const [data, rondas, novedades, vivo, accesos, geo] = await Promise.all([
            getMisDespachosApp(),
            getMisRondasApp().catch(() => null),
            getMisNovedadesApp().catch(() => null),
            getMiHombreVivoApp().catch(() => null),
            getMisAccesosApp().catch(() => null),
            getGeoInterval().catch(() => null),
          ]);
          if (!alive) return;
          setPendientesCount(Number(data?.pendientesCount) || 0);
          setRondasCount(
            (rondas?.rondas || []).filter((item) => item?.estado !== "cerrada")
              .length,
          );
          setNovedadesCount((novedades?.novedades || []).length);
          setHombreVivoCount((vivo?.marcas || []).length);
          setAccesosCount(Number(accesos?.hoy) || 0);
          const minutos = Number(geo?.geoIntervalMin);
          if (Number.isFinite(minutos) && minutos >= 1) {
            setGeoMin(Math.round(minutos));
          }
        } catch {
          // silencioso
        }
      };
      refresh();
      const timer = setInterval(refresh, 12000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, []),
  );

  const filas = useMemo(() => {
    const out = [];
    for (let i = 0; i < MODULOS.length; i += columnas) {
      out.push(MODULOS.slice(i, i + columnas));
    }
    return out;
  }, [columnas]);

  const contadoresLive = useMemo(
    () => ({
      ...CONTADORES_DEMO,
      ...contadores,
      asignaciones: pendientesCount,
      rondas: rondasCount,
      novedades: novedadesCount,
      hombreVivo: hombreVivoCount,
      accesos: accesosCount,
    }),
    [contadores, pendientesCount, rondasCount, novedadesCount, hombreVivoCount, accesosCount],
  );

  const abrirModulo = (modulo) => {
    if (onOpenModule) {
      onOpenModule(modulo.key);
      return;
    }
    if (modulo.key === "asignaciones") {
      navigation.navigate("AsignacionesPendientes");
      return;
    }
    if (modulo.key === "rondas") {
      navigation.navigate("RondasTurno");
      return;
    }
    if (modulo.key === "novedades") {
      navigation.navigate("NovedadesTurno");
      return;
    }
    if (modulo.key === "hombreVivo") {
      navigation.navigate("HombreVivoTurno");
      return;
    }
    if (modulo.key === "accesos") {
      navigation.navigate("AccesosTurno");
      return;
    }
    Alert.alert(
      modulo.titulo,
      `El módulo "${modulo.titulo}" todavía no está implementado.`,
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
      <View style={s.screen}>
        <View style={s.bloqueSuperior}>
          <TarjetaIdentidad
            perfil={perfil || perfilDesdeSesion(null)}
            onSalirServicio={onSalirServicio}
            s={s}
            m={m}
          />

          <TarjetaVigiladorActivo
            activa={activa}
            loading={loadingAsig}
            geoMin={geoMin}
            s={s}
            m={m}
          />
        </View>

        <Text style={s.seccionTitulo}>Mi escritorio</Text>

        <View style={s.grilla}>
          {filas.map((fila, indice) => (
            <View key={`fila-${indice}`} style={s.filaFija}>
              {fila.map((modulo) => (
                <TarjetaModulo
                  key={modulo.key}
                  modulo={modulo}
                  cantidad={contadoresLive[modulo.key] || 0}
                  onPress={() => abrirModulo(modulo)}
                  s={s}
                  m={m}
                  ancha={false}
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
          <Ionicons name="alert-circle" size={m(22)} color="white" />
          <Text style={s.emergenciaTexto}>ENVIAR EMERGENCIA</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function crearEstilos({ escala, horizontal }) {
  const m = (valor) => Math.round(valor * escala);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#F5F7FA",
    },
    screen: {
      flex: 1,
      paddingHorizontal: m(18),
      paddingTop: m(12),
      paddingBottom: m(14),
      justifyContent: "flex-start",
    },
    bloqueSuperior: {
      gap: m(10),
      marginBottom: m(4),
    },

    identidad: {
      borderRadius: m(14),
      paddingHorizontal: m(12),
      paddingVertical: m(10),
      elevation: 3,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
    },
    identidadFila: {
      flexDirection: "row",
      alignItems: "center",
    },
    avatar: {
      width: m(42),
      height: m(42),
      borderRadius: m(21),
      backgroundColor: "#EB7F27",
      justifyContent: "center",
      alignItems: "center",
      marginRight: m(10),
      overflow: "hidden",
    },
    avatarFoto: {
      width: "100%",
      height: "100%",
    },
    avatarTexto: {
      color: "white",
      fontSize: m(16),
      fontFamily: "open-sans-bold",
    },
    identidadDatos: {
      flex: 1,
      minWidth: 0,
    },
    identidadNombre: {
      color: "white",
      fontSize: m(16),
      fontFamily: "open-sans-bold",
    },
    identidadRol: {
      color: "#C6CCEF",
      fontSize: m(11),
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
      paddingHorizontal: m(8),
      paddingVertical: m(4),
      borderRadius: m(20),
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
    identidadAcciones: {
      alignItems: "flex-end",
      gap: m(6),
      marginLeft: m(6),
    },
    btnSalir: {
      flexDirection: "row",
      alignItems: "center",
      gap: m(4),
      backgroundColor: "rgba(231, 76, 60, 0.28)",
      borderWidth: 1,
      borderColor: "rgba(255, 180, 170, 0.35)",
      paddingHorizontal: m(8),
      paddingVertical: m(5),
      borderRadius: m(8),
    },
    btnSalirTexto: {
      color: "#FFE8E6",
      fontSize: m(10),
      fontFamily: "open-sans-bold",
      letterSpacing: 0.2,
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
      fontSize: m(11),
      fontFamily: "open-sans",
      marginTop: 2,
    },

    cardServicio: {
      marginTop: 0,
      backgroundColor: "white",
      borderRadius: m(12),
      paddingHorizontal: m(10),
      paddingVertical: m(9),
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
    },
    cardServicioHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: m(8),
    },
    cardServicioIcono: {
      width: m(34),
      height: m(34),
      borderRadius: m(10),
      justifyContent: "center",
      alignItems: "center",
    },
    cardServicioTitulo: {
      fontSize: m(13),
      fontFamily: "open-sans-bold",
      color: "#222266",
    },
    cardServicioSub: {
      fontSize: m(11),
      fontFamily: "open-sans",
      color: "#7F8C8D",
      marginTop: 1,
    },
    cardServicioBody: {
      marginTop: m(10),
      paddingTop: m(10),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "#E8ECF1",
    },
    cardServicioObjetivo: {
      fontSize: m(15),
      fontFamily: "open-sans-bold",
      color: "#2C3E50",
    },
    cardServicioMeta: {
      fontSize: m(12),
      fontFamily: "open-sans",
      color: "#7F8C8D",
      marginTop: 3,
    },
    cardServicioVacio: {
      marginTop: m(10),
      fontSize: m(12),
      fontFamily: "open-sans",
      color: "#95A5A6",
      lineHeight: m(17),
    },
    estadoPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: m(8),
      paddingVertical: m(4),
      borderRadius: m(20),
    },
    estadoPillOn: {
      backgroundColor: "rgba(39,174,96,0.14)",
    },
    estadoPillOff: {
      backgroundColor: "rgba(149,165,166,0.18)",
    },
    estadoPillDot: {
      width: m(6),
      height: m(6),
      borderRadius: m(3),
      marginRight: m(5),
    },
    estadoPillTexto: {
      fontSize: m(9),
      fontFamily: "open-sans-bold",
      color: "#2C3E50",
      letterSpacing: 0.3,
    },
    listaAsig: {
      marginTop: m(10),
      gap: m(8),
    },
    asigRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#F8FAFC",
      borderRadius: m(10),
      paddingHorizontal: m(10),
      paddingVertical: m(8),
    },
    asigRowLeft: {
      flex: 1,
      minWidth: 0,
      marginRight: m(8),
    },
    asigNombre: {
      fontSize: m(13),
      fontFamily: "open-sans-bold",
      color: "#2C3E50",
    },
    asigMeta: {
      fontSize: m(11),
      fontFamily: "open-sans",
      color: "#7F8C8D",
      marginTop: 1,
    },
    asigChip: {
      borderRadius: m(8),
      paddingHorizontal: m(8),
      paddingVertical: m(4),
    },
    asigChipOn: {
      backgroundColor: "rgba(39,174,96,0.15)",
    },
    asigChipOff: {
      backgroundColor: "rgba(235,127,39,0.12)",
    },
    asigChipTexto: {
      fontSize: m(10),
      fontFamily: "open-sans-bold",
      color: "#EB7F27",
    },
    asigChipTextoOn: {
      color: "#1E8449",
    },

    seccionTitulo: {
      fontSize: m(13),
      fontFamily: "open-sans-bold",
      color: "#222266",
      marginTop: m(14),
      marginBottom: m(10),
    },
    grilla: {
      gap: m(12),
      marginBottom: m(14),
    },
    fila: {
      flexDirection: "row",
      gap: m(12),
    },
    filaFija: {
      flexDirection: "row",
      gap: m(12),
    },
    modulo: {
      flex: 1,
      backgroundColor: "white",
      borderRadius: m(14),
      paddingHorizontal: m(12),
      paddingTop: m(12),
      paddingBottom: m(12),
      minHeight: m(96),
      maxHeight: m(108),
      justifyContent: "space-between",
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
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
      marginBottom: m(6),
    },
    moduloEncabezadoAncho: {
      flex: 0,
      marginRight: m(12),
    },
    moduloTextosAncho: {
      flex: 1,
    },
    moduloIcono: {
      width: m(34),
      height: m(34),
      borderRadius: m(10),
      justifyContent: "center",
      alignItems: "center",
    },
    moduloContador: {
      minWidth: m(20),
      height: m(20),
      borderRadius: m(10),
      paddingHorizontal: m(5),
      justifyContent: "center",
      alignItems: "center",
    },
    moduloContadorTexto: {
      color: "white",
      fontSize: m(10),
      fontFamily: "open-sans-bold",
    },
    moduloTitulo: {
      fontSize: m(13),
      fontFamily: "open-sans-bold",
      color: "#2C3E50",
    },
    moduloSubtitulo: {
      fontSize: m(10),
      fontFamily: "open-sans",
      color: "#7F8C8D",
      marginTop: 1,
    },
    moduloBadge: {
      fontSize: m(10),
      fontFamily: "open-sans-bold",
      marginTop: m(4),
    },
    moduloBadgeVacio: {
      fontSize: m(10),
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
      paddingVertical: m(12),
      marginTop: "auto",
      elevation: 3,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    emergenciaTexto: {
      color: "white",
      fontSize: m(14),
      fontFamily: "open-sans-bold",
      letterSpacing: 0.4,
      marginLeft: m(8),
    },
  });
}

export default HomeVigi;
