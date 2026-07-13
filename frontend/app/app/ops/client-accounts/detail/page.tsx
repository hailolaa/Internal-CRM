"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckSquare2,
  ExternalLink,
  FileCheck2,
  Mail,
  MapPin,
  NotebookText,
  Pencil,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AlertBanner, Badge, Card, SkeletonLine, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ClientAccountServiceRecord, ClientAccountSummaryRecord, ContactRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function formatLabel(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function personName(account: ClientAccountSummaryRecord) {
  const manager = account.accountManager;
  if (!manager) return "Unassigned";
  return [manager.firstName, manager.lastName].filter(Boolean).join(" ") || manager.email || "Unassigned";
}

function location(account: ClientAccountSummaryRecord) {
  return [account.address, account.city, account.state, account.postalCode, account.country].filter(Boolean).join(", ") || "No location recorded";
}

export default function ClientAccountDetailPage() {
  const searchParams = useSearchParams();
  const clinicId = searchParams.get("id") || "";
  const { session } = useAuth();
  const token = session?.token;
  const missingAccountId = !clinicId;
  const [account, setAccount] = useState<ClientAccountSummaryRecord | null>(null);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [isLoading, setIsLoading] = useState(!missingAccountId);
  const [loadError, setLoadError] = useState(missingAccountId ? "No client account id was provided." : "");

  useEffect(() => {
    if (!token || !clinicId) return;

    Promise.all([
      api.clientAccounts.list(token),
      api.clientAccounts.listServices(token, { includeArchived: false, includeAllClinics: true }),
    ])
      .then(async ([accounts, allServices]) => {
        const selected = accounts.find((item) => item.clinicId === clinicId) || null;
        if (!selected) throw new Error("Client account not found or unavailable to this user.");
        setAccount(selected);
        setServices(allServices.filter((service) => service.clinicId === clinicId));
        const contactResult = await api.contacts.list(token, { search: selected.clinicName, pageSize: 100 });
        setContacts(contactResult.contacts.filter((contact) => contact.accountName?.toLowerCase() === selected.clinicName.toLowerCase()));
        setLoadError("");
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Unable to load this client account."))
      .finally(() => setIsLoading(false));
  }, [clinicId, token]);

  const activeServices = useMemo(() => services.filter((service) => service.status === "active"), [services]);

  if (isLoading) {
    return <div className="space-y-6"><SkeletonLine className="h-10 w-72" /><SkeletonLine className="h-56 w-full" /></div>;
  }

  if (loadError || !account) {
    return (
      <div className="space-y-6">
        <Link href="/app/ops/client-accounts" className="btn-secondary inline-flex text-sm"><ArrowLeft className="h-4 w-4" />Back to accounts</Link>
        <AlertBanner title="Client account could not be loaded" description={loadError || "The account is unavailable."} variant="warning" />
      </div>
    );
  }

  const canEditProfile = session?.clinicId === account.clinicId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/app/ops/client-accounts" className="btn-secondary p-2"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e4efed] text-[#315f62]"><BriefcaseBusiness className="h-6 w-6" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold text-[#151f21]">{account.clinicName}</h1><StatusBadge status={formatLabel(account.clientStatus)} /></div>
            <p className="mt-1 text-sm text-[#7A746A]">Master client record · {formatLabel(account.healthStatus)} · {formatLabel(account.churnRisk)} risk</p>
          </div>
        </div>
        {canEditProfile ? (
          <Link href="/app/ops/client-accounts/package" className="inline-flex items-center gap-2 rounded-full bg-[#5e8a8d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#507b7e]"><Pencil className="h-4 w-4" />Edit account</Link>
        ) : (
          <span className="rounded-full border border-[#d8ddda] px-4 py-2 text-sm font-medium text-[#7A746A]">Switch to this workspace to edit</span>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card padding="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#151f21]">Account profile</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [ExternalLink, "Website", account.website || "Not provided"],
                [MapPin, "Location", location(account)],
                [BriefcaseBusiness, "Account type", formatLabel(account.clientStatus)],
                [ShieldCheck, "Package", account.currentPackage || "Not set"],
                [Users, "Owner", personName(account)],
                [Mail, "Email", account.email || "Not provided"],
                [Phone, "Phone", account.phone || "Not provided"],
              ].map(([Icon, label, value]) => {
                const DetailIcon = Icon as typeof BriefcaseBusiness;
                return <div key={String(label)} className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4"><p className="flex items-center gap-2 text-xs font-medium text-[#6F6A66]"><DetailIcon className="h-4 w-4" />{String(label)}</p><p className="mt-2 text-sm font-semibold text-[#151f21]">{String(value)}</p></div>;
              })}
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-[#151f21]">Contacts</h2><p className="mt-1 text-sm text-[#7A746A]">Stakeholders matched to this account.</p></div><Badge variant="info">{contacts.length}</Badge></div>
            <div className="mt-5 space-y-3">
              {contacts.map((contact) => <Link key={contact.id} href={`/app/crm/contacts/detail?id=${contact.id}`} className="flex items-center justify-between rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4 transition hover:border-[#a9c7c4]"><div><p className="font-semibold text-[#151f21]">{contact.name}</p><p className="text-sm text-[#7A746A]">{contact.role || "Role not set"} · {contact.email || contact.phone || "No contact method"}</p></div><ExternalLink className="h-4 w-4 text-[#315f62]" /></Link>)}
              {contacts.length === 0 && <p className="rounded-xl border border-dashed border-[#E7E1DA] p-6 text-center text-sm text-[#7A746A]">No contacts are linked by account name yet.</p>}
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-[#151f21]">Services</h2><p className="mt-1 text-sm text-[#7A746A]">Current package delivery and ownership.</p></div><Link href="/app/ops/services" className="text-sm font-semibold text-[#315f62]">View services</Link></div>
            <div className="mt-5 flex flex-wrap gap-2">{activeServices.map((service) => <Badge key={service.id} variant="success">{service.name}</Badge>)}{activeServices.length === 0 && <Badge variant="warning">No active services</Badge>}</div>
          </Card>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <Card padding="p-5">
            <h2 className="font-semibold text-[#151f21]">Record links</h2>
            <div className="mt-4 space-y-2">
              {[
                [Users, "Contacts and leads", `/app/leads?account=${encodeURIComponent(account.clinicName)}`],
                [BriefcaseBusiness, "Deals", `/app/crm/pipeline?account=${encodeURIComponent(account.clinicName)}`],
                [NotebookText, "Notes", "#account-notes"],
                [CheckSquare2, "Tasks", `/app/crm/tasks?clientAccountProfileId=${account.id || ""}`],
                [ShieldCheck, "Audits", `/app/admin?clinicId=${account.clinicId}`],
                [FileCheck2, "Proposals", `/app/crm/pipeline?account=${encodeURIComponent(account.clinicName)}&view=proposals`],
              ].map(([Icon, label, href]) => {
                const RecordIcon = Icon as typeof Users;
                return <Link key={String(label)} href={String(href)} className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-4 py-3 text-sm font-semibold text-[#315f62] hover:bg-[#edf5f3]"><span className="flex items-center gap-2"><RecordIcon className="h-4 w-4" />{String(label)}</span><ExternalLink className="h-4 w-4" /></Link>;
              })}
            </div>
          </Card>
          <div id="account-notes"><Card padding="p-5"><h2 className="font-semibold text-[#151f21]">Account notes</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#7A746A]">{account.keyNotes || "No account notes recorded."}</p></Card></div>
        </aside>
      </div>
    </div>
  );
}
