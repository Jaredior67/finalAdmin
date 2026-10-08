/* Test double for src/context/AuthContext.jsx — aliased in by queue-smoke.mjs */
let injected = {};

export const configureAuth = (value) => {
  injected = value;
};

export const useAuth = () => injected;
