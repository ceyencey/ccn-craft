import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Terjadi kesalahan tak terduga.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            background: 'var(--bg)',
            color: 'var(--tx)',
          }}
        >
          <div className="card" style={{ maxWidth: 460 }}>
            <h3 style={{ marginTop: 0 }}>Terjadi Kendala</h3>
            <p className="tag" style={{ marginBottom: 14 }}>
              Maaf, terjadi gangguan saat memuat data akun atau pesanan. Silakan muat ulang halaman.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => window.location.reload()}
            >
              Muat Ulang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
