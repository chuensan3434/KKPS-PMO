export const isLocalMockDataMode =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_LOCAL_MOCK_DATA === "true";

export const dataModeLabel = isLocalMockDataMode ? "Local Mock Data" : "Supabase";
