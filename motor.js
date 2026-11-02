/* PIQUE — motor: sol, luna, marea por minuto y puntaje 1-100.
   Funciona en el navegador (window.Motor) y en Node (module.exports) para pruebas. */
(function (raiz) {
  "use strict";

  const RAD = Math.PI / 180, DIA_MS = 864e5, J1970 = 2440588, J2000 = 2451545, E = RAD * 23.4397;
  const MARGEN = 240; // minutos antes y después del día para eventos cercanos

  /* ---------- astronomía (baja precisión, suficiente para minutos) ---------- */
  const dias = (ms) => ms / DIA_MS - 0.5 + J1970 - J2000;
  const ascRecta = (l, b) => Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l));
  const decl = (l, b) => Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l));
  const sidereo = (d, lw) => RAD * (280.16 + 360.9856235 * d) - lw;
  const altura = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));

  function solCoords(d) {
    const M = RAD * (357.5291 + 0.98560028 * d);
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + RAD * 102.9372 + Math.PI;
    return { dec: decl(L, 0), ra: ascRecta(L, 0) };
  }
  function lunaCoords(d) {
    const L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d);
    const l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F), dist = 385001 - 20905 * Math.cos(M);
    return { ra: ascRecta(l, b), dec: decl(l, b), dist };
  }
  /* inc: 0 = luna llena, PI = luna nueva. fraccion iluminada 0..1, creciente true/false */
  function faseLuna(ms) {
    const d = dias(ms), s = solCoords(d), m = lunaCoords(d), sd = 149598000;
    const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    const inc = Math.atan2(sd * Math.sin(phi), m.dist - sd * Math.cos(phi));
    const ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra),
      Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { inc, fraccion: (1 + Math.cos(inc)) / 2, creciente: ang < 0 };
  }
  function nombreFase(f) {
    const p = f.fraccion;
    if (p < 0.04) return "Luna nueva";
    if (p > 0.96) return "Luna llena";
    if (Math.abs(p - 0.5) < 0.08) return f.creciente ? "Cuarto creciente" : "Cuarto menguante";
    if (p < 0.5) return f.creciente ? "Luna creciente" : "Luna menguante";
    return f.creciente ? "Gibosa creciente" : "Gibosa menguante";
  }

  /* ---------- interpolación PCHIP (no inventa picos entre horas) ---------- */
  function pchip(y) {
    const n = y.length, d = new Float64Array(n), h = new Float64Array(n - 1);
    for (let i = 0; i < n - 1; i++) h[i] = y[i + 1] - y[i];
    for (let i = 1; i < n - 1; i++) {
      d[i] = h[i - 1] * h[i] <= 0 ? 0 : 2 / (1 / h[i - 1] + 1 / h[i]);
    }
    d[0] = h[0]; d[n - 1] = h[n - 2];
    return function (x) {
      if (x <= 0) return y[0];
      if (x >= n - 1) return y[n - 1];
      const i = Math.floor(x), t = x - i, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * d[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * d[i + 1];
    };
  }
  /* rellena huecos cortos (null) con interpolación lineal; devuelve null si faltan demasiados */
  function limpiar(arr) {
    if (!arr) return null;
    const v = arr.map((x) => (x == null || !isFinite(x) ? null : +x));
    const buenos = v.filter((x) => x != null).length;
    if (buenos < v.length * 0.8) return null;
    let ult = -1;
    for (let i = 0; i < v.length; i++) {
      if (v[i] == null) continue;
      if (ult === -1) for (let k = 0; k < i; k++) v[k] = v[i];
      else for (let k = ult + 1; k < i; k++) v[k] = v[ult] + ((v[i] - v[ult]) * (k - ult)) / (i - ult);
      ult = i;
    }
    for (let k = ult + 1; k < v.length; k++) v[k] = v[ult];
    return v;
  }
  const lineal = (arr) => (x) => {
    if (!arr) return null;
    const i = Math.max(0, Math.min(arr.length - 2, Math.floor(x))), t = Math.max(0, Math.min(1, x - i));
    return arr[i] + (arr[i + 1] - arr[i]) * t;
  };

  const gauss = (x, sd) => Math.exp(-(x * x) / (2 * sd * sd));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* perfil por defecto: qué tan buena es cada franja (0-1) y qué etapas de marea
     "final_llenante" = 1-2 h antes de la alta (regla de los pescadores) */
  const PERFIL_DEFECTO = {
    pacifico: { noche: 0.5, amanecer: 1, dia: 0.35, atardecer: 1, marea: ["final_llenante", "inicio_vaciante:0.8", "final_vaciante:0.6"], mareaMala: "ninguna" },
    caribe: { noche: 0.5, amanecer: 1, dia: 0.4, atardecer: 1, marea: ["cualquiera_moviendose"], mareaMala: "ninguna" },
    dulce: { noche: 0.25, amanecer: 1, dia: 0.5, atardecer: 0.95, marea: [], mareaMala: "ninguna" },
  };

  const IMP_MAREA = { pacifico: 0.85, caribe: 0.3, dulce: 0 };
  /* valor 0-1 cada hora relativa a la pleamar, de -6 h a +6 h (corvina/róbalo, investigación) */
  const CURVA_CORVINA = [0.25, 0.35, 0.5, 0.7, 0.9, 1, 0.8, 0.9, 1, 0.85, 0.65, 0.45, 0.3];
  const CURVA_ROBALO = [0.25, 0.35, 0.5, 0.7, 0.85, 0.9, 0.8, 1, 1, 0.85, 0.65, 0.45, 0.3];
  function curvaPleamar(curva, h) {
    const x = clamp(h, -6, 6) + 6, i = Math.min(11, Math.floor(x)), t = x - i;
    return curva[i] + (curva[i + 1] - curva[i]) * t;
  }
  /* lugares con luces donde la luna llena resta (las luces juntan menos carnada) */
  const CON_LUCES = new Set(["oceanreef", "cascoviejo", "amador", "flamenco", "costaeste", "armuelles"]);
  const MARLIN = new Set(["pinas", "coiba"]);

  /* pesos según tipo de agua (Codex + Claude, orientativos) */
  const PESOS = {
    pacifico: { marea: 0.34, luz: 0.36, clima: 0.14, luna: 0.16 },
    caribe: { marea: 0.1, luz: 0.45, clima: 0.3, luna: 0.15 },
    dulce: { marea: 0, luz: 0.55, clima: 0.3, luna: 0.15 },
  };

  /* ---------- un día completo para un lugar ----------
     datos: { horas0: ms UTC de la hora 0 de los arrays, marea:[m], olas:[m], viento:[km/h], rafagas, presion:[hPa], lluvia:[mm], codigo:[wmo], nubes:[%] }
     inicioMs: ms UTC de la medianoche local del día */
  function calcularDia(lugar, datos, inicioMs) {
    const N = 1440, T0 = -MARGEN, TN = N + MARGEN, LARGO = TN - T0;
    const phi = RAD * lugar.lat, lw = RAD * -lugar.lon;
    const idxHora = (min) => (inicioMs + min * 60000 - datos.horas0) / 3600000;

    // sol y luna minuto a minuto
    const solAlt = new Float32Array(LARGO), lunaAlt = new Float32Array(LARGO), lunaH = new Float32Array(LARGO);
    for (let k = 0; k < LARGO; k++) {
      const d = dias(inicioMs + (T0 + k) * 60000);
      const s = solCoords(d), m = lunaCoords(d);
      const Hs = sidereo(d, lw) - s.ra, Hm = sidereo(d, lw) - m.ra;
      solAlt[k] = altura(Hs, phi, s.dec) / RAD;
      lunaAlt[k] = altura(Hm, phi, m.dec) / RAD;
      lunaH[k] = Math.atan2(Math.sin(Hm), Math.cos(Hm)); // -PI..PI, 0 = luna arriba
    }
    const eventos = [];
    const salidaSol = [], puestaSol = [], mayores = [], menores = [];
    for (let k = 1; k < LARGO; k++) {
      const t = T0 + k;
      if (solAlt[k - 1] < -0.833 && solAlt[k] >= -0.833) salidaSol.push(t);
      if (solAlt[k - 1] >= -0.833 && solAlt[k] < -0.833) puestaSol.push(t);
      if (lunaAlt[k - 1] < 0.133 && lunaAlt[k] >= 0.133) menores.push({ t, tipo: "Sale la luna" });
      if (lunaAlt[k - 1] >= 0.133 && lunaAlt[k] < 0.133) menores.push({ t, tipo: "Se pone la luna" });
      if (lunaH[k - 1] < 0 && lunaH[k] >= 0) mayores.push({ t, tipo: "Luna en lo más alto" });
      if (lunaH[k - 1] > 2 && lunaH[k] < -2) mayores.push({ t, tipo: "Luna debajo de ti" });
    }
    const enDia = (t) => t >= 0 && t < N;
    salidaSol.filter(enDia).forEach((t) => eventos.push({ t, tipo: "sol", texto: "Amanecer" }));
    puestaSol.filter(enDia).forEach((t) => eventos.push({ t, tipo: "sol", texto: "Atardecer" }));
    mayores.filter((e) => enDia(e.t)).forEach((e) => eventos.push({ t: e.t, tipo: "luna", texto: e.tipo + " · periodo mayor" }));
    menores.filter((e) => enDia(e.t)).forEach((e) => eventos.push({ t: e.t, tipo: "luna", texto: e.tipo + " · periodo menor" }));

    const fase = faseLuna(inicioMs + 720 * 60000);
    const faseFuerza = Math.abs(Math.cos(fase.inc)); // 1 en llena/nueva, 0 en cuartos

    // marea por minuto
    let marea = null, mareaRate = null, rango = 0, maxRate = 0, rangoRef = 0, maxRateRef = 0;
    // marea: primero la predicción armónica de la estación (como las tablas oficiales); si no hay, el modelo del océano
    const est = lugar.tipo !== "dulce" ? datos.estacion : null;
    const mareaArr = est ? est.niveles : lugar.tipo !== "dulce" ? limpiar(datos.marea) : null;
    if (mareaArr) {
      const f = pchip(mareaArr);
      const idxM = est ? (min) => (inicioMs + min * 60000 - est.inicio) / est.paso : idxHora;
      marea = new Float32Array(LARGO);
      mareaRate = new Float32Array(LARGO);
      for (let k = 0; k < LARGO; k++) marea[k] = f(idxM(T0 + k));
      for (let k = 0; k < LARGO; k++) {
        const a = marea[Math.max(0, k - 5)], b = marea[Math.min(LARGO - 1, k + 5)];
        mareaRate[k] = ((b - a) / (Math.min(LARGO - 1, k + 5) - Math.max(0, k - 5))) * 60; // m por hora
      }
      let mn = Infinity, mx = -Infinity;
      for (let k = MARGEN; k < MARGEN + N; k++) {
        mn = Math.min(mn, marea[k]); mx = Math.max(mx, marea[k]);
        maxRate = Math.max(maxRate, Math.abs(mareaRate[k]));
      }
      rango = mx - mn;
      // referencia de la semana: así las mareas grandes (luna llena/nueva) valen más que las chiquitas
      if (est) {
        let gmn = Infinity, gmx = -Infinity, gr = 0;
        const nv = est.niveles;
        for (let i = 0; i < nv.length; i++) {
          gmn = Math.min(gmn, nv[i]); gmx = Math.max(gmx, nv[i]);
          if (i) gr = Math.max(gr, Math.abs(nv[i] - nv[i - 1]) * (3600000 / est.paso));
        }
        rangoRef = gmx - gmn; maxRateRef = gr;
      } else { rangoRef = rango; maxRateRef = maxRate; }
      if (est) {
        for (const e of est.extremos) {
          const t = Math.round((e.t - inicioMs) / 60000);
          if (t >= 0 && t < N) eventos.push({ t, tipo: "marea", alta: e.alta, nivel: e.nivel, texto: `Marea ${e.alta ? "alta" : "baja"} · ${e.nivel.toFixed(1)} m` });
        }
      } else {
        for (let k = MARGEN; k < MARGEN + N; k++) {
          const p = mareaRate[k - 1], q = mareaRate[k];
          if (p > 0 && q <= 0) eventos.push({ t: k - MARGEN, tipo: "marea", alta: true, nivel: marea[k], texto: `Marea alta · ${marea[k].toFixed(1)} m` });
          if (p < 0 && q >= 0) eventos.push({ t: k - MARGEN, tipo: "marea", alta: false, nivel: marea[k], texto: `Marea baja · ${marea[k].toFixed(1)} m` });
        }
      }
    }
    eventos.sort((a, b) => a.t - b.t);

    // todas las altas y bajas (con margen) para saber en qué etapa va la marea
    const extremos = [];
    if (marea && est) {
      for (const e of est.extremos) extremos.push({ t: Math.round((e.t - inicioMs) / 60000), alta: e.alta });
    } else if (marea) {
      for (let k = 1; k < LARGO; k++) {
        const p = mareaRate[k - 1], q = mareaRate[k];
        if (p > 0 && q <= 0) extremos.push({ t: T0 + k, alta: true });
        if (p < 0 && q >= 0) extremos.push({ t: T0 + k, alta: false });
      }
    }
    let mnM = 0;
    if (marea) { mnM = Infinity; for (let k = MARGEN; k < MARGEN + N; k++) mnM = Math.min(mnM, marea[k]); }

    // perfil del lugar (investigado) o uno por defecto según el tipo de agua
    const perfil = { ...PERFIL_DEFECTO[lugar.tipo], ...(lugar.perfil || {}) };
    const etapas = (perfil.marea || ["cualquiera_moviendose"]).map((e) => {
      const [n, w] = String(e).split(":"); return { n, w: w ? +w : 1 };
    });

    // clima por hora interpolado
    const pres = limpiar(datos.presion), vien = limpiar(datos.viento), olas = limpiar(datos.olas);
    const lluv = limpiar(datos.lluvia), nub = limpiar(datos.nubes), raf = limpiar(datos.rafagas);
    const fPres = lineal(pres), fVien = lineal(vien), fOlas = lineal(olas), fLluv = lineal(lluv), fNub = lineal(nub), fRaf = lineal(raf);
    const codigos = datos.codigo || [];
    const hayClima = !!vien;

    const pesos = { ...PESOS[lugar.tipo] };
    // si no hay marea en un lugar de mar, su peso pasa a luz y clima
    if (lugar.tipo !== "dulce" && !marea) {
      pesos.luz += pesos.marea / 2; pesos.clima += pesos.marea / 2; pesos.marea = 0;
    }
    // una marea casi plana no puede contar como señal fuerte
    const fuerzaMarea = marea ? clamp(rango / 1.5, 0.25, 1) : 0;

    // cuánto manda la marea en este lugar (0 = nada, 1 = todo)
    const wMarea = marea && etapas.length ? (lugar.estilo === "altamar" ? 0.15 : IMP_MAREA[lugar.tipo]) : 0;
    pesos.marea = wMarea;

    const puntaje = new Uint8Array(N);
    const comp = { marea: new Uint8Array(N), luz: new Uint8Array(N), clima: new Uint8Array(N), luna: new Uint8Array(N), fase: new Uint8Array(N) };
    const detalle = new Array(N);

    for (let m = 0; m < N; m++) {
      const k = m + MARGEN, hi = idxHora(m);

      // marea: agua moviéndose = mejor; subiendo un poco mejor
      let cMarea = 0, rate = 0;
      let etapa = null, posMarea = 0.5;
      if (marea) {
        rate = mareaRate[k];
        const flujo = maxRateRef > 0 ? Math.pow(Math.min(1, Math.abs(rate) / maxRateRef), 0.75) : 0;
        const fuerzaDia = rangoRef > 0 ? clamp(rango / rangoRef, 0, 1) : 1;
        let ant = null, sig = null;
        for (const e of extremos) { if (e.t <= m) ant = e; else { sig = e; break; } }
        const subiendo = rate > 0;
        const aAlta = sig && sig.alta ? sig.t - m : null, desdeAlta = ant && ant.alta ? m - ant.t : null;
        const aBaja = sig && !sig.alta ? sig.t - m : null, desdeBaja = ant && !ant.alta ? m - ant.t : null;
        // hora relativa a la pleamar más cercana
        let hPlea = null;
        for (const e of extremos) if (e.alta && (hPlea == null || Math.abs(m - e.t) < Math.abs(hPlea))) hPlea = m - e.t;
        const h = hPlea == null ? 0 : hPlea / 60;
        const valor = (n) => {
          switch (n) {
            case "final_llenante": return curvaPleamar(CURVA_CORVINA, h);
            case "inicio_vaciante": return curvaPleamar(CURVA_ROBALO, h);
            case "final_vaciante": return aBaja != null ? gauss(aBaja - 60, 42) : desdeBaja != null ? 0.5 * gauss(desdeBaja, 25) : 0;
            case "inicio_llenante": return desdeBaja != null ? gauss(desdeBaja - 60, 45) : 0;
            case "llenante": return subiendo ? 0.55 + 0.45 * flujo : 0.2 * flujo;
            case "vaciante": return !subiendo ? 0.55 + 0.45 * flujo : 0.2 * flujo;
            default: return flujo;
          }
        };
        let mejor = 0;
        for (const e of etapas) { const v = valor(e.n) * e.w; if (v > mejor) { mejor = v; etapa = e.n; } }
        // aguaje vs quiebra: la marea viva rinde ~1.33x más que la muerta (Pacífico, marea grande)
        let fA = 1;
        if (lugar.tipo === "pacifico") {
          fA = 0.75 + 0.25 * clamp((rango - 2.5) / 2.5, 0, 1);
          if (rango > 5.3 && ((h >= -4 && h <= -2) || (h >= 3 && h <= 5))) fA *= 0.85; // demasiada corriente a media marea
        } else fA = (0.55 + 0.45 * fuerzaDia) * fuerzaMarea; // una marea casi plana no cuenta como señal fuerte
        cMarea = clamp(mejor * fA, 0, 1);
        posMarea = rango > 0 ? (marea[k] - mnM) / rango : 0.5;
      }

      // luz: amanecer y atardecer mandan; mediodía con sol fuerte es lo peor
      const alt = solAlt[k];
      const vDia = perfil.dia * (1 - 0.2 * clamp((alt - 6) / 60, 0, 1));
      const vNoche = perfil.noche;
      let cLuz = alt >= 6 ? vDia : alt <= -6 ? vNoche : vNoche + (vDia - vNoche) * ((alt + 6) / 12);
      let gA = 0, gP = 0;
      for (const t of salidaSol) gA = Math.max(gA, gauss(m - (t + 10), 50));
      for (const t of puestaSol) gP = Math.max(gP, gauss(m - (t - 10), 50));
      cLuz = Math.max(cLuz, perfil.amanecer * gA, perfil.atardecer * gP);
      const nubes = fNub(hi);
      if (nubes != null && alt > 25 && nubes > 60 && perfil.dia < 0.7) cLuz = Math.min(1, cLuz + 0.1); // nublado al mediodía ayuda
      const franja = gA > 0.5 ? "amanecer" : gP > 0.5 ? "atardecer" : alt > 0 ? "dia" : "noche";

      // luna (solunar): periodos mayores ±1 h, menores ±30 min, fuerza según fase
      // la evidencia dice que pesa poco: como mucho +5 % en periodo mayor y +2 % en menor
      let gMay = 0, gMen = 0;
      for (const e of mayores) gMay = Math.max(gMay, gauss(m - e.t, 42));
      for (const e of menores) gMen = Math.max(gMen, gauss(m - e.t, 22));
      const multSolunar = 1 + Math.max(0.05 * gMay, 0.02 * gMen);
      const cLuna = clamp(Math.max(gMay, 0.6 * gMen), 0, 1);
      // fase de la luna
      let multFase = 1;
      const llena = fase.fraccion, crece = fase.creciente;
      if (lugar.estilo === "altamar") {
        if (MARLIN.has(lugar.id)) multFase = (!crece && llena > 0.4) || llena > 0.9 ? 1 : 0.92;
        else multFase = (crece && llena < 0.6) || llena < 0.08 ? 1 : 0.9;
      } else if (alt < -6) {
        multFase = CON_LUCES.has(lugar.id) ? 1 - 0.15 * llena : 1 - 0.05 * llena;
      }

      // clima
      let cClima = 0.75, aviso = null;
      const v = fVien(hi), r = fRaf(hi), o = fOlas(hi), ll = fLluv(hi), cod = codigos[Math.round(hi)];
      if (hayClima) {
        cClima = 1;
        if (v > 12) cClima -= Math.min(0.6, (v - 12) * 0.022);
        if (v < 3) cClima -= 0.05; // agua muy quieta
        if (r != null && r > 45) cClima -= 0.1;
        if (o != null && o > 1.4) cClima -= Math.min(0.35, (o - 1.4) * 0.22);
        if (ll != null && ll > 3) cClima -= Math.min(0.25, (ll - 3) * 0.04);
        const p0 = fPres(hi), p3 = fPres(hi - 3);
        if (p0 != null && p3 != null) {
          const dp = p0 - p3;
          if (dp < -0.8 && dp > -3) cClima += 0.06; // presión bajando poco: los peces comen antes del frente
          if (dp > 1.5) cClima -= 0.06;
        }
        if (v > 35 || (o != null && o > 2.8)) aviso = "Mar picado o mucho viento: cuidado en lancha";
        cClima = clamp(cClima, 0, 1);
      }
      // tormenta eléctrica cuenta aunque falte el viento
      if (cod >= 95) { cClima = Math.min(cClima, 0.1); aviso = "Tormenta eléctrica: no salgas al agua"; }

      // la hora y la marea se multiplican: de noche con la marea mala no sale alto
      const nucleo = cLuz * (1 - wMarea + wMarea * cMarea);
      let total = (0.8 * nucleo + 0.2 * cClima) * multSolunar * multFase;
      if (marea && perfil.mareaMala === "baja" && posMarea < 0.2) total *= 0.55 + 0.45 * (posMarea / 0.2);
      if (marea && perfil.mareaMala === "alta" && posMarea > 0.85) total *= 0.6 + 0.4 * ((1 - posMarea) / 0.15);
      if (aviso && cod >= 95) total = Math.min(total, 0.15);
      puntaje[m] = clamp(Math.round(100 * Math.pow(total, 0.92)), 1, 100);
      comp.marea[m] = Math.round(cMarea * 100);
      comp.luz[m] = Math.round(cLuz * 100);
      comp.clima[m] = Math.round(cClima * 100);
      comp.luna[m] = Math.round(cLuna * 100);
      comp.fase[m] = Math.round(multFase * 100);
      detalle[m] = { rate, etapa, franja, posMarea, viento: v, rafagas: r, olas: o, lluvia: ll, aviso, solAlt: alt };
    }

    return {
      puntaje, comp, detalle, eventos, pesos, perfil,
      marea: marea ? marea.subarray(MARGEN, MARGEN + N) : null,
      mareaTodo: marea, margen: MARGEN, rango, rangoRef, fuenteMarea: est ? "estacion" : marea ? "modelo" : null,
      fase: { ...fase, nombre: nombreFase(fase) },
      mejores: mejoresRatos(puntaje),
      maximo: puntaje.reduce((a, b) => Math.max(a, b), 0),
    };
  }

  /* los 3 mejores ratos de 60 min, separados por al menos 2 h */
  function mejoresRatos(p) {
    const L = 60, sumas = [];
    let s = 0;
    for (let i = 0; i < p.length; i++) {
      s += p[i];
      if (i >= L) s -= p[i - L];
      if (i >= L - 1) sumas.push({ ini: i - L + 1, prom: s / L });
    }
    sumas.sort((a, b) => b.prom - a.prom);
    const elegidos = [];
    for (const c of sumas) {
      if (elegidos.every((e) => Math.abs(e.ini - c.ini) >= 120)) elegidos.push(c);
      if (elegidos.length === 3) break;
    }
    return elegidos.map((e) => {
      let pico = e.ini;
      for (let i = e.ini; i < e.ini + L; i++) if (p[i] > p[pico]) pico = i;
      return { ini: e.ini, fin: e.ini + L - 1, pico, prom: Math.round(e.prom), max: p[pico] };
    }).sort((a, b) => a.ini - b.ini);
  }

  function etiqueta(p) {
    if (p >= 83) return "Pique fuerte";
    if (p >= 66) return "Muy bueno";
    if (p >= 46) return "Bueno";
    if (p >= 26) return "Regular";
    return "Flojo";
  }

  const api = { PERFIL_DEFECTO, calcularDia, etiqueta, faseLuna, nombreFase, pchip, limpiar, mejoresRatos, PESOS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Motor = api;
})(typeof window !== "undefined" ? window : globalThis);
