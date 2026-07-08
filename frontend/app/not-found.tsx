import Link from "next/link";
import { Home, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: "#F6F3EF" }}
    >
      <div className="text-center max-w-md">
        <div className="relative mb-8">
          <div
            className="text-[120px] font-bold leading-none tracking-tighter text-transparent bg-clip-text"
            style={{
              backgroundImage: "linear-gradient(to bottom, #E7E1DA, #F6F3EF)",
            }}
          >
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: "rgba(86, 72, 216, 0.08)",
                border: "1px solid rgba(86, 72, 216, 0.2)",
              }}
            >
              <Search className="w-10 h-10 text-[#5648D8]" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-3" style={{ color: "#1B1D22" }}>
          Page not found
        </h1>
        <p className="mb-8 leading-relaxed" style={{ color: "#6F6A66" }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Check the URL or head back to the dashboard.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/app/revenue"
            className="px-5 py-2.5 text-white font-medium rounded-xl flex items-center gap-2 transition-colors text-sm"
            style={{ backgroundColor: "#5648D8" }}
          >
            <Home className="w-4 h-4" /> Dashboard
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors text-sm"
            style={{
              backgroundColor: "white",
              border: "1px solid #E7E1DA",
              color: "#6F6A66",
            }}
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>

        <p className="text-xs mt-12" style={{ color: "#C4BDB5" }}>
          If you think this is an error, contact support.
        </p>
      </div>
    </div>
  );
}
