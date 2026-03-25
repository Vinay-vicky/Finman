import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI crashed inside ErrorBoundary:', error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
          <div className="max-w-lg w-full glass-panel p-8 text-center">
            <h1 className="text-2xl font-bold mb-3 text-red-400">Something went wrong</h1>
            <p className="text-slate-300 mb-6">
              FinMan hit an unexpected UI error. Your data is safe, and a refresh usually fixes it.
            </p>
            <button
              onClick={this.handleRefresh}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-colors"
            >
              Refresh App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
