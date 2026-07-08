"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";
import { CommandPalette } from "@/components/command-palette";
import { AppProviders } from "@/lib/providers";
import { useAuth } from "@/lib/auth-context";
import { ROUTES } from "@/lib/constants";
import { getPostVerificationRoute } from "@/lib/signup-progress";
import { ToastContainer } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/ui/error-boundary";

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, session, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const handleMenuClick = useCallback(() => setSidebarOpen(true), []);
  const handleClose = useCallback(() => setSidebarOpen(false), []);
  const handleOpenCommandPalette = useCallback(
    () => setCommandPaletteOpen(true),
    [],
  );
  const handleCloseCommandPalette = useCallback(
    () => setCommandPaletteOpen(false),
    [],
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(ROUTES.LOGIN);
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !user.emailVerifiedAt) {
      router.replace(
        `${ROUTES.VERIFY_EMAIL}?email=${encodeURIComponent(user.email)}`,
      );
    }
  }, [isAuthenticated, isLoading, router, user]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && session && user?.emailVerifiedAt) {
      getPostVerificationRoute(session.token).then((route) => {
        if (route === ROUTES.ONBOARDING) {
          router.replace(ROUTES.ONBOARDING);
        }
      });
    }
  }, [isAuthenticated, isLoading, router, session, user]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isLoading || !isAuthenticated || (user && !user.emailVerifiedAt)) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#eaedeb" }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#60b4af]/20 border-t-[#60b4af]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#eaedeb" }}>
      <Sidebar isOpen={sidebarOpen} onClose={handleClose} />

      <div className="lg:ml-[15.5rem] relative min-h-screen flex flex-col">
        <TopBar
          onMenuClick={handleMenuClick}
          onCommandPaletteOpen={handleOpenCommandPalette}
        />
        <main
          data-gsap-scope
          className="flex-1 px-3.5 py-4 sm:px-5 sm:py-5 md:p-6 lg:p-8 pb-20 sm:pb-24 overflow-x-hidden"
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={handleCloseCommandPalette}
      />
      <ToastContainer />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
