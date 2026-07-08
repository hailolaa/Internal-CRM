"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Plus,
  MapPin,
  Phone,
  Clock,
  Edit,
  Trash2,
  Users,
  Calendar,
  Star,
} from "lucide-react";
import { AlertBanner, Card, PageHeader, StatCard, StatCardSkeleton } from "@/components/ui";
import { SearchInput } from "@/components/ui/forms";
import { api } from "@/lib/api-client";
import type { Location } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function formatWorkingHours(location: Location) {
  if (!location.workingHours) return "Hours not set";
  const openDays = Object.entries(location.workingHours).filter(
    ([, hours]) => !hours.closed,
  );
  if (openDays.length === 0) return "Closed";
  const [firstDay, firstHours] = openDays[0];
  return `${firstDay}: ${firstHours.open}-${firstHours.close}`;
}

export default function LocationsPage() {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadLocations() {
      setIsLoading(true);
      try {
        const rows = await api.locations.list(session!.token);
        if (!cancelled) {
          setLocations(rows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load locations", error);
        if (!cancelled) {
          setLocations([]);
          setStatusMessage(
            error instanceof Error
              ? `Live locations could not load: ${error.message}`
              : "Live locations could not load.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadLocations();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const filteredLocations = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    if (!search) return locations;
    return locations.filter((location) =>
      [location.name, location.address, location.phone, location.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search)),
    );
  }, [locations, searchQuery]);

  const handleAddLocation = async () => {
    if (!session?.token) return;
    const name = window.prompt("Location name");
    if (!name) return;
    const address = window.prompt("Address", "");
    if (!address) return;

    try {
      const created = await api.locations.create(session.token, {
        name,
        address,
        status: "active",
      });
      setLocations((items) => [
        {
          id: created.id,
          clinicId: session.clinicId,
          name,
          address,
          city: null,
          state: null,
          postalCode: null,
          country: null,
          phone: null,
          email: null,
          workingHours: null,
          roomCount: 0,
          isPrimary: false,
          status: "active",
          staffCount: 0,
          bookingCount: 0,
          rating: 0,
        },
        ...items,
      ]);
      setStatusMessage("Location created.");
    } catch (error) {
      console.error("Failed to create location", error);
      setStatusMessage("Could not create location.");
    }
  };

  const handleToggleLocation = async (location: Location) => {
    if (!session?.token) return;
    const status = location.status === "active" ? "inactive" : "active";

    try {
      await api.locations.update(session.token, location.id, { status });
      setLocations((items) =>
        items.map((item) =>
          item.id === location.id ? { ...item, status } : item,
        ),
      );
    } catch (error) {
      console.error("Failed to update location", error);
      setStatusMessage("Could not update location.");
    }
  };

  const handleDeleteLocation = async (location: Location) => {
    if (!session?.token) return;
    if (!window.confirm(`Delete ${location.name}?`)) return;

    try {
      await api.locations.remove(session.token, location.id);
      setLocations((items) => items.filter((item) => item.id !== location.id));
      setStatusMessage("Location deleted.");
    } catch (error) {
      console.error("Failed to delete location", error);
      setStatusMessage("Could not delete location.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        subtitle="Manage your clinic locations and branches."
        right={
          <button
            onClick={handleAddLocation}
            disabled={isLoading || !session?.token}
            className="btn-primary w-fit disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> Add Location
          </button>
        }
      />

      {statusMessage && (
        <AlertBanner
          icon={AlertTriangle}
          title="Locations data notice"
          description={statusMessage}
          variant="warning"
        />
      )}

      <AlertBanner
        icon={MapPin}
        title="Live location records"
        description="Locations are loaded from the backend. Booking counts and ratings are backend placeholders until those modules expose location-level metrics."
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
            <StatCard label="Total Locations" value={String(locations.length)} />
            <StatCard
              label="Active"
              value={String(locations.filter((l) => l.status === "active").length)}
              color="green"
            />
            <StatCard
              label="Total Staff"
              value={String(locations.reduce((acc, l) => acc + l.staffCount, 0))}
              color="indigo"
            />
            <StatCard
              label="Treatment Rooms"
              value={String(locations.reduce((acc, l) => acc + l.roomCount, 0))}
              color="violet"
            />
          </>
        )}
      </div>

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search locations..."
        className="max-w-md"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading &&
          Array.from({ length: 3 }, (_, index) => (
            <Card key={`location-loading-${index}`}>
              <div className="h-56 rounded-lg bg-[rgba(0,0,0,0.03)] skeleton-shimmer" />
            </Card>
          ))}
        {!isLoading && filteredLocations.length === 0 && (
          <Card>
            <div className="py-8 text-center">
              <MapPin className="mx-auto mb-3 h-8 w-8 text-[#5e8a8d]" />
              <h3 className="font-semibold text-[#151f21]">
                {searchQuery.trim() ? "No locations match that search" : "No locations created yet"}
              </h3>
              <p className="mt-2 text-sm text-[#5e8a8d]">
                Add a live clinic location to start tracking branches.
              </p>
            </div>
          </Card>
        )}
        {!isLoading && filteredLocations.map((location) => (
          <Card key={location.id} hover>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`icon-container-lg ${location.status === "active" ? "bg-[rgba(110,106,232,0.08)]" : "bg-[rgba(0,0,0,0.03)]"}`}
                >
                  <MapPin
                    className={`w-6 h-6 ${location.status === "active" ? "text-[#6E6AE8]" : "text-[#6B7280]"}`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[#111111]">
                      {location.name}
                    </h3>
                    {location.isPrimary && (
                      <span className="text-xs bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] px-2 py-0.5 rounded">
                        Primary
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${location.status === "active" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}
                  >
                    {location.status === "active" ? "Active" : "Coming Soon"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm mb-4">
              <p className="text-[#6B7280]">{location.address}</p>
              <div className="flex items-center gap-2 text-[#6B7280]">
                <Phone className="w-3.5 h-3.5" />
                <span>{location.phone ?? "No phone set"}</span>
              </div>
              <div className="flex items-center gap-2 text-[#6B7280]">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatWorkingHours(location)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 py-3 border-t border-[rgba(0,0,0,0.04)]">
              {[
                { icon: Users, value: location.staffCount, label: "Staff" },
                {
                  icon: Calendar,
                  value: location.bookingCount,
                  label: "Bookings",
                },
                { icon: Star, value: location.rating || "-", label: "Rating" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <stat.icon className="w-3.5 h-3.5 text-[#6B7280] mx-auto mb-1" />
                  <p className="font-semibold text-[#111111]">{stat.value}</p>
                  <p className="text-xs text-[#6B7280]">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-3 border-t border-[rgba(0,0,0,0.04)]">
              <button
                onClick={() => handleToggleLocation(location)}
                aria-label={`Edit ${location.name}`}
                className="flex-1 py-2 text-sm bg-[rgba(0,0,0,0.03)] rounded-lg hover:bg-[rgba(0,0,0,0.05)] flex items-center justify-center gap-1 transition-colors text-[#111111]"
              >
                <Edit className="w-3.5 h-3.5" />{" "}
                {location.status === "active" ? "Disable" : "Activate"}
              </button>
              <button
                onClick={() => handleDeleteLocation(location)}
                aria-label={`Delete ${location.name}`}
                className="py-2 px-3 text-sm bg-[rgba(0,0,0,0.03)] rounded-lg hover:bg-[rgba(0,0,0,0.05)] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
