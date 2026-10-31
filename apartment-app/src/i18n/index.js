import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import hi from "./hi.json";
import ta from "./ta.json";

// i18n foundation - coverage is intentionally limited for now (Sidebar nav,
// Dashboard greeting/section headers, Login form). Expand incrementally by
// adding more keys to en.json / hi.json / ta.json and calling
// useTranslation() from more components.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    ta: { translation: ta },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
