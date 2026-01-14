import React, { Component, ErrorInfo, ReactNode } from 'react';
import styles from '../styles/App.module.css'
import { importMetaEnv } from '../utils/import-meta'

const runtimeEnv = (() => {
  if (Object.keys(importMetaEnv).length) {
    return importMetaEnv as Record<string, any>
  }

  const globalProcess = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined
  const nodeEnv = globalProcess?.env?.NODE_ENV

  return {
    MODE: nodeEnv ?? 'development',
    PROD: nodeEnv === 'production'
  }
})()

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID for tracking
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external service in production
    if (runtimeEnv['PROD']) {
      this.logErrorToService(error, errorInfo);
    }

    // Emit custom event for testing
    window.dispatchEvent(new CustomEvent('errorBoundaryTriggered', {
      detail: {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId
      }
    }));
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // Implementation for external error logging service
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          errorId: this.state.errorId
        })
      }).catch(logError => {
        console.error('Failed to log error to service:', logError);
      });
    } catch (logError) {
      console.error('Error in logErrorToService:', logError);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div
          className="error-boundary"
          data-testid="error-boundary"
          data-error-id={this.state.errorId}
        >
          <div className="error-boundary__container">
            <h2 data-testid="error-title">Oops! Something went wrong</h2>
            <div className="error-boundary__content">
              <p data-testid="error-message">
                We're sorry, but something unexpected happened.
                Please try refreshing the page or contact support if the problem persists.
              </p>

              {runtimeEnv['MODE'] === 'development' && this.state.error && (
                <details className="error-boundary__details" data-testid="error-details">
                  <summary>Error Details (Development Only)</summary>
                  <div className="error-boundary__error">
                    <h4>Error:</h4>
                    <pre data-testid="error-stack">{this.state.error.message}</pre>
                    {this.state.error.stack && (
                      <pre data-testid="error-stack-trace">{this.state.error.stack}</pre>
                    )}
                  </div>
                  {this.state.errorInfo && (
                    <div className="error-boundary__component-stack">
                      <h4>Component Stack:</h4>
                      <pre data-testid="component-stack">{this.state.errorInfo.componentStack}</pre>
                    </div>
                  )}
                </details>
              )}
            </div>

            <div className="error-boundary__actions">
              <button
                onClick={this.handleRetry}
                className="error-boundary__button error-boundary__button--retry"
                data-testid="error-retry-button"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="error-boundary__button error-boundary__button--reload"
                data-testid="error-reload-button"
              >
                Reload Page
              </button>
            </div>

            {this.state.errorId && (
              <div className="error-boundary__error-id" data-testid="error-id">
                Error ID: {this.state.errorId}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// Error display component for non-boundary errors
export const ErrorDisplay: React.FC<{
  error: string | null
  onRetry?: () => void
  onClear?: () => void
}> = ({ error, onRetry, onClear }) => {
  if (!error) return null

  return (
    <div
      className={styles.card}
      style={{
        backgroundColor: 'var(--color-error-surface)',
        borderColor: 'var(--color-error)',
        marginBottom: 'var(--spacing-lg)'
      }}
    >
      <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gapMd}`}>
        <span style={{ color: 'var(--color-error)', fontSize: '1.25rem' }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ color: 'var(--color-error)', margin: '0 0 0.5rem 0' }}>
            Error
          </h4>
          <p style={{ margin: '0 0 1rem 0' }}>{error}</p>
          <div className={`${styles.flex} ${styles.gapSm}`}>
            {onRetry && (
              <button
                className={styles.button}
                onClick={onRetry}
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                Retry
              </button>
            )}
            {onClear && (
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={onClear}
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
