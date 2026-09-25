/** Demo mode is explicit and can never be active in a production build. */
export const demo = () =>
  process.env.SPACIE_DEMO_MODE === "true" &&
  process.env.NODE_ENV !== "production";
