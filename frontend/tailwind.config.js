/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Graph Paper design tokens — kept in sync with design-tokens.css
        page: '#fafaf7',
        surface: '#ffffff',
        'surface-alt': '#f5f4f0',
        border: '#e4e1da',
        grid: '#ece9e2',
        ink: {
          DEFAULT: '#1e4d7b',
          light: '#eaf1f7',
          hover: '#163d62',
        },
        copper: {
          DEFAULT: '#b8703d',
          light: '#fdf3e8',
        },
        teal: {
          DEFAULT: '#2d8a7b',
          light: '#edf7f5',
        },
        red: {
          DEFAULT: '#c4312b',
          light: '#fef5f5',
        },
      },
      fontFamily: {
        ui: ['IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
