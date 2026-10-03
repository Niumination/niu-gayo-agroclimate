/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palet lama (kompatibilitas komponen transisi)
        coffee: {
          50: '#fbf7f4', 100: '#f5eee8', 200: '#eddcd1', 300: '#dfc2b1',
          400: '#cea28c', 500: '#bc846a', 600: '#a86c52', 700: '#8c5541',
          800: '#734637', 900: '#5e3a2f', 950: '#341d17',
        },
        // "Stasiun Cuaca Kebun" — palet lapangan kopi Arabika Gayo
        soil: '#1A1512',          // dasar gelap, coklat vulkanik hangat
        mist: '#E8E3DA',          // kabut dataran tinggi — teks di gelap
        leaf: '#4E7A52',          // hijau daun arabika — primer/aman
        'leaf-soft': '#8FBE93',   // tint leaf untuk teks kecil di mode gelap (AA)
        'leaf-deep': '#2F5A35',   // shade leaf untuk teks di mode terang (AA)
        cherry: '#A8392B',        // ceri matang — bahaya/karat
        'cherry-soft': '#E08B7E',
        'cherry-deep': '#8A2A1F',
        husk: '#C9A227',          // kulit kopi kering — waspada/penjemuran
        'husk-soft': '#E6C868',
        'husk-deep': '#7A6110',
        rain: '#3E6B8A',          // biru hujan — info
        'rain-soft': '#8FB6CE',
        'rain-deep': '#2C5069',
        surface: '#FAF7F2',       // kertas penjemuran (mode terang)
        ink: '#221C18',           // teks mode terang
      },
      fontFamily: {
        data: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      maxWidth: {
        shell: '1400px',
      },
      borderRadius: {
        card: '16px',
      },
    },
  },
  plugins: [],
}
