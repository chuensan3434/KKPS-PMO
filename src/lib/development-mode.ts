const localMockEnabled = process.env.NEXT_PUBLIC_LOCAL_MOCK_DATA === "true";
const previewDemoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const isDemoMode =
  (process.env.NODE_ENV === "development" && localMockEnabled) ||
  (process.env.VERCEL_ENV === "preview" && previewDemoEnabled);

// Kept as an alias so existing repository defaults continue to use one mode-selection path.
export const isLocalMockDataMode = isDemoMode;

export const dataModeLabel = isDemoMode ? "Demo Mode" : "Supabase";
