/* Qué tirar según el lugar y el momento. Reglas simples de pescadores, orientativas. */
(function (raiz) {
  "use strict";
  const SABALO = new Set(["sanlorenzo", "galeta", "bocas"]);

  function recomendar(lugar, info) {
    const { solAlt = 0, rate = 0, olas = null, nubes = null, puntajeMarea = 0 } = info;
    const momento = solAlt > 8 ? "dia" : solAlt > -8 ? "crepusculo" : "noche";
    const fuerte = puntajeMarea >= 60, floja = puntajeMarea < 25;
    const turbio = (olas != null && olas > 1.5) || (nubes != null && nubes > 75);

    let color = momento === "noche" ? "Oscuros (negro, morado) para que se vea la silueta"
      : turbio ? "Brillantes (chartreuse, rosado, dorado) porque el agua está movida o el cielo gris"
      : "Naturales (plateado, azul, blanco) con el agua clara";

    let principal, alterno, porque;

    if (lugar.tipo === "dulce") {
      if (lugar.id === "fortuna") {
        principal = "Spinner pequeño plateado (tipo cucharita giratoria)";
        alterno = "Mosca seca o ninfa cerca de la orilla";
        porque = "La trucha ataca cosas chiquitas que brillan y se mueven.";
      } else if (momento === "crepusculo") {
        principal = "Popper o señuelo de superficie que camina";
        alterno = "Spinnerbait recogido justo debajo del agua";
        porque = "Al amanecer y al atardecer el sargento sube a cazar arriba.";
      } else if (momento === "dia") {
        principal = "Crankbait que bucea, color fuego (firetiger)";
        alterno = "Gusano plástico texas cerca de troncos sumergidos";
        porque = "Con sol el sargento baja y se esconde en la estructura.";
      } else {
        principal = "Gusano plástico negro, despacio por el fondo";
        alterno = "Spinnerbait oscuro con paleta grande (hace ruido)";
        porque = "De noche el pez caza por vibración, no por vista.";
      }
      return { principal, alterno, color, porque };
    }

    if (lugar.estilo === "altamar") {
      if (momento === "noche") {
        principal = "Jig luminoso o calamar a media agua";
        alterno = "Carnada viva (bonito o calamar) a la deriva";
        porque = "De noche el calamar sube y los pelágicos lo siguen.";
      } else if (fuerte) {
        principal = "Jig vertical de 150–250 g sobre los bajos";
        alterno = "Popper grande donde rompa el agua";
        porque = "Con la marea corriendo, los peces se paran en los bajos a esperar comida.";
      } else if (momento === "crepusculo") {
        principal = "Curricán con ballyhoo o carnada viva";
        alterno = "Pulpito (señuelo de falda) rosado o azul";
        porque = "Es la hora en que marlín, dorado y atún salen a comer.";
      } else {
        principal = "Curricán: pulpito (señuelo de falda) azul y blanco a 7–8 nudos";
        alterno = "Señuelo de buceo profundo para wahoo";
        porque = "De día se cubre más agua troleando hasta encontrar el cardumen.";
      }
      return { principal, alterno, color, porque };
    }

    // costa: orilla o lancha
    if (SABALO.has(lugar.id) && momento !== "dia") {
      principal = "Swimbait tipo lisa (mullet) de 5–7 pulgadas";
      alterno = "Señuelo de superficie que camina en la boca del río";
      porque = "El sábalo entra a comer con poca luz donde el río toca el mar.";
    } else if (momento === "crepusculo") {
      principal = "Popper o stickbait blanco/plateado";
      alterno = "Jig metálico de 30–40 g recogido rápido";
      porque = "Con poca luz el pez gallo, el jurel y el róbalo atacan en la superficie.";
    } else if (momento === "noche") {
      principal = "Camarón vivo con flotador";
      alterno = "Vinil oscuro con cola de paleta, despacio";
      porque = "De noche corvina y róbalo comen pegados a las rocas y luces del muelle.";
    } else if (fuerte) {
      principal = "Jig metálico de 30–60 g, deja que baje y recoge rápido";
      alterno = "Vinil con cabeza plomada rebotando con la corriente";
      porque = "La marea moviéndose arrastra comida y los peces se activan.";
    } else if (floja) {
      principal = "Carnada viva (sardina o camarón) en el fondo";
      alterno = "Vinil pequeño trabajado muy despacio";
      porque = "Con la marea parada los peces comen poco: ponles la comida enfrente.";
    } else {
      principal = rate > 0 ? "Vinil con cabeza plomada siguiendo la marea que entra" : "Jig pequeño en las salidas de agua (bocas, canales)";
      alterno = "Señuelo de media agua (jerkbait) plateado";
      porque = rate > 0 ? "La marea que sube trae peces hacia la orilla." : "La marea que baja saca comida de los manglares y canales.";
    }
    if (lugar.estilo === "lancha" && momento === "dia" && !fuerte) {
      alterno = "Curricán lento con señuelo de buceo cerca de las islas";
    }
    return { principal, alterno, color, porque };
  }

  raiz.Senuelos = { recomendar };
})(typeof window !== "undefined" ? window : globalThis);
