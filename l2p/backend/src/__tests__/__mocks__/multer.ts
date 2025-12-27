export class MulterError extends Error {
  public code: string;
  public field?: string;
  constructor(code: string, message?: string, field?: string) {
    super(message || code);
    this.name = 'MulterError';
    this.code = code;
    this.field = field;
  }
}

type File = { originalname: string };
type Callback = (err: Error | null, value?: any) => void;

// Create a function that behaves like multer(...) and has static helpers attached
function createMulter() {
  const multerFn = ((options?: any) => {
    const storage = options?.storage;
    const fileFilter = options?.fileFilter || ((req: any, file: File, cb: Callback) => cb(null, true));
    const limits = options?.limits || {};
    const makeHandler = () => (req: any, res: any, cb: Callback) => cb(null);
    return {
      single: (_field: string) => makeHandler(),
      array: (_field: string, _max: number) => makeHandler(),
      fields: (_fields: any[]) => makeHandler(),
      storage,
      fileFilter,
      limits,
    } as any;
  }) as any;

  multerFn.diskStorage = (opts: {
    destination: (req: any, file: File, cb: Callback) => void;
    filename: (req: any, file: File, cb: Callback) => void;
  }) => opts;

  multerFn.MulterError = MulterError;

  return multerFn;
}

const multer = createMulter();

export default multer;
