"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="min-h-[400px] flex items-center justify-center p-6"
          style={{ backgroundColor: "#eaedeb" }}
        >
          <div className="text-center max-w-md">
            <div
              className="w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-6"
              style={{
                backgroundColor: "rgba(154,85,36,0.06)",
                border: "1px solid rgba(154,85,36,0.12)",
              }}
            >
              <AlertTriangle className="w-8 h-8" style={{ color: "#9a5524" }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#151f21" }}>
              Something went wrong
            </h2>
            <p className="text-sm mb-6" style={{ color: "#5e8a8d" }}>
              An unexpected error occurred. Try refreshing or go back to the
              dashboard.
            </p>
            {this.state.error && (
              <div
                className="rounded-[16px] p-4 mb-6 text-left"
                style={{
                  backgroundColor: "rgba(154,85,36,0.04)",
                  border: "1px solid rgba(154,85,36,0.10)",
                }}
              >
                <p
                  className="text-xs font-mono break-all"
                  style={{ color: "#9a5524" }}
                >
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-[14px] flex items-center gap-2 text-sm transition-colors"
                style={{
                  backgroundColor: "#FFFCF9",
                  border: "1px solid rgba(21,31,33,0.06)",
                  color: "#5e8a8d",
                  boxShadow: "0 1px 2px rgba(21,31,33,0.04)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "rgba(96,180,175,0.08)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "#60b4af";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "#60b4af";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "#FFFCF9";
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "rgba(21,31,33,0.06)";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "#5e8a8d";
                }}
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
              <Link
                href="/app"
                className="px-4 py-2.5 rounded-[14px] flex items-center gap-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: "#60b4af",
                  color: "#ffffff",
                  boxShadow: "0 1px 3px rgba(96,180,175,0.25)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                    "#4a9a95";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                    "#60b4af";
                }}
              >
                <Home className="w-4 h-4" /> Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorFallback({
  error,
  onReset,
}: {
  error?: Error | null;
  onReset?: () => void;
}) {
  return (
    <div
      className="rounded-[24px] p-6 text-center"
      style={{
        backgroundColor: "#FFFCF9",
        border: "1px solid rgba(21,31,33,0.06)",
        boxShadow: "0 1px 3px rgba(21,31,33,0.04)",
      }}
    >
      <AlertTriangle
        className="w-8 h-8 mx-auto mb-3"
        style={{ color: "#9a5524" }}
      />
      <h3 className="font-semibold mb-1" style={{ color: "#151f21" }}>
        Failed to load
      </h3>
      <p className="text-sm mb-4" style={{ color: "#5e8a8d" }}>
        {error?.message || "An unexpected error occurred."}
      </p>
      {onReset && (
        <button
          onClick={onReset}
          className="px-4 py-2 rounded-[12px] text-sm inline-flex items-center gap-2 transition-colors"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(21,31,33,0.06)",
            color: "#5e8a8d",
            boxShadow: "0 1px 2px rgba(21,31,33,0.04)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "rgba(96,180,175,0.08)";
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "#60b4af";
            (e.currentTarget as HTMLButtonElement).style.color = "#60b4af";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "#FFFCF9";
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "rgba(21,31,33,0.06)";
            (e.currentTarget as HTMLButtonElement).style.color = "#5e8a8d";
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  );
}
