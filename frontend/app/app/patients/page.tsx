"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, FileText, UserCircle, Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui";
import { DataTable, TableCell, TableRow } from "@/components/ui/tables";
import { SearchInput } from "@/components/ui/forms";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { ContactRecord } from "@/lib/api-types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function PatientsPage() {
  const { session } = useAuth();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadPatients() {
      try {
        const result = await api.contacts.list(session!.token, {
          page: 1,
          pageSize: 100,
          sortBy: "updatedAt",
          sortDir: "desc",
        });
        if (!cancelled) {
          setContacts(result.contacts);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load patients", error);
        if (!cancelled) {
          setStatusMessage("Patient contacts could not be loaded.");
        }
      }
    }

    loadPatients();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const patientContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        ["patient", "booked", "completed", "active"].some((status) =>
          contact.status.toLowerCase().includes(status),
        ),
      ),
    [contacts],
  );

  const filteredPatients = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return patientContacts;

    return patientContacts.filter((contact) =>
      [
        contact.name,
        contact.email,
        contact.phone,
        contact.status,
        ...contact.treatmentInterests,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search)),
    );
  }, [patientContacts, query]);

  const totalValue = patientContacts.reduce(
    (total, contact) => total + contact.value,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Management"
        subtitle="Contact-backed patient records and treatment interest overview."
        icon={UserCircle}
        iconColor="text-[#A07840]"
      />

      {statusMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Patients"
          value={`${patientContacts.length}`}
          change={`${contacts.length} contacts`}
          trend="up"
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Tracked Value"
          value={formatCurrency(totalValue)}
          change="CRM value"
          trend="up"
          icon={CreditCard}
          color="green"
        />
        <StatCard
          label="Treatment Interests"
          value={`${new Set(patientContacts.flatMap((c) => c.treatmentInterests)).size}`}
          change="Unique"
          trend="up"
          icon={FileText}
          color="teal"
        />
        <StatCard
          label="Recently Contacted"
          value={`${patientContacts.filter((c) => c.lastContactAt).length}`}
          change="With activity"
          trend="up"
          icon={UserCircle}
          color="violet"
        />
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search patients..."
      />

      <DataTable
        headers={[
          { label: "Patient" },
          { label: "Status" },
          { label: "Treatment Interests" },
          { label: "Value" },
          { label: "Last Contact" },
        ]}
      >
        {filteredPatients.map((patient) => (
          <TableRow key={patient.id}>
            <TableCell>
              <div>
                <p className="font-medium text-[#111111]">{patient.name}</p>
                <p className="text-xs text-[#6B7280]">
                  {patient.email || patient.phone || "No contact details"}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <span className="rounded-full border border-[rgba(110,106,232,0.18)] bg-[rgba(110,106,232,0.08)] px-2 py-1 text-xs text-[#6E6AE8]">
                {patient.status}
              </span>
            </TableCell>
            <TableCell className="text-sm text-[#6B7280]">
              {patient.treatmentInterests.length
                ? patient.treatmentInterests.join(", ")
                : "-"}
            </TableCell>
            <TableCell className="font-medium text-[#5A8A6A]">
              {formatCurrency(patient.value)}
            </TableCell>
            <TableCell className="text-sm text-[#6B7280]">
              {formatDate(patient.lastContactAt)}
            </TableCell>
          </TableRow>
        ))}
      </DataTable>
    </div>
  );
}
