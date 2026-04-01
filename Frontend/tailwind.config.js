/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            colors: {
                dark: {
                    primary: '#0b1622',
                    secondary: '#151f2e',
                    tertiary: '#1a2634',
                    nav: '#11161d',
                    border: '#253245',
                },
                accent: {
                    blue: '#3db4f2',
                    'blue-hover': '#47bff5',
                    red: '#e85d75',
                    green: '#4caf50',
                    orange: '#ef881a',
                    yellow: '#f7c948',
                },
                text: {
                    primary: '#c7d5e0',
                    secondary: '#8899aa',
                    bright: '#edf1f5',
                },
            },
            fontFamily: {
                overpass: ['Overpass', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
            },
            maxWidth: {
                'container': '1520px',
            },
        },
    },
    plugins: [],
};
