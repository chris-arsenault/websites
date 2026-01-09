type LogContext = Record<string, unknown>;

const baseLog = (level: "info" | "warn" | "error", message: string, context?: LogContext) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
};

export const logInfo = (message: string, context?: LogContext) => baseLog("info", message, context);
export const logWarn = (message: string, context?: LogContext) => baseLog("warn", message, context);
export const logError = (message: string, context?: LogContext) => baseLog("error", message, context);
