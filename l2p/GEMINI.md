# Gemini AI Service Configuration

## Model Configuration

The Gemini service has been upgraded from `gemini-1.5-flash` to `gemini-2.0-flash-exp` for improved performance and capabilities.

### Environment Variables

- `GEMINI_API_KEY`: Your Google Gemini API key
- `GEMINI_MODEL`: The Gemini model to use (defaults to `gemini-2.0-flash-exp`)

### Configuration Files Updated

The following environment files have been updated with the new model configuration:

- `.env` - Development environment
- `.env.production` - Production environment  
- `backend/.env` - Backend service environment
- `.gemini/.env` - Local Gemini configuration

### Model Options

- `gemini-2.0-flash-exp` (default) - Latest Gemini 2.0 model with enhanced capabilities
- `gemini-1.5-flash` - Previous generation model (legacy)
- `gemini-1.5-pro` - Pro version of 1.5 (legacy)

### Code Changes

The `GeminiService.ts` has been updated to:
1. Use the new `gemini-2.0-flash-exp` model by default
2. Support configurable models via the `GEMINI_MODEL` environment variable
3. Maintain backward compatibility with existing configurations

### Testing

The Gemini service tests continue to pass with the new model configuration. The service automatically falls back to the default model if no environment variable is specified.
