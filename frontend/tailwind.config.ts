import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          500: '#3b5bdb',
          600: '#2f4bc4',
          700: '#263d9e',
        },
      },
    },
  },
  plugins: [],
};

export default config;
