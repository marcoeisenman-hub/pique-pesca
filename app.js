/* PIQUE — interfaz: país → lugar → día minuto a minuto */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ROW = 26; // alto de cada minuto en el carrete (px)
  const DIAS = 7;
  const TIPO_NOMBRE = { pacifico: "Pacífico", caribe: "Caribe", dulce: "Agua dulce" };

  const estado = { pais: "PA", lugar: null, datos: null, dias: [], dia: 0, minuto: 0, inicios: [] };

  /* ---------- utilidades ---------- */
  function fmtHora(m, larga) {
    m = ((Math.round(m) % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60), mi = m % 60, h12 = h % 12 === 0 ? 12 : h % 12;
    const suf = h < 12 ? "a. m." : "p. m.";
    return larga === false ? `${h12}:${String(mi).padStart(2, "0")}` : `${h12}:${String(mi).padStart(2, "0")} ${suf}`;
  }
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const quitarTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  /* rampa de color: flojo (azul apagado) → pique fuerte (naranja boya) */
  const RAMPA = [[0, [62, 106, 122]], [40, [79, 179, 169]], [65, [233, 196, 106]], [84, [255, 138, 61]], [100, [255, 90, 31]]];
  function colorPuntaje(p, a) {
    for (let i = 1; i < RAMPA.length; i++) {
      if (p <= RAMPA[i][0]) {
        const [p0, c0] = RAMPA[i - 1], [p1, c1] = RAMPA[i], t = (p - p0) / (p1 - p0);
        const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
        return a == null ? `rgb(${c})` : `rgba(${c},${a})`;
      }
    }
    return "rgb(255,90,31)";
  }

  /* ---------- paso 1: país ---------- */
  function pintarPaises() {
    const cont = $("paises");
    cont.innerHTML = "";
    for (const p of window.PAISES) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "pais"; b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(p.id === estado.pais));
      b.disabled = !p.activo;
      b.innerHTML = `<span aria-hidden="true">${p.bandera}</span> ${p.nombre}${p.activo ? "" : " <small>pronto</small>"}`;
      b.addEventListener("click", () => { estado.pais = p.id; guardar("pique-pais", p.id); pintarPaises(); pintarOpciones(); $("buscar").focus(); });
      cont.appendChild(b);
    }
  }

  /* ---------- paso 2: lugar con buscador ---------- */
  let activa = -1;
  function lugaresFiltrados() {
    const q = quitarTildes($("buscar").value.trim());
    return window.LUGARES.filter((l) => l.pais === estado.pais &&
      (!q || quitarTildes(`${l.nombre} ${l.zona} ${l.peces} ${TIPO_NOMBRE[l.tipo]}`).includes(q)));
  }
  function pintarOpciones() {
    const ul = $("opciones"), lista = lugaresFiltrados();
    ul.innerHTML = "";
    activa = -1;
    if (!lista.length) { ul.innerHTML = `<li class="vacio">No encontramos ese lugar. Prueba con la provincia o el nombre de la isla.</li>`; return; }
    const orden = ["pacifico", "caribe", "dulce"];
    let i = 0;
    for (const t of orden) {
      const grupo = lista.filter((l) => l.tipo === t);
      if (!grupo.length) continue;
      const h = document.createElement("li"); h.className = "grupo-t"; h.setAttribute("role", "presentation");
      h.textContent = TIPO_NOMBRE[t]; ul.appendChild(h);
      for (const l of grupo) {
        const li = document.createElement("li");
        li.className = "opcion"; li.setAttribute("role", "option"); li.id = "op-" + l.id; li.dataset.i = i++;
        li.dataset.id = l.id;
        li.innerHTML = `<div><b>${l.nombre}</b><span>${l.zona} · ${l.peces}</span></div><em class="tipo ${l.tipo}">${l.estilo === "altamar" ? "Altamar" : l.estilo === "lancha" ? "En lancha" : "Desde la orilla"}</em>`;
        li.addEventListener("click", () => abrirLugar(l.id));
        ul.appendChild(li);
      }
    }
    $("buscar").setAttribute("aria-expanded", "true");
  }
  function moverActiva(d) {
    const ops = [...document.querySelectorAll(".opcion")];
    if (!ops.length) return;
    activa = (activa + d + ops.length) % ops.length;
    ops.forEach((o, k) => o.setAttribute("aria-selected", String(k === activa)));
    ops[activa].scrollIntoView({ block: "nearest" });
    $("buscar").setAttribute("aria-activedescendant", ops[activa].id);
  }

  /* ---------- datos ---------- */
  async function traerDatos(l) {
    const clave = "pique-datos-" + l.id;
    try {
      const c = JSON.parse(sessionStorage.getItem(clave) || "null");
      if (c && Date.now() - c.t < 30 * 60000) return c.d;
    } catch (e) {}
    const q = `latitude=${l.lat}&longitude=${l.lon}&timezone=America%2FPanama&past_days=1&forecast_days=8&timeformat=unixtime`;
    const pClima = fetch(`https://api.open-meteo.com/v1/forecast?${q}&hourly=wind_speed_10m,wind_gusts_10m,pressure_msl,precipitation,weather_code,cloud_cover`).then((r) => {
      if (!r.ok) throw new Error("clima " + r.status); return r.json();
    });
    const pMar = l.tipo === "dulce" ? Promise.resolve(null)
      : fetch(`https://marine-api.open-meteo.com/v1/marine?${q}&hourly=sea_level_height_msl,wave_height`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const [cl, mar] = await Promise.all([pClima, pMar]);
    const h = cl.hourly;
    // alinear la marea con las horas del clima por tiempo
    let marea = null, olas = null;
    if (mar && mar.hourly && mar.hourly.time) {
      const pos = new Map(mar.hourly.time.map((t, i) => [t, i]));
      marea = h.time.map((t) => (pos.has(t) ? mar.hourly.sea_level_height_msl[pos.get(t)] : null));
      olas = h.time.map((t) => (pos.has(t) ? mar.hourly.wave_height[pos.get(t)] : null));
    }
    const d = {
      tiempos: h.time, horas0: h.time[0] * 1000, marea, olas,
      viento: h.wind_speed_10m, rafagas: h.wind_gusts_10m, presion: h.pressure_msl,
      lluvia: h.precipitation, codigo: h.weather_code, nubes: h.cloud_cover,
    };
    try { sessionStorage.setItem(clave, JSON.stringify({ t: Date.now(), d })); } catch (e) {}
    return d;
  }

  /* ---------- abrir un lugar ---------- */
  async function abrirLugar(id, diaInicial) {
    const l = window.LUGARES.find((x) => x.id === id);
    if (!l) return;
    estado.lugar = l;
    guardar("pique-lugar", l.id);
    if (location.hash !== "#" + l.id) history.replaceState(null, "", "#" + l.id);
    $("elegir").hidden = true; $("dia").hidden = false;
    $("lugar-btn").hidden = false;
    $("lugar-btn").textContent = "Cambiar lugar";
    $("l-nombre").textContent = l.nombre;
    $("l-meta").textContent = `${l.zona} · ${TIPO_NOMBRE[l.tipo]} · ${l.peces}`;
    document.title = `${l.nombre} · pique`;
    $("tablero").hidden = true; $("dias").innerHTML = "";
    $("estado").textContent = "Leyendo la marea y el clima…";
    window.scrollTo(0, 0);
    try {
      const datos = await traerDatos(l);
      if (estado.lugar !== l) return;
      estado.datos = datos;
      estado.inicios = [];
      estado.dias = [];
      for (let d = 0; d < DIAS; d++) {
        const ini = datos.tiempos[24 + d * 24] * 1000;
        estado.inicios.push(ini);
        estado.dias.push(window.Motor.calcularDia(l, datos, ini));
      }
      $("estado").textContent = "";
      $("tablero").hidden = false;
      pintarDias();
      elegirDia(diaInicial || 0, true);
    } catch (e) {
      console.error(e);
      $("estado").innerHTML = `No pudimos leer la marea y el clima. Revisa tu conexión y <button type="button" id="reintentar" class="lugar-btn">vuelve a intentar</button>`;
      $("reintentar").onclick = () => abrirLugar(id, diaInicial);
    }
  }

  function pintarDias() {
    const cont = $("dias");
    cont.innerHTML = "";
    const fmt = new Intl.DateTimeFormat("es-PA", { weekday: "short", day: "numeric", timeZone: "America/Panama" });
    estado.dias.forEach((dia, d) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "dia-b"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(d === estado.dia));
      const nombre = d === 0 ? "Hoy" : d === 1 ? "Mañana" : fmt.format(new Date(estado.inicios[d] + 6 * 3600000)).replace(".", "");
      b.innerHTML = `<small>${nombre}</small><b style="color:${d === estado.dia ? "" : colorPuntaje(dia.maximo)}">${dia.maximo}</b>`;
      b.title = `Lo mejor de ese día: ${dia.maximo} de 100`;
      b.addEventListener("click", () => elegirDia(d));
      cont.appendChild(b);
    });
  }

  function minutoAhora() {
    const m = Math.floor((Date.now() - estado.inicios[0]) / 60000);
    return m >= 0 && m < 1440 ? m : null;
  }

  function elegirDia(d, inicial) {
    estado.dia = d;
    pintarDias();
    const dia = estado.dias[d];
    const ahora = minutoAhora();
    let m = d === 0 && ahora != null ? ahora : dia.mejores.slice().sort((a, b) => b.max - a.max)[0].pico;
    $("b-ahora").hidden = !(d === 0 && ahora != null);
    pintarRatos();
    medir();
    irA(m, false);
    dibujar();
    dibujarResumen();
    actualizarPanel(true);
  }

  function pintarRatos() {
    const dia = estado.dias[estado.dia], ol = $("ratos");
    ol.innerHTML = "";
    for (const r of dia.mejores) {
      const li = document.createElement("li"), b = document.createElement("button");
      b.type = "button";
      b.style.setProperty("--c", colorPuntaje(r.max));
      b.innerHTML = `<span>${fmtHora(r.ini)} a ${fmtHora(r.fin + 1)}<br><small style="color:var(--suave)">Lo mejor a las ${fmtHora(r.pico)}</small></span><b>${r.max}</b>`;
      b.addEventListener("click", () => irA(r.pico, true));
      li.appendChild(b); ol.appendChild(li);
    }
  }

  /* ---------- carrete (canvas virtual) ---------- */
  const carrete = $("carrete"), lienzo = $("lienzo"), ctx = lienzo.getContext("2d");
  let W = 0, H = 0, dpr = 1, pendiente = false;

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = carrete.clientWidth; H = carrete.clientHeight;
    lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
    lienzo.style.marginBottom = -H + "px";
    $("relleno").style.height = 1439 * ROW + H + "px";
  }
  function irA(m, suave) {
    m = Math.max(0, Math.min(1439, Math.round(m)));
    carrete.scrollTo({ top: m * ROW, behavior: suave && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
    if (!suave) { estado.minuto = m; }
  }
  function pedirDibujo() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; dibujar(); dibujarResumen(); actualizarPanel(); });
  }

  function redondo(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  }

  function dibujar() {
    const dia = estado.dias[estado.dia];
    if (!dia || !W) return;
    const S = carrete.scrollTop, yc = H / 2;
    estado.minuto = Math.max(0, Math.min(1439, Math.round(S / ROW)));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const hayMarea = !!dia.marea;
    const xTiempo = 64, xBarra = 74;
    const xMarea0 = hayMarea ? Math.round(W * (W < 520 ? 0.6 : 0.64)) : W - 12;
    const anchoBarra = xMarea0 - xBarra - (hayMarea ? 40 : 44);
    const m0 = Math.max(0, Math.floor((S - yc) / ROW) - 2), m1 = Math.min(1439, Math.ceil((S + yc) / ROW) + 2);
    const yDe = (m) => yc + m * ROW - S;

    // marea: agua rellena hasta la curva
    if (hayMarea) {
      const todo = dia.mareaTodo, mg = dia.margen;
      let mn = Infinity, mx = -Infinity;
      for (let k = mg; k < mg + 1440; k++) { mn = Math.min(mn, todo[k]); mx = Math.max(mx, todo[k]); }
      const pad = (mx - mn) * 0.08 || 0.1, x1 = W - 14;
      const xDe = (h) => xMarea0 + 8 + ((h - (mn - pad)) / (mx - mn + 2 * pad)) * (x1 - xMarea0 - 8);
      const g = ctx.createLinearGradient(xMarea0, 0, W, 0);
      g.addColorStop(0, "rgba(21,103,127,0.25)"); g.addColorStop(1, "rgba(79,179,169,0.55)");
      ctx.beginPath();
      const a = Math.max(-mg, m0 - 3), b = Math.min(1439 + mg, m1 + 3);
      ctx.moveTo(xMarea0, yDe(a));
      for (let m = a; m <= b; m++) ctx.lineTo(xDe(todo[m + mg]), yDe(m));
      ctx.lineTo(xMarea0, yDe(b));
      ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath();
      for (let m = a; m <= b; m++) { const x = xDe(todo[m + mg]), y = yDe(m); m === a ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.strokeStyle = "rgba(160,230,222,0.9)"; ctx.lineWidth = 2; ctx.stroke();
      dibujar.xBoya = xDe(todo[estado.minuto + mg]);
      // escala de marea
      ctx.fillStyle = "rgba(243,235,221,0.45)"; ctx.font = "600 11px 'Instrument Sans', sans-serif"; ctx.textAlign = "center";
      ctx.fillText("marea", (xMarea0 + x1) / 2, 16);
    }

    // franja del minuto elegido
    ctx.fillStyle = "rgba(255,90,31,0.16)";
    ctx.fillRect(0, yc - ROW / 2, W, ROW);

    // filas de minutos
    ctx.textBaseline = "middle";
    for (let m = m0; m <= m1; m++) {
      const y = yDe(m), p = dia.puntaje[m], enHora = m % 60 === 0;
      if (enHora) {
        ctx.fillStyle = "rgba(243,235,221,0.16)";
        ctx.fillRect(0, y - ROW / 2, W, 1);
      }
      ctx.textAlign = "right";
      ctx.fillStyle = enHora || m === estado.minuto ? "#F3EBDD" : m % 15 === 0 ? "rgba(243,235,221,0.75)" : "rgba(243,235,221,0.42)";
      ctx.font = m === estado.minuto && !enHora ? "700 13px 'Instrument Sans', sans-serif" : enHora ? "800 17px 'Big Shoulders Display', sans-serif" : "500 12px 'Instrument Sans', sans-serif";
      ctx.fillText(enHora ? fmtHora(m).replace(":00", "") : fmtHora(m, false), xTiempo, y);
      const w = Math.max(4, (p / 100) * anchoBarra);
      redondo(xBarra, y - (ROW - 8) / 2, w, ROW - 8, 5);
      ctx.fillStyle = colorPuntaje(p, m === estado.minuto ? 1 : 0.82);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(243,235,221,0.7)";
      ctx.font = "700 12px 'Instrument Sans', sans-serif";
      ctx.fillText(String(p), xBarra + w + 6, y);
    }

    // eventos (amanecer, marea alta, luna…)
    ctx.font = "600 11.5px 'Instrument Sans', sans-serif";
    for (const e of dia.eventos) {
      if (e.t < m0 || e.t > m1) continue;
      const y = yDe(e.t), texto = e.texto.split(" · ")[0];
      const color = e.tipo === "sol" ? "#E9C46A" : e.tipo === "luna" ? "#CFC6FF" : "#9FE3DB";
      const tw = ctx.measureText(texto).width + 14;
      const x = hayMarea ? Math.min(xMarea0 + 6, W - tw - 6) : W - tw - 10;
      redondo(x, y - 10, tw, 20, 10);
      ctx.fillStyle = "rgba(6,40,58,0.92)"; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = color; ctx.textAlign = "left";
      ctx.fillText(texto, x + 7, y + 0.5);
    }

    // línea del minuto elegido con la boya (solo fuera de las barras para no tapar el número)
    ctx.fillStyle = "#FF5A1F";
    ctx.fillRect(0, yc - ROW / 2, 4, ROW);
    if (hayMarea) ctx.fillRect(xMarea0, yc - 1, W - xMarea0, 2);
    const xb = hayMarea ? dibujar.xBoya : W - 26;
    boya(xb, yc);
  }
  function boya(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.24);
    ctx.strokeStyle = "#F3EBDD"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, -17); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 9, Math.PI, 0); ctx.closePath(); ctx.fillStyle = "#FF5A1F"; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI); ctx.closePath(); ctx.fillStyle = "#F3EBDD"; ctx.fill();
    ctx.restore();
  }

  /* ---------- resumen del día ---------- */
  const resumen = $("resumen"), rctx = resumen.getContext("2d");
  let RW = 0, RH = 0;
  function dibujarResumen() {
    const dia = estado.dias[estado.dia];
    if (!dia) return;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    RW = resumen.clientWidth; RH = resumen.clientHeight;
    if (resumen.width !== Math.round(RW * d)) { resumen.width = Math.round(RW * d); resumen.height = Math.round(RH * d); }
    rctx.setTransform(d, 0, 0, d, 0, 0);
    rctx.clearRect(0, 0, RW, RH);
    const base = RH - 18, alto = base - 6, xDe = (m) => (m / 1439) * RW;
    // barras de puntaje por columna de pixel
    const cols = Math.max(1, Math.floor(RW / 3));
    for (let i = 0; i < cols; i++) {
      const a = Math.floor((i / cols) * 1440), b = Math.floor(((i + 1) / cols) * 1440);
      let mx = 0; for (let m = a; m < b; m++) mx = Math.max(mx, dia.puntaje[m]);
      const h = (mx / 100) * alto;
      rctx.fillStyle = colorPuntaje(mx, 0.9);
      rctx.fillRect(xDe(a), base - h, Math.max(1, RW / cols - 1), h);
    }
    // marea como línea
    if (dia.marea) {
      let mn = Infinity, mx = -Infinity;
      for (const v of dia.marea) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
      rctx.beginPath();
      for (let m = 0; m < 1440; m += 4) {
        const y = base - 4 - ((dia.marea[m] - mn) / (mx - mn || 1)) * (alto - 8);
        m === 0 ? rctx.moveTo(xDe(m), y) : rctx.lineTo(xDe(m), y);
      }
      rctx.strokeStyle = "rgba(200,245,240,0.85)"; rctx.lineWidth = 1.5; rctx.stroke();
    }
    // horas
    rctx.fillStyle = "rgba(243,235,221,0.55)"; rctx.font = "600 10.5px 'Instrument Sans', sans-serif"; rctx.textBaseline = "alphabetic";
    [0, 360, 720, 1080, 1439].forEach((m, i) => {
      rctx.textAlign = i === 0 ? "left" : i === 4 ? "right" : "center";
      rctx.fillText(["12 a. m.", "6 a. m.", "12 p. m.", "6 p. m.", "11:59 p. m."][i], xDe(m), RH - 3);
    });
    // minuto elegido
    const x = xDe(estado.minuto);
    rctx.fillStyle = "#FF5A1F"; rctx.fillRect(x - 1, 0, 2, base);
    rctx.beginPath(); rctx.arc(x, 4, 4, 0, Math.PI * 2); rctx.fill();
  }
  function saltarDesdeResumen(e) {
    const r = resumen.getBoundingClientRect();
    const m = Math.round(((e.clientX - r.left) / r.width) * 1439);
    irA(m, false); pedirDibujo();
  }
  let arrastrando = false;
  resumen.addEventListener("pointerdown", (e) => { arrastrando = true; resumen.setPointerCapture(e.pointerId); saltarDesdeResumen(e); });
  resumen.addEventListener("pointermove", (e) => { if (arrastrando) saltarDesdeResumen(e); });
  resumen.addEventListener("pointerup", () => { arrastrando = false; });
  resumen.addEventListener("pointercancel", () => { arrastrando = false; });

  /* ---------- panel del minuto ---------- */
  let ultimo = -1;
  function actualizarPanel(forzar) {
    const dia = estado.dias[estado.dia], m = estado.minuto;
    if (!dia || (!forzar && m === ultimo)) return;
    ultimo = m;
    const p = dia.puntaje[m], det = dia.detalle[m], c = colorPuntaje(p);
    document.querySelector(".ahora").style.setProperty("--c", c);
    $("num").textContent = p;
    $("aro").style.strokeDashoffset = String(326.7 * (1 - p / 100));
    $("hora").textContent = fmtHora(m);
    $("eti").textContent = window.Motor.etiqueta(p);
    $("aviso").hidden = !det.aviso; $("aviso").textContent = det.aviso || "";
    carrete.setAttribute("aria-valuenow", m);
    carrete.setAttribute("aria-valuetext", `${fmtHora(m)}, ${p} de 100, ${window.Motor.etiqueta(p)}`);

    const l = estado.lugar;
    const prox = (tipo, desde) => dia.eventos.find((e) => e.tipo === tipo && e.t > desde);
    // marea
    let tMarea;
    if (!dia.marea) tMarea = l.tipo === "dulce" ? "En el lago no hay marea: cuenta la luz, la luna y el clima." : "Sin datos de marea para este punto ahora.";
    else {
      const cm = Math.round(det.rate * 100), sig = prox("marea", m);
      tMarea = Math.abs(cm) < 6 ? "Casi parada: está cambiando la marea." : cm > 0 ? `Subiendo ${cm} cm por hora.` : `Bajando ${-cm} cm por hora.`;
      if (sig) tMarea += ` ${sig.texto.split(" · ")[0]} a las ${fmtHora(sig.t)}`;
      if (dia.rango < 0.6) tMarea += " Aquí la marea es chiquita.";
    }
    // luz
    const alt = det.solAlt;
    const amanecer = dia.eventos.find((e) => e.texto === "Amanecer"), atardecer = dia.eventos.find((e) => e.texto === "Atardecer");
    let tLuz;
    if (amanecer && Math.abs(m - amanecer.t) <= 50) tLuz = `Amanecer a las ${fmtHora(amanecer.t)}: de las mejores horas.`;
    else if (atardecer && Math.abs(m - atardecer.t) <= 50) tLuz = `Atardecer a las ${fmtHora(atardecer.t)}: de las mejores horas.`;
    else if (alt > 45) tLuz = "Sol fuerte: los peces bajan a lo hondo o a la sombra.";
    else if (alt > 0) tLuz = "De día, con el sol todavía bajo.";
    else tLuz = `De noche · ${dia.fase.nombre.toLowerCase()} (${Math.round(dia.fase.fraccion * 100)}% iluminada).`;
    // luna
    const lunas = dia.eventos.filter((e) => e.tipo === "luna");
    const cerca = lunas.find((e) => Math.abs(e.t - m) <= (e.texto.includes("mayor") ? 60 : 30));
    let tLuna;
    if (cerca) tLuna = `${cerca.texto.includes("mayor") ? "Periodo mayor" : "Periodo menor"}: ${cerca.texto.split(" · ")[0].toLowerCase()} a las ${fmtHora(cerca.t)}`;
    else {
      const sig = lunas.find((e) => e.t > m);
      tLuna = sig ? `Próximo periodo a las ${fmtHora(sig.t)} (${sig.texto.split(" · ")[0].toLowerCase()}).` : `Sin más periodos hoy · ${dia.fase.nombre.toLowerCase()}.`;
    }
    // clima
    let tClima = "Sin pronóstico del clima ahora.";
    if (det.viento != null) {
      tClima = `Viento ${Math.round(det.viento)} km/h`;
      if (det.olas != null) tClima += ` · olas ${det.olas.toFixed(1)} m`;
      if (det.lluvia > 0.3) tClima += ` · lluvia ${det.lluvia.toFixed(1)} mm`;
      tClima += ".";
    }
    const fs = [["Marea", dia.comp.marea[m], tMarea, dia.pesos.marea], ["Luz", dia.comp.luz[m], tLuz, dia.pesos.luz],
      ["Luna", dia.comp.luna[m], tLuna, dia.pesos.luna], ["Clima", dia.comp.clima[m], tClima, dia.pesos.clima]];
    $("factores").innerHTML = fs.map(([n, v, t, w]) => `<li class="factor"${w === 0 ? ' style="opacity:.55"' : ""}><span class="f-n">${n}</span><span class="f-b"><i style="width:${w === 0 ? 0 : v}%;background:${colorPuntaje(v)}"></i></span><span class="f-v">${w === 0 ? "—" : v}</span><p class="f-t">${t}</p></li>`).join("");

    const s = window.Senuelos.recomendar(l, {
      solAlt: alt, rate: det.rate, olas: det.olas, puntajeMarea: dia.marea ? dia.comp.marea[m] : 0,
      nubes: estado.datos.nubes ? estado.datos.nubes[Math.round((estado.inicios[estado.dia] + m * 60000 - estado.datos.horas0) / 3600000)] : null,
    });
    $("s-prin").textContent = s.principal;
    $("s-alt").textContent = "Si no pica: " + s.alterno.charAt(0).toLowerCase() + s.alterno.slice(1) + ".";
    $("s-col").textContent = "Colores: " + s.color.charAt(0).toLowerCase() + s.color.slice(1) + ".";
    $("s-por").textContent = s.porque;
  }

  /* ---------- eventos ---------- */
  carrete.addEventListener("scroll", pedirDibujo, { passive: true });
  carrete.addEventListener("keydown", (e) => {
    const paso = { ArrowDown: 1, ArrowUp: -1, PageDown: 60, PageUp: -60 }[e.key];
    if (paso) { e.preventDefault(); irA(estado.minuto + paso, false); pedirDibujo(); }
    if (e.key === "Home") { e.preventDefault(); irA(0); pedirDibujo(); }
    if (e.key === "End") { e.preventDefault(); irA(1439); pedirDibujo(); }
  });
  carrete.addEventListener("click", (e) => {
    const r = carrete.getBoundingClientRect(), y = e.clientY - r.top;
    irA(estado.minuto + Math.round((y - H / 2) / ROW), true);
  });
  document.querySelectorAll("[data-salto]").forEach((b) => b.addEventListener("click", () => {
    irA(estado.minuto + Number(b.dataset.salto), false); pedirDibujo();
  }));
  $("b-ahora").addEventListener("click", () => { const a = minutoAhora(); if (a != null) { if (estado.dia !== 0) elegirDia(0); irA(a, true); } });
  window.addEventListener("resize", () => { if (!$("dia").hidden) { const m = estado.minuto; medir(); irA(m, false); dibujar(); dibujarResumen(); } });

  const volver = () => {
    estado.lugar = null;
    history.replaceState(null, "", location.pathname);
    $("dia").hidden = true; $("elegir").hidden = false; $("lugar-btn").hidden = true;
    document.title = "pique · la mejor hora para pescar";
    $("buscar").value = ""; pintarOpciones(); $("buscar").focus();
  };
  $("lugar-btn").addEventListener("click", volver);
  $("ir-inicio").addEventListener("click", (e) => { e.preventDefault(); volver(); });

  $("buscar").addEventListener("input", pintarOpciones);
  $("buscar").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moverActiva(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moverActiva(-1); }
    else if (e.key === "Enter") {
      const ops = document.querySelectorAll(".opcion");
      const o = ops[activa >= 0 ? activa : 0];
      if (o) abrirLugar(o.dataset.id);
    }
  });
  window.addEventListener("hashchange", () => { const id = location.hash.slice(1); if (id && (!estado.lugar || estado.lugar.id !== id)) abrirLugar(id); });

  // las fuentes cambian el ancho del texto del carrete
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!$("dia").hidden) dibujar(); });

  /* ---------- inicio ---------- */
  const p = leer("pique-pais");
  if (p && window.PAISES.some((x) => x.id === p && x.activo)) estado.pais = p;
  pintarPaises();
  pintarOpciones();
  const id = location.hash.slice(1);
  if (id && window.LUGARES.some((l) => l.id === id)) abrirLugar(id);
})();
