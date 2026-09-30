import { createContext, useCallback, useContext, useState } from "react";

type ModalChrome = { bottomNavHidden: boolean; setBottomNavHidden: (hidden: boolean) => void };
const Context = createContext<ModalChrome>({ bottomNavHidden: false, setBottomNavHidden: () => {} });

export function ModalChromeProvider({ children }: { children: React.ReactNode }) {
  const [bottomNavHidden, setHidden] = useState(false);
  const setBottomNavHidden = useCallback((hidden: boolean) => setHidden(hidden), []);
  return <Context.Provider value={{ bottomNavHidden, setBottomNavHidden }}>{children}</Context.Provider>;
}

export const useModalChrome = () => useContext(Context);
