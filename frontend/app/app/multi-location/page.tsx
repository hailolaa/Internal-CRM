"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Building2, Globe, Users } from "lucide-react";
import { PageHeader, StatCard } from "@/components/ui";
import { DataTable, TableCell, TableRow } from "@/components/ui/tables";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { Location } from "@/lib/api-types";

export default function MultiLocationPage() {
  const { session } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadLocations() {
      try {
        const rows = await api.locations.list(session!.token);
        if (!cancelled) {
          setLocations(rows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load locations", error);
        if (!cancelled) {
          setStatusMessage("Location data could not be loaded.");
        }
      }
    }

    loadLocations();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const summary = useMemo(
    () => ({
      active: locations.filter((location) => location.status === "active").length,
      staff: locations.reduce((total, location) => total + location.staffCount, 0),
      bookings: locations.reduce(
        (total, location) => total + location.bookingCount,
        0,
      ),
      rooms: locations.reduce((total, location) => total + location.roomCount, 0),
    }),
    [locations],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Multi-Location"
        subtitle="Manage and compare clinic locations."
        icon={Building2}
        iconColor="text-[#6E6AE8]"
      />

      {statusMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Active Locations"
          value={`${summary.active}`}
          change={`${locations.length} total`}
          trend="up"
          icon={Globe}
          color="violet"
        />
        <StatCard
          label="Staff"
          value={`${summary.staff}`}
          change="Across sites"
          trend="up"
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Bookings"
          value={`${summary.bookings}`}
          change="Location total"
          trend="up"
          icon={BarChart3}
          color="green"
        />
        <StatCard
          label="Rooms"
          value={`${summary.rooms}`}
          change="Capacity"
          trend="up"
          icon={Building2}
          color="teal"
        />
      </div>

      <DataTable
        headers={[
          { label: "Location" },
          { label: "Status" },
          { label: "Staff" },
          { label: "Rooms" },
          { label: "Bookings" },
          { label: "Rating" },
        ]}
      >
        {locations.map((location) => (
          <TableRow key={location.id}>
            <TableCell>
              <div>
                <p className="font-medium text-[#111111]">{location.name}</p>
                <p className="text-xs text-[#6B7280]">
                  {[location.address, location.city, location.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <span className="rounded-full border border-[rgba(110,106,232,0.18)] bg-[rgba(110,106,232,0.08)] px-2 py-1 text-xs text-[#6E6AE8]">
                {location.status}
              </span>
            </TableCell>
            <TableCell>{location.staffCount}</TableCell>
            <TableCell>{location.roomCount}</TableCell>
            <TableCell>{location.bookingCount}</TableCell>
            <TableCell>{location.rating ? location.rating.toFixed(1) : "-"}</TableCell>
          </TableRow>
        ))}
      </DataTable>

      {!locations.length && (
        <div
          className="rounded-[24px] p-8 text-center"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <Building2 className="w-10 h-10 mx-auto mb-3 text-[#6E6AE8]" />
          <h2 className="font-semibold text-[#111111]">No locations found</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Add locations in settings to compare clinic performance here.
          </p>
        </div>
      )}
    </div>
  );
}
