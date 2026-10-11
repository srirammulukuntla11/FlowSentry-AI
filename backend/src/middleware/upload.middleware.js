import multer from 'multer';
import path from 'path';

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '2', 10);
const MAX_FILE_SIZE = MAX_UPLOAD_MB * 1024 * 1024; // Bytes

// In-memory storage: file content stays in RAM during request and is never persisted to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // 1. File extension validation (strictly .json)
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.json') {
    const error = new Error('Invalid file type. Only .json files are accepted.');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  // Accept file into buffer for deep JSON validation in parser
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Strictly accept only 1 file
  },
  fileFilter
});

// Middleware wrapper to provide consistent JSON error responses
export const handleWorkflowUpload = (req, res, next) => {
  const uploadSingle = upload.single('workflow');

  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'FILE_TOO_LARGE',
              message: `File size exceeds the limit of ${MAX_UPLOAD_MB} MB.`
            }
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'UNEXPECTED_FIELD',
              message: "Unexpected upload field. Please provide file in the 'workflow' field."
            }
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: err.code || 'UPLOAD_ERROR',
            message: `Upload error: ${err.message}`
          }
        });
      }

      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: err.message
          }
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: err.message || 'File upload failed.'
        }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE_PROVIDED',
          message: "No workflow file provided. Please attach a .json file under the 'workflow' field."
        }
      });
    }

    if (req.file.size === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_FILE',
          message: 'The uploaded workflow file is empty.'
        }
      });
    }

    next();
  });
};
