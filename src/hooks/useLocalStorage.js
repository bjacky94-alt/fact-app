import { useEffect, useState } from "react";

const defaultAppState = {
  userProfile: {
    name: "",
    address: "",
    phone: "",
    email: "",
    siret: "",
    tvaIntra: "",
  },
  clientConfig: {
    name: "",
    address: "",
    email: "",
    phone: "",
    defaultTjm: 0,
    quotaJours: 0,
    bonCommande: "",
    paymentDelay: 60,
  },
  bankDetails: {
    bankName: "",
    iban: "",
    bic: "",
  },
  appConfig: {
    logoUrl: "",
    signatureUrl: "",
    nextInvoiceNumber: 1,
  },
};

const mergeWithDefaults = (value) => ({
  ...defaultAppState,
  ...value,
  userProfile: {
    ...defaultAppState.userProfile,
    ...(value?.userProfile || {}),
  },
  clientConfig: {
    ...defaultAppState.clientConfig,
    ...(value?.clientConfig || {}),
  },
  bankDetails: {
    ...defaultAppState.bankDetails,
    ...(value?.bankDetails || {}),
  },
  appConfig: {
    ...defaultAppState.appConfig,
    ...(value?.appConfig || {}),
  },
});

export function useLocalStorage(key = "fact-app-state") {
  const [data, setData] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (!saved) {
        return defaultAppState;
      }
      return mergeWithDefaults(JSON.parse(saved));
    } catch (error) {
      console.error("Erreur de lecture localStorage", error);
      return defaultAppState;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(data));
  }, [key, data]);

  const saveData = (updater) => {
    setData((prev) => {
      const nextValue = typeof updater === "function" ? updater(prev) : updater;
      return mergeWithDefaults(nextValue);
    });
  };

  return { data, saveData, defaultAppState };
}
