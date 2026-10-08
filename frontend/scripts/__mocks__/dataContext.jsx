import { useContext, createContext } from 'react';

/* Test double for src/context/DataContext.jsx — aliased in by queue-smoke.mjs.
   The smoke test calls `configureData()` before rendering; `useData` then
   hands that object to the component tree. */
let injected = {};

export const configureData = (value) => {
  injected = value;
};

const DataContext = createContext(null);

export const DataProvider = ({ children }) => <DataContext.Provider value={injected}>{children}</DataContext.Provider>;

export const useData = () => useContext(DataContext) || injected;
