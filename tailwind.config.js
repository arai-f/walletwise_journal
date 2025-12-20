/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./public/**/*.html", "./public/**/*.js"],
	theme: {
		extend: {
			colors: {
				primary: {
					DEFAULT: "var(--color-primary)",
					dark: "var(--color-primary-dark)",
					light: "var(--color-primary-light)",
					ring: "var(--color-primary-ring)",
				},
				success: {
					DEFAULT: "var(--color-success)",
					dark: "var(--color-success-dark)",
					light: "var(--color-success-light)",
				},
				danger: {
					DEFAULT: "var(--color-danger)",
					dark: "var(--color-danger-dark)",
					light: "var(--color-danger-light)",
				},
				neutral: {
					50: "var(--color-neutral-50)",
					100: "var(--color-neutral-100)",
					200: "var(--color-neutral-200)",
					300: "var(--color-neutral-300)",
					400: "var(--color-neutral-400)",
					500: "var(--color-neutral-500)",
					600: "var(--color-neutral-600)",
					700: "var(--color-neutral-700)",
					800: "var(--color-neutral-800)",
					900: "var(--color-neutral-900)",
				},
			},
		},
	},
	plugins: [],
};
