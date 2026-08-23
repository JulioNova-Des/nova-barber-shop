/** @type {import('tailwindcss').Config} */
module.exports = {
  // Forzamos "dark mode" por defecto vía clase. La clase `dark` debe
  // aplicarse siempre en <html> (ver src/main.jsx / index.html) — NOVA
  // no ofrece modo claro, es parte de la identidad de marca.
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nova: {
          // Backgrounds — de más profundo a más "mate"
          bg: {
            deep: "#050505",   // fondo raíz / secciones hero
            main: "#080808",   // fondo principal de la app
            matte: "#111111",  // cards, inputs, superficies elevadas
          },
          // Acentos dorados
          gold: {
            DEFAULT: "#C9972B", // Oro principal (CTAs, bordes activos)
            light: "#F4C95D",   // Oro luminoso (hover, highlights, focus)
          },
          champagne: "#E8D39A", // detalles sutiles, iconografía secundaria
          // Texto
          offwhite: "#F4F2EC",
        },
      },
      fontFamily: {
        // Montserrat: titulares y llamadas a la acción
        display: ["Montserrat", "sans-serif"],
        // Inter: texto funcional / UI
        sans: ["Inter", "sans-serif"],
      },
      backgroundImage: {
        "nova-gold-gradient":
          "linear-gradient(135deg, #C9972B 0%, #F4C95D 100%)",
      },
      boxShadow: {
        "nova-gold": "0 0 0 1px rgba(201,151,43,0.35), 0 8px 24px -8px rgba(201,151,43,0.35)",
      },
      borderRadius: {
        nova: "0.625rem", // 10px — esquinas sobrias, no redondeos excesivos
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
