import morgan from 'morgan';

export const requestLogger = morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream: { write: (line) => console.log(`[http] ${line.trim()}`) },
});
