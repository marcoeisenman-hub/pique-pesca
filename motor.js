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

  /* pesos según tipo de agua (Codex + Claude, orientativos) */
  const PESOS = {
    pacifico: { marea: 0.38, luz: 0.27, clima: 0.2, luna: 0.15 },
    caribe: { marea: 0.12, luz: 0.36, clima: 0.36, luna: 0.16 },
    dulce: { marea: 0, luz: 0.45, clima: 0.4, luna: 0.15 },
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
    let marea = null, mareaRate = null, rango = 0, maxRate = 0;
    const mareaArr = lugar.tipo !== "dulce" ? limpiar(datos.marea) : null;
    if (mareaArr) {
      const f = pchip(mareaArr);
      marea = new Float32Array(LARGO);
      mareaRate = new Float32Array(LARGO);
      for (let k = 0; k < LARGO; k++) marea[k] = f(idxHora(T0 + k));
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
      for (let k = MARGEN; k < MARGEN + N; k++) {
        const p = mareaRate[k - 1], q = mareaRate[k];
        if (p > 0 && q <= 0) eventos.push({ t: k - MARGEN, tipo: "marea", texto: `Marea alta · ${marea[k].toFixed(1)} m` });
        if (p < 0 && q >= 0) eventos.push({ t: k - MARGEN, tipo: "marea", texto: `Marea baja · ${marea[k].toFixed(1)} m` });
      }
    }
    eventos.sort((a, b) => a.t - b.t);

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

    const puntaje = new Uint8Array(N);
    const comp = { marea: new Uint8Array(N), luz: new Uint8Array(N), clima: new Uint8Array(N), luna: new Uint8Array(N) };
    const detalle = new Array(N);

    for (let m = 0; m < N; m++) {
      const k = m + MARGEN, hi = idxHora(m);

      // marea: agua moviéndose = mejor; subiendo un poco mejor
      let cMarea = 0, rate = 0;
      if (marea) {
        rate = mareaRate[k];
        const flujo = maxRate > 0 ? Math.abs(rate) / maxRate : 0;
        cMarea = clamp(Math.pow(flujo, 0.75) * (rate > 0 ? 1 : 0.9) * (0.55 + 0.45 * fuerzaMarea), 0, 1);
      }

      // luz: amanecer y atardecer mandan; mediodía con sol fuerte es lo peor
      const alt = solAlt[k];
      let cLuz;
      if (alt > 0) cLuz = 0.42 - 0.3 * Math.min(1, alt / 70);
      else cLuz = 0.32 + 0.18 * fase.fraccion; // de noche ayuda la luna llena
      let crep = 0;
      for (const t of salidaSol) crep = Math.max(crep, gauss(m - (t + 15), 55));
      for (const t of puestaSol) crep = Math.max(crep, gauss(m - (t - 15), 55));
      cLuz = Math.max(cLuz, crep);
      const nubes = fNub(hi);
      if (nubes != null && alt > 25 && nubes > 60) cLuz = Math.min(1, cLuz + 0.12); // nublado al mediodía ayuda

      // luna (solunar): periodos mayores ±1 h, menores ±30 min, fuerza según fase
      let sol = 0.08;
      for (const e of mayores) sol = Math.max(sol, gauss(m - e.t, 42));
      for (const e of menores) sol = Math.max(sol, 0.7 * gauss(m - e.t, 22));
      const cLuna = clamp(sol * (0.7 + 0.3 * faseFuerza), 0, 1);

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
        if (cod >= 95) { cClima = Math.min(cClima, 0.1); aviso = "Tormenta eléctrica: no salgas al agua"; }
        else if (v > 35 || (o != null && o > 2.8)) aviso = "Mar picado o mucho viento: cuidado en lancha";
        cClima = clamp(cClima, 0, 1);
      }

      let total = pesos.marea * cMarea + pesos.luz * cLuz + pesos.clima * cClima + pesos.luna * cLuna;
      if (lugar.tipo === "dulce") total *= 0.93; // sin marea hay menos señales fuertes
      if (aviso && cod >= 95) total = Math.min(total, 0.15);
      puntaje[m] = clamp(Math.round(100 * Math.pow(total, 0.92)), 1, 100);
      comp.marea[m] = Math.round(cMarea * 100);
      comp.luz[m] = Math.round(cLuz * 100);
      comp.clima[m] = Math.round(cClima * 100);
      comp.luna[m] = Math.round(cLuna * 100);
      detalle[m] = { rate, viento: v, rafagas: r, olas: o, lluvia: ll, aviso, solAlt: alt };
    }

    return {
      puntaje, comp, detalle, eventos, pesos,
      marea: marea ? marea.subarray(MARGEN, MARGEN + N) : null,
      mareaTodo: marea, margen: MARGEN, rango,
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

  const api = { calcularDia, etiqueta, faseLuna, nombreFase, pchip, limpiar, mejoresRatos, PESOS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Motor = api;
})(typeof window !== "undefined" ? window : globalThis);
