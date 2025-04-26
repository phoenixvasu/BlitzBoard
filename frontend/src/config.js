const config = {
  // API Configuration
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:8080",

  // Supabase Configuration
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,

  // Environment Flags
  isProduction: import.meta.env.PROD,
  isDevelopment: import.meta.env.DEV,

  // WebSocket Configuration
  wsProtocol: window.location.protocol === "https:" ? "wss:" : "ws:",
  wsHost: import.meta.env.VITE_WS_HOST || window.location.hostname,
  wsPort: import.meta.env.VITE_WS_PORT || "8080",

  // Build Configuration
  buildVersion: import.meta.env.VITE_BUILD_VERSION || "development",

  // Auth Configuration
  authRedirectUrl:
    import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin,
};

// Validate required environment variables
if (!config.supabaseUrl || !config.supabaseAnonKey) {
  throw new Error(
    "Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  );
}

// Log environment in development
if (config.isDevelopment) {
  console.log("Running in development mode");
  console.log("API URL:", config.apiUrl);
  console.log("WebSocket Protocol:", config.wsProtocol);
  console.log("WebSocket Host:", config.wsHost);
  console.log("WebSocket Port:", config.wsPort);
  console.log("Auth Redirect URL:", config.authRedirectUrl);
}

export default config;
