import * as configcat from "configcat-js";

const appLogger = {
  info: (msg: string) => console.log(`[ConfigCat] ${msg}`),
  error: (msg: string) => console.error(`[ConfigCat] ${msg}`),
  warn: (msg: string) => console.warn(`[ConfigCat] ${msg}`),
};

const configCatLogger = configcat.createConsoleLogger(configcat.LogLevel.Warn);

let configCatClient: configcat.IConfigCatClient | null = null;

export const getConfigCatClient = () => {
  if (!configCatClient) {
    const sdkKey = process.env.NEXT_PUBLIC_CONFIGCAT_SDK_KEY;
    if (!sdkKey) {
      appLogger.warn("NEXT_PUBLIC_CONFIGCAT_SDK_KEY is not set. Feature flags will default to false.");
      return null;
    }
    configCatClient = configcat.getClient(sdkKey, configcat.PollingMode.AutoPoll, {
      pollIntervalSeconds: 60,
      logger: configCatLogger,
    });
  }
  return configCatClient;
};

export const getFeatureFlag = async (key: string, defaultValue: boolean = false, user?: configcat.User): Promise<boolean> => {
  const client = getConfigCatClient();
  if (!client) {
    return defaultValue;
  }
  try {
    return await client.getValueAsync(key, defaultValue, user);
  } catch (error) {
    appLogger.error(`Error fetching flag ${key}: ${error}`);
    return defaultValue;
  }
};

export const FLAGS = {
  ENABLE_RAG_ADVANCED: "enable_rag_advanced",
  ENABLE_AUTOMATION_EXPERIMENTAL: "enable_automation_experimental",
  SHOW_DEBUG_PANELS: "show_debug_panels",
};
