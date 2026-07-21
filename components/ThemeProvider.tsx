"use client";

import {
  createContext,
  useContext,
  useState,
  useLayoutEffect,
  ReactNode,
} from "react";

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false); // Default to false, will be set correctly by useEffect

  useLayoutEffect(() => {
    const saved = localStorage.getItem("trustlens-theme");
    const prefersDark = saved ? saved === "dark" : true;
    setIsDark(prefersDark);
    document.documentElement.setAttribute(
      "data-theme",
      prefersDark ? "dark" : "light",
    );
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      const themeVal = next ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", themeVal);
      localStorage.setItem("trustlens-theme", themeVal);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

// This script component is the key to fixing the flicker.
const ThemeScript = () => {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('trustlens-theme');
        // Default to dark theme if nothing is saved
        var isDark = theme ? theme === 'dark' : true;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      } catch (e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
};

// The provider now includes the script in the head.
export const ThemedLayout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <ThemeScript />
      {children}
    </>
  );
};
