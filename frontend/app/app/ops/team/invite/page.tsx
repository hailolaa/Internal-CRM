"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, User, Shield, Send } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api-client";
import type { BackendTeamRole } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { getRoleLabel } from "@/lib/roles";

const roles = [
  {
    id: "admin",
    name: "Owner",
    description: "Full access to all features and settings",
  },
  {
    id: "manager",
    name: "Manager",
    description: "Manage prospects, clients, delivery work, and reports",
  },
  {
    id: "staff",
    name: "Coordinator",
    description: "View contacts, update tasks, and manage assigned work",
  },
  {
    id: "readonly",
    name: "Agency / Analyst",
    description: "View-only access to dashboard and reports",
  },
];

const roleMap: Record<string, BackendTeamRole> = {
  admin: "ADMIN",
  manager: "MANAGER",
  staff: "STAFF",
  readonly: "READ_ONLY",
};

export default function InviteTeamPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [selectedRole, setSelectedRole] = useState("staff");
  const [emails, setEmails] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSendInvites = async () => {
    if (!session?.token) return;

    const parsedEmails = emails
      .split(/[\n,]+/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (parsedEmails.length === 0) {
      setStatusMessage("Add at least one email address.");
      return;
    }

    try {
      setIsSending(true);
      await api.team.inviteMembers(session.token, {
        emails: parsedEmails,
        role: roleMap[selectedRole],
        personalMessage: personalMessage || undefined,
      });
      router.push("/app/ops/team");
    } catch (error) {
      console.error("Failed to invite team members", error);
      setStatusMessage("Could not send invitations.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/ops/team"
          className="p-2 rounded-lg hover:bg-[rgba(0,0,0,0.03)]"
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#111111]">
            Invite Team Member
          </h1>
          <p className="text-[#6B7280] text-sm">
            Add new members to the internal CRM
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#111111]">
              <Mail className="w-5 h-5 text-blue-500" /> Email Addresses
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Enter email addresses
                </label>
                <textarea
                  rows={4}
                  placeholder={
                    "Enter email addresses, one per line:\nsarah@clinicgrower.com\nemma@clinicgrower.com"
                  }
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  className="w-full bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-lg px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.3)] focus:ring-1 focus:ring-[rgba(110,106,232,0.15)] resize-none font-mono"
                />
                <p className="text-xs text-[#6B7280] mt-1">
                  Separate multiple emails with new lines
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2 text-[#111111]">
              <Shield className="w-5 h-5 text-violet-500" /> Select Role
            </h2>
            <div className="space-y-3">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`w-full p-4 rounded-lg text-left transition-all ${selectedRole === role.id ? "bg-[rgba(110,106,232,0.08)] border border-[rgba(110,106,232,0.3)]" : "bg-[rgba(0,0,0,0.02)] border border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.1)]"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[#111111]">{role.name}</p>
                      <p className="text-sm text-[#6B7280]">
                        {role.description}
                      </p>
                    </div>
                    {selectedRole === role.id && (
                      <div className="w-5 h-5 rounded-full bg-[#6E6AE8] flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 text-[#111111]">
              Personal Message (optional)
            </h2>
            <textarea
              rows={3}
              placeholder="Add a personal welcome message to include in the invitation email..."
              value={personalMessage}
              onChange={(event) => setPersonalMessage(event.target.value)}
              className="w-full bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-lg px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.3)] focus:ring-1 focus:ring-[rgba(110,106,232,0.15)] resize-none"
            />
          </div>

          <button
            onClick={handleSendInvites}
            disabled={isSending}
            className="w-full bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            <Send className="w-4 h-4" />{" "}
            {isSending ? "Sending..." : "Send Invitations"}
          </button>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 text-[#111111]">
              Invitation Preview
            </h2>
            <div className="bg-[rgba(0,0,0,0.02)] rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6E6AE8] to-[#8B87F0] flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm text-[#111111]">
                    New Team Member
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {getRoleLabel(roleMap[selectedRole])}{" "}
                    Role
                  </p>
                </div>
              </div>
              <div className="border-t border-[rgba(0,0,0,0.06)] pt-3">
                <p className="text-xs text-[#6B7280] mb-2">Email preview:</p>
                <div className="bg-[rgba(0,0,0,0.02)] rounded p-3 text-xs text-[#111111]">
                  <p className="font-medium mb-2">
                    You&apos;ve been invited to join Clinic Grower Internal CRM.
                  </p>
                  <p className="text-[#6B7280]">
                    Click the link below to create your account and get
                    started...
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-4 text-[#111111]">
              Role Permissions
            </h2>
            <div className="space-y-2 text-sm">
              {selectedRole === "admin" && (
                <>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> Full system access
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> Manage team members
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> Billing & subscriptions
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> All CRM features
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> Marketing & campaigns
                  </div>
                </>
              )}
              {selectedRole === "manager" && (
                <>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> All CRM features
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> View reports
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> Marketing & campaigns
                  </div>
                  <div className="flex items-center gap-2 text-[#6B7280]">
                    <span>✗</span> Manage team members
                  </div>
                  <div className="flex items-center gap-2 text-[#6B7280]">
                    <span>✗</span> Billing access
                  </div>
                </>
              )}
              {selectedRole === "staff" && (
                <>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> View contacts
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> Manage assigned tasks
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> Create tasks
                  </div>
                  <div className="flex items-center gap-2 text-[#6B7280]">
                    <span>✗</span> Delete contacts
                  </div>
                  <div className="flex items-center gap-2 text-[#6B7280]">
                    <span>✗</span> View reports
                  </div>
                </>
              )}
              {selectedRole === "readonly" && (
                <>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> View dashboard
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <span>✓</span> View reports
                  </div>
                  <div className="flex items-center gap-2 text-[#6B7280]">
                    <span>✗</span> Edit anything
                  </div>
                  <div className="flex items-center gap-2 text-[#6B7280]">
                    <span>✗</span> Create contacts
                  </div>
                  <div className="flex items-center gap-2 text-[#6B7280]">
                    <span>✗</span> Send messages
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-[rgba(110,106,232,0.05)] border border-[rgba(110,106,232,0.12)] rounded-[24px] p-6">
            <h2 className="font-semibold mb-2 text-[#111111]">Team Plan</h2>
            <p className="text-sm text-[#6B7280] mb-3">
              Your current plan includes:
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#111111]">Team seats</span>
              <span className="font-medium text-[#111111]">3 / 5 used</span>
            </div>
            <div className="h-2 bg-[rgba(0,0,0,0.04)] rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-[#6E6AE8] rounded-full"
                style={{ width: "60%" }}
              />
            </div>
            <Link
              href="/app/settings/billing"
              className="block w-full mt-4 text-center text-sm text-[#6E6AE8] hover:text-[#5A56D4]"
            >
              Upgrade for more seats →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
