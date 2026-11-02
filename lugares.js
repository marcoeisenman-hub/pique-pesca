/* Lugares de pesca en Panamá. tipo: pacifico | caribe | dulce
   lat/lon apuntan al agua cerca de la costa para que el modelo de marea encuentre mar. */
window.PAISES = [
  { id: "PA", nombre: "Panamá", bandera: "🇵🇦", zona: "America/Panama", activo: true },
  { id: "CR", nombre: "Costa Rica", bandera: "🇨🇷", activo: false },
  { id: "CO", nombre: "Colombia", bandera: "🇨🇴", activo: false },
  { id: "MX", nombre: "México", bandera: "🇲🇽", activo: false },
  { id: "US", nombre: "Estados Unidos", bandera: "🇺🇸", activo: false },
];

window.LUGARES = [
  // Pacífico — Panamá y Panamá Oeste
  { pais: "PA", id: "oceanreef", nombre: "Ocean Reef Islands", zona: "Ciudad de Panamá", tipo: "pacifico", estilo: "orilla", lat: 8.968, lon: -79.505, peces: "Corvina, róbalo, pargo" },
  { pais: "PA", id: "cascoviejo", nombre: "Casco Viejo", zona: "Ciudad de Panamá", tipo: "pacifico", estilo: "orilla", lat: 8.948, lon: -79.53, peces: "Corvina, róbalo, jurel" },
  { pais: "PA", id: "costaeste", nombre: "Costa del Este", zona: "Ciudad de Panamá", tipo: "pacifico", estilo: "orilla", lat: 8.995, lon: -79.462, peces: "Corvina, róbalo, bagre" },
  { pais: "PA", id: "flamenco", nombre: "Isla Flamenco", zona: "Ciudad de Panamá", tipo: "pacifico", estilo: "orilla", lat: 8.91, lon: -79.52, peces: "Pargo, jurel, corvina" },
  { pais: "PA", id: "amador", nombre: "Calzada de Amador", zona: "Ciudad de Panamá", tipo: "pacifico", estilo: "orilla", lat: 8.905, lon: -79.53, peces: "Corvina, pargo, róbalo" },
  { pais: "PA", id: "taboga", nombre: "Isla Taboga", zona: "Panamá", tipo: "pacifico", estilo: "lancha", lat: 8.79, lon: -79.56, peces: "Pargo, jurel, sierra" },
  { pais: "PA", id: "chame", nombre: "Punta Chame", zona: "Panamá Oeste", tipo: "pacifico", estilo: "orilla", lat: 8.64, lon: -79.71, peces: "Corvina, róbalo, pargo" },
  { pais: "PA", id: "coronado", nombre: "Coronado", zona: "Panamá Oeste", tipo: "pacifico", estilo: "orilla", lat: 8.51, lon: -79.9, peces: "Sierra, jurel, pargo" },
  // Pacífico — Coclé, Herrera, Los Santos
  { pais: "PA", id: "farallon", nombre: "Farallón", zona: "Coclé", tipo: "pacifico", estilo: "orilla", lat: 8.34, lon: -80.13, peces: "Jurel, sierra, róbalo" },
  { pais: "PA", id: "parita", nombre: "Bahía de Parita", zona: "Herrera", tipo: "pacifico", estilo: "orilla", lat: 8.05, lon: -80.42, peces: "Corvina, róbalo, pargo" },
  { pais: "PA", id: "iguana", nombre: "Isla Iguana", zona: "Los Santos", tipo: "pacifico", estilo: "lancha", lat: 7.63, lon: -79.98, peces: "Pargo, jurel, pez gallo" },
  { pais: "PA", id: "pedasi", nombre: "Pedasí", zona: "Los Santos", tipo: "pacifico", estilo: "altamar", lat: 7.52, lon: -80.0, peces: "Atún aleta amarilla, dorado, pargo" },
  { pais: "PA", id: "venao", nombre: "Playa Venao", zona: "Los Santos", tipo: "pacifico", estilo: "lancha", lat: 7.42, lon: -80.19, peces: "Pez gallo, jurel, pargo" },
  { pais: "PA", id: "cambutal", nombre: "Cambutal", zona: "Los Santos", tipo: "pacifico", estilo: "altamar", lat: 7.25, lon: -80.48, peces: "Pargo, pez gallo, wahoo" },
  // Pacífico — Veraguas
  { pais: "PA", id: "catalina", nombre: "Santa Catalina", zona: "Veraguas", tipo: "pacifico", estilo: "altamar", lat: 7.61, lon: -81.26, peces: "Pargo, jurel, wahoo" },
  { pais: "PA", id: "coiba", nombre: "Isla Coiba (borde del parque)", zona: "Veraguas", tipo: "pacifico", estilo: "altamar", lat: 7.42, lon: -81.86, peces: "Marlín, dorado, atún" },
  { pais: "PA", id: "bahiahonda", nombre: "Bahía Honda", zona: "Veraguas", tipo: "pacifico", estilo: "lancha", lat: 7.72, lon: -81.55, peces: "Pargo, róbalo, jurel" },
  // Pacífico — Chiriquí
  { pais: "PA", id: "bocachica", nombre: "Boca Chica", zona: "Chiriquí", tipo: "pacifico", estilo: "lancha", lat: 8.19, lon: -82.22, peces: "Pargo, pez gallo, jurel" },
  { pais: "PA", id: "secas", nombre: "Islas Secas", zona: "Chiriquí", tipo: "pacifico", estilo: "altamar", lat: 7.95, lon: -82.02, peces: "Wahoo, dorado, atún" },
  { pais: "PA", id: "montuosa", nombre: "Isla Montuosa", zona: "Chiriquí", tipo: "pacifico", estilo: "altamar", lat: 7.47, lon: -82.24, peces: "Wahoo, atún, pargo" },
  { pais: "PA", id: "armuelles", nombre: "Puerto Armuelles", zona: "Chiriquí", tipo: "pacifico", estilo: "orilla", lat: 8.26, lon: -82.87, peces: "Pargo, sierra, róbalo" },
  // Pacífico — Las Perlas y Darién
  { pais: "PA", id: "contadora", nombre: "Contadora", zona: "Las Perlas", tipo: "pacifico", estilo: "lancha", lat: 8.62, lon: -79.04, peces: "Pargo, jurel, sierra" },
  { pais: "PA", id: "isladelrey", nombre: "Isla del Rey", zona: "Las Perlas", tipo: "pacifico", estilo: "altamar", lat: 8.37, lon: -78.86, peces: "Pargo, corvina, dorado" },
  { pais: "PA", id: "pinas", nombre: "Bahía Piñas", zona: "Darién", tipo: "pacifico", estilo: "altamar", lat: 7.56, lon: -78.22, peces: "Marlín negro, pez vela, atún" },
  { pais: "PA", id: "lapalma", nombre: "La Palma", zona: "Darién", tipo: "pacifico", estilo: "orilla", lat: 8.41, lon: -78.17, peces: "Corvina, róbalo, pargo" },
  // Caribe
  { pais: "PA", id: "sanlorenzo", nombre: "Desembocadura del Chagres", zona: "Colón", tipo: "caribe", estilo: "orilla", lat: 9.34, lon: -79.99, peces: "Sábalo (tarpón), róbalo, jurel" },
  { pais: "PA", id: "galeta", nombre: "Isla Galeta", zona: "Colón", tipo: "caribe", estilo: "orilla", lat: 9.42, lon: -79.86, peces: "Sábalo, róbalo, barracuda" },
  { pais: "PA", id: "portobelo", nombre: "Portobelo", zona: "Colón", tipo: "caribe", estilo: "orilla", lat: 9.57, lon: -79.66, peces: "Barracuda, jurel, pargo" },
  { pais: "PA", id: "islagrande", nombre: "Isla Grande", zona: "Colón", tipo: "caribe", estilo: "lancha", lat: 9.64, lon: -79.56, peces: "Barracuda, dorado, pargo" },
  { pais: "PA", id: "gunayala", nombre: "El Porvenir", zona: "Guna Yala", tipo: "caribe", estilo: "lancha", lat: 9.57, lon: -78.94, peces: "Barracuda, jurel, pargo" },
  { pais: "PA", id: "bocas", nombre: "Bocas del Toro", zona: "Bocas del Toro", tipo: "caribe", estilo: "lancha", lat: 9.36, lon: -82.22, peces: "Sábalo, róbalo, barracuda" },
  // Agua dulce
  { pais: "PA", id: "gatun", nombre: "Lago Gatún", zona: "Colón / Panamá", tipo: "dulce", estilo: "lancha", lat: 9.17, lon: -79.84, peces: "Sargento (pavón), tilapia" },
  { pais: "PA", id: "gamboa", nombre: "Gamboa (río Chagres)", zona: "Panamá", tipo: "dulce", estilo: "orilla", lat: 9.12, lon: -79.69, peces: "Sargento (pavón), sábalo pipón" },
  { pais: "PA", id: "alajuela", nombre: "Lago Alajuela", zona: "Panamá", tipo: "dulce", estilo: "lancha", lat: 9.22, lon: -79.6, peces: "Sargento (pavón), sábalo pipón" },
  { pais: "PA", id: "bayano", nombre: "Lago Bayano", zona: "Panamá Este", tipo: "dulce", estilo: "lancha", lat: 9.07, lon: -78.75, peces: "Sargento (pavón), tilapia" },
  { pais: "PA", id: "fortuna", nombre: "Lago Fortuna", zona: "Chiriquí", tipo: "dulce", estilo: "orilla", lat: 8.73, lon: -82.24, peces: "Trucha arcoíris, sargento" },
];
