"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Key,
  Smartphone,
  Monitor,
  Globe,
  AlertTriangle,
  CheckCircle,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Clock,
} from "lucide-react";
import {
  AlertBanner,
  PageHeader,
  Card,
  StatCard,
  StatCardSkeleton,
  TableRowSkeleton,
  Toggle,
} from "@/components/ui";
import { DataTable, TableRow, TableCell } from "@/components/ui/tables";
import { api, getStoredAuthSession } from "@/lib/api-client";
import type { BackendSecurityEvent, BackendSession } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type SessionRow = {
  id: string;
  device: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
};

type SecurityEventRow = {
  id: string;
  action: string;
  device: string;
  location: string;
  time: string;
  status: "success" | "failed";
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function summariseUserAgent(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  const browser = userAgent.includes("Firefox")
    ? "Firefox"
    : userAgent.includes("Edg")
      ? "Edge"
      : userAgent.includes("Chrome")
        ? "Chrome"
        : userAgent.includes("Safari")
          ? "Safari"
          : "Browser";
  const os = userAgent.includes("Windows")
    ? "Windows"
    : userAgent.includes("Mac")
      ? "MacOS"
      : userAgent.includes("iPhone")
        ? "iPhone"
        : userAgent.includes("Android")
          ? "Android"
          : "Device";

  return `${browser} on ${os}`;
}

function maskIp(ipAddress: string | null) {
  if (!ipAddress) return "Unknown";
  const parts = ipAddress.split(".");
  if (parts.length === 4) return `${parts.slice(0, 3).join(".")}.xxx`;
  return ipAddress;
}

function mapSession(session: BackendSession): SessionRow {
  return {
    id: session.id,
    device: summariseUserAgent(session.userAgent),
    location: "Unknown location",
    ip: maskIp(session.ipAddress),
    lastActive: session.current ? "Now" : formatDateTime(session.usedAt ?? session.createdAt),
    current: session.current,
  };
}

function titleCaseAction(action: string) {
  return action
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapSecurityEvent(event: BackendSecurityEvent): SecurityEventRow {
  const failed = event.action.toLowerCase().includes("failed");

  return {
    id: event.id,
    action: titleCaseAction(event.action),
    device: summariseUserAgent(event.userAgent),
    location: "Unknown location",
    time: formatDateTime(event.createdAt),
    status: failed ? "failed" : "success",
  };
}

function PasswordInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm text-[#6B7280] mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input-base pr-10"
        />
        <button
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111]"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function SecurityPage() {
  const { session } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorVerified, setTwoFactorVerified] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loginHistory, setLoginHistory] = useState<SecurityEventRow[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadSecurity() {
      setIsLoading(true);
      try {
        const [settings, activeSessions, securityEvents] = await Promise.all([
          api.settings.getSecurity(session!.token),
          api.auth.getSessions(
            session!.token,
            getStoredAuthSession()?.refreshToken,
          ),
          api.auth.getSecurityEvents(session!.token),
        ]);

        if (cancelled) return;

        setTwoFactorEnabled(settings.twoFactorEnabled);
        setTwoFactorVerified(settings.twoFactorVerified);
        setSessions(activeSessions.map(mapSession));
        setLoginHistory(securityEvents.map(mapSecurityEvent));
        setStatusMessage(null);
      } catch (error) {
        console.error("Failed to load security settings", error);
        if (!cancelled) {
          setSessions([]);
          setLoginHistory([]);
          setStatusMessage(
            error instanceof Error
              ? `Live security data could not load: ${error.message}`
              : "Live security data could not load.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSecurity();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const securityScore = useMemo(() => {
    if (twoFactorEnabled && twoFactorVerified) return "Strong";
    if (twoFactorEnabled) return "Good";
    return "Needs 2FA";
  }, [twoFactorEnabled, twoFactorVerified]);

  const handleTwoFactorToggle = async (enabled: boolean) => {
    if (!session?.token) return;

    const previous = twoFactorEnabled;
    setTwoFactorEnabled(enabled);

    try {
      await api.settings.toggle2fa(session.token, enabled);
      setTwoFactorVerified(enabled ? twoFactorVerified : false);
      setStatusMessage(enabled ? "Two-factor authentication enabled." : "Two-factor authentication disabled.");
    } catch (error) {
      console.error("Failed to update 2FA", error);
      setTwoFactorEnabled(previous);
      setStatusMessage("Could not update two-factor authentication.");
    }
  };

  const handlePasswordChange = async () => {
    if (!session?.token) return;

    if (!currentPassword || !newPassword || newPassword !== confirmPassword) {
      setStatusMessage("Enter matching password details before saving.");
      return;
    }

    try {
      setIsSaving(true);
      await api.security.changePassword(session.token, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatusMessage("Password updated.");
    } catch (error) {
      console.error("Failed to change password", error);
      setStatusMessage("Could not update password.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!session?.token) return;

    try {
      await api.auth.revokeSession(
        session.token,
        sessionId,
        getStoredAuthSession()?.refreshToken,
      );
      setSessions((items) => items.filter((item) => item.id !== sessionId));
      setStatusMessage("Session signed out.");
    } catch (error) {
      console.error("Failed to revoke session", error);
      setStatusMessage("Could not sign out that session.");
    }
  };

  const handleLogoutAll = async () => {
    if (!session?.token) return;

    try {
      await api.auth.logoutAll(
        session.token,
        getStoredAuthSession()?.refreshToken,
      );
      setSessions((items) => items.filter((item) => item.current));
      setStatusMessage("Other sessions signed out.");
    } catch (error) {
      console.error("Failed to sign out sessions", error);
      setStatusMessage("Could not sign out other sessions.");
    }
  };

  const handleGenerateRecoveryCodes = async () => {
    if (!session?.token) return;

    try {
      setIsGeneratingCodes(true);
      const setup = await api.security.setup2fa(session.token);
      setStatusMessage(
        `Generated a new authenticator setup with ${setup.secret ? "a recovery secret" : "updated recovery details"}.`,
      );
    } catch (error) {
      console.error("Failed to generate 2FA setup", error);
      setStatusMessage("Could not generate recovery details.");
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Settings"
        subtitle="Manage your account security and access controls."
      />

      {statusMessage && (
        <AlertBanner
          icon={AlertTriangle}
          title="Security data notice"
          description={statusMessage}
          variant="warning"
        />
      )}

      <AlertBanner
        icon={Clock}
        title="Live security records"
        description="Sessions and security events are loaded from the backend. Last password-change metadata is not exposed yet, so that metric is shown as not integrated."
        variant="info"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Security Score"
              value={securityScore}
              icon={Shield}
              color="green"
            />
            <StatCard
              label="2FA Status"
              value={twoFactorEnabled ? "Enabled" : "Disabled"}
              icon={Key}
              color="indigo"
            />
            <StatCard
              label="Active Sessions"
              value={String(sessions.length)}
              icon={Monitor}
              color="blue"
            />
            <StatCard
              label="Last Password Change"
              value="Not integrated"
              icon={Clock}
              color="amber"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#111111]">
            <Lock className="w-5 h-5 text-violet-500" /> Change Password
          </h2>
          <div className="space-y-4">
            <PasswordInput
              label="Current Password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <div>
              <PasswordInput
                label="New Password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={setNewPassword}
              />
              <p className="text-xs text-[#6B7280] mt-1">
                Min 8 characters, include uppercase, number, and symbol
              </p>
            </div>
            <PasswordInput
              label="Confirm New Password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
            <button
              onClick={handlePasswordChange}
              disabled={isSaving}
              className="w-full btn-primary justify-center disabled:opacity-60"
            >
              {isSaving ? "Updating..." : "Update Password"}
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#111111]">
            <Smartphone className="w-5 h-5 text-blue-500" /> Two-Factor
            Authentication
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[rgba(0,0,0,0.02)] rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className={`icon-container ${twoFactorEnabled ? "bg-green-50" : "bg-[rgba(0,0,0,0.03)]"}`}
                >
                  <Shield
                    className={`w-5 h-5 ${twoFactorEnabled ? "text-green-500" : "text-[#6B7280]"}`}
                  />
                </div>
                <div>
                  <p className="font-medium text-[#111111]">
                    Authenticator App
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {twoFactorEnabled
                      ? twoFactorVerified
                        ? "Enabled and verified"
                        : "Enabled, verification pending"
                      : "Not configured"}
                  </p>
                </div>
              </div>
              <Toggle
                enabled={twoFactorEnabled}
                onChange={handleTwoFactorToggle}
              />
            </div>
            <div className="p-4 bg-[rgba(0,0,0,0.02)] rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Key className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="font-medium text-[#111111]">Recovery Codes</p>
                  <p className="text-xs text-[#6B7280]">
                    Backup codes for account recovery
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setStatusMessage(
                      "Recovery codes are generated during 2FA setup and are not stored for later viewing.",
                    )
                  }
                  className="flex-1 py-2 text-sm bg-[rgba(0,0,0,0.03)] rounded-lg hover:bg-[rgba(0,0,0,0.05)] transition-colors text-[#111111]"
                >
                  View Codes
                </button>
                <button
                  onClick={handleGenerateRecoveryCodes}
                  disabled={isGeneratingCodes}
                  className="flex-1 py-2 text-sm bg-[rgba(0,0,0,0.03)] rounded-lg hover:bg-[rgba(0,0,0,0.05)] flex items-center justify-center gap-1 transition-colors text-[#111111] disabled:opacity-60"
                >
                  <RefreshCw className="w-3.5 h-3.5" />{" "}
                  {isGeneratingCodes ? "Generating..." : "Regenerate"}
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2 text-[#111111]">
            <Monitor className="w-5 h-5 text-[#6E6AE8]" /> Active Sessions
          </h2>
          <button
            onClick={handleLogoutAll}
            disabled={isLoading || sessions.length <= 1}
            className="text-sm text-red-500 hover:text-red-600"
          >
            Sign out all other sessions
          </button>
        </div>
        <div className="space-y-3">
          {isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <div
                key={`session-loading-${index}`}
                className="h-20 rounded-lg bg-[rgba(0,0,0,0.03)] skeleton-shimmer"
              />
            ))}
          {!isLoading && sessions.length === 0 && (
            <div className="p-4 bg-[rgba(0,0,0,0.02)] rounded-lg text-sm text-[#6B7280]">
              No live sessions were returned by the backend.
            </div>
          )}
          {!isLoading && sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 bg-[rgba(0,0,0,0.02)] rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="icon-container bg-[rgba(0,0,0,0.03)]">
                  <Monitor className="w-5 h-5 text-[#6B7280]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[#111111]">
                      {session.device}
                    </p>
                    {session.current && (
                      <span className="text-xs bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] px-2 py-0.5 rounded">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {session.location}
                    </span>
                    <span>IP: {session.ip}</span>
                    <span>Active: {session.lastActive}</span>
                  </div>
                </div>
              </div>
              {!session.current && (
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  className="p-2 hover:bg-[rgba(0,0,0,0.03)] rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <DataTable
        headers={[
          { label: "Action" },
          { label: "Device" },
          { label: "Location" },
          { label: "Time" },
          { label: "Status" },
        ]}
      >
        {isLoading &&
          Array.from({ length: 5 }, (_, index) => (
            <TableRowSkeleton key={`security-event-loading-${index}`} columns={5} />
          ))}
        {!isLoading && loginHistory.length === 0 && (
          <tr>
            <td colSpan={5} className="px-6 py-10 text-center text-sm text-[#5e8a8d]">
              No live security events were returned by the backend.
            </td>
          </tr>
        )}
        {!isLoading && loginHistory.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="font-medium text-sm text-[#111111]">
              {entry.action}
            </TableCell>
            <TableCell className="text-[#6B7280] text-sm">
              {entry.device}
            </TableCell>
            <TableCell className="text-[#6B7280] text-sm">
              {entry.location}
            </TableCell>
            <TableCell className="text-[#6B7280] text-sm">
              {entry.time}
            </TableCell>
            <TableCell>
              <span
                className={`text-xs px-2 py-1 rounded flex items-center gap-1 w-fit ${entry.status === "success" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}
              >
                {entry.status === "success" ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {entry.status === "success" ? "Success" : "Failed"}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>
    </div>
  );
}
