import React from 'react';
import { trackEvent } from '../analytics';

interface BuilderErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class BuilderErrorBoundary extends React.Component<
  React.PropsWithChildren,
  BuilderErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): BuilderErrorBoundaryState {
    return { hasError: true, message: error.message || 'Unexpected rendering error' };
  }

  componentDidCatch(error: Error) {
    console.error('Builder render error:', error);
    trackEvent('builder_error', {
      message: error.message,
      stack: error.stack ?? 'no-stack',
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-200">
          <div className="w-full max-w-[560px] rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
            <h1 className="mb-2.5 mt-0 text-lg text-slate-50">
              The editor hit a rendering error
            </h1>
            <p className="mb-2.5 mt-0 text-[0.9rem] text-slate-400">
              Your project data is still in local storage. Reload the editor to recover.
            </p>
            <pre className="mb-3.5 mt-0 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-[0.8rem] text-slate-300">
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={this.handleReload}
              className="cursor-pointer rounded-lg border-0 bg-blue-600 px-3.5 py-2.5 font-semibold text-white hover:bg-blue-500"
            >
              Reload editor
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
