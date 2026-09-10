/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4E7D4B',
          dark: '#2F5D34',
          light: '#DDEDD9',
        },
        secondary: '#C89A2B',
        accent: '#E86A1D',
        success: '#2E8B57',
        warning: '#F4B400',
        danger: '#D64545',
        info: '#2563EB',
        background: '#F8FAF9',
        surface: '#FFFFFF',
        border: '#D9E2D8',
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'display': ['36px', { lineHeight: '1.2', fontWeight: '700' }],
        'page-title': ['30px', { lineHeight: '1.3', fontWeight: '700' }],
        'section-heading': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'card-title': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'subheading': ['18px', { lineHeight: '1.4', fontWeight: '500' }],
        'nav': ['16px', { lineHeight: '1.5', fontWeight: '500' }],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 24px rgba(78,125,75,0.15)',
        'sidebar': '4px 0 16px rgba(0,0,0,0.1)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
