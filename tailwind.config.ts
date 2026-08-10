import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      /**
       * The families the app actually loads. Without this, `font-sans` and
       * `font-mono` resolve to Tailwind's generic stacks and silently drop
       * Instrument Sans on any element that uses them.
       */
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },

      /**
       * The Driiva ladder, replacing Tailwind's generic one. This is where the
       * body typography is set: the app is written almost entirely in text-sm
       * (346 uses) and text-xs (229), so those two sizes are the reading
       * experience and Tailwind's untuned 14/20 and 12/16 were the whole of it.
       *
       * Each step carries its own leading and tracking. Leading opens at
       * reading sizes and tightens as the type grows structural, and tracking
       * runs from slightly positive at caption size to -0.034em at display,
       * which is what keeps a large number from reading as loose.
       */
      fontSize: {
        xs: ["12px", { lineHeight: "17px", letterSpacing: "0.005em" }],
        sm: ["15px", { lineHeight: "22px", letterSpacing: "-0.005em" }],
        base: ["16px", { lineHeight: "24px", letterSpacing: "-0.006em" }],
        lg: ["18px", { lineHeight: "25px", letterSpacing: "-0.014em" }],
        xl: ["20px", { lineHeight: "26px", letterSpacing: "-0.02em" }],
        "2xl": ["24px", { lineHeight: "30px", letterSpacing: "-0.024em" }],
        "3xl": ["30px", { lineHeight: "34px", letterSpacing: "-0.028em" }],
        "4xl": ["36px", { lineHeight: "38px", letterSpacing: "-0.03em" }],
        "5xl": ["48px", { lineHeight: "48px", letterSpacing: "-0.032em" }],
        "6xl": ["60px", { lineHeight: "58px", letterSpacing: "-0.034em" }],
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
