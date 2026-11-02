/**
 * React Error Boundary component to catch rendering errors and prevent blank white screens.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  declare props: Readonly<Props>;
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[StarPass Crash Prevented] Error boundary caught error:", error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    try {
      localStorage.setItem('starpass_role', 'customer');
      localStorage.setItem('starpass_adminSubView', 'dashboard');
      localStorage.removeItem('starpass_adminUser');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-xl p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border border-red-100">
              <AlertTriangle size={28} />
            </div>
            
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-800">畫面渲染防護機制已啟動</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                系統偵測到底層資料解析或元件渲染異常，已自動為您攔截白屏崩潰。
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 text-left overflow-auto max-h-28">
                {this.state.error.message}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RefreshCw size={14} />
                <span>重新整理頁面</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Home size={14} />
                <span>返回前台</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
