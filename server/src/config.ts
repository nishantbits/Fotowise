const required = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback
  if (!value) {
    throw new Error(`[Config] Required environment variable ${key} is not set. Check your .env file.`)
  }
  return value
}

export const config = {
  port:           parseInt(process.env.PORT ?? '3000'),
  nodeEnv:        process.env.NODE_ENV ?? 'development',
  libraryPath:    required('LIBRARY_PATH', './library'),
  dbPath:         required('DB_PATH', './data/fotowise.db'),
  clipServiceUrl: required('CLIP_SERVICE_URL', 'http://localhost:8001'),
  
  // Derived paths — all resolved from libraryPath, never from process.cwd()
  get originalsPath() { return `${this.libraryPath}/originals` },
  get thumbnailsPath() { return `${this.libraryPath}/thumbnails` },
  get modelsPath()     { return `${this.libraryPath}/models` },
  get trashPath()      { return `${this.libraryPath}/trash` },
}
