const isDevelopment = import.meta.env.DEV

export const devLog = (...args: unknown[]) => {
  if (isDevelopment) {
    console.log(...args)
  }
}

export const devWarn = (...args: unknown[]) => {
  if (isDevelopment) {
    console.warn(...args)
  }
}

export const devError = (...args: unknown[]) => {
  if (isDevelopment) {
    console.error(...args)
  }
}

