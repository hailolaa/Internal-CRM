"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  CheckSquare,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { ContactRecord, TaskRecord } from "@/lib/api-types";

const priorities: Array<{
  id: TaskRecord["priority"];
  name: string;
  color: string;
}> = [
  { id: "high", name: "High", color: "bg-red-500" },
  { id: "medium", name: "Medium", color: "bg-amber-500" },
  { id: "low", name: "Low", color: "bg-[#6B7280]" },
];

const categories = [
  "Follow-up",
  "Call",
  "Email",
  "Documentation",
  "Preparation",
  "Admin",
  "Marketing",
];

export default function NewTaskPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [priority, setPriority] = useState<TaskRecord["priority"]>("medium");
  const [category, setCategory] = useState("Follow-up");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    dueTime: "",
    assignedTo: "Me",
    reminder: "None",
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadContacts() {
      try {
        const result = await api.contacts.list(session!.token, { pageSize: 3 });
        if (!cancelled) setContacts(result.contacts);
      } catch (error) {
        console.error("Failed to load contacts for task form", error);
      }
    }

    loadContacts();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleSave = async () => {
    if (!session?.token || !form.title.trim()) {
      setStatusMessage("Add a task title before saving.");
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const selectedContactName =
      contacts.find((contact) => contact.id === selectedContact)?.name ?? null;
    const due = [form.dueDate, form.dueTime].filter(Boolean).join(" ");

    try {
      await api.tasks.create(session.token, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority,
        category,
        contact: selectedContactName,
        due: due || null,
        dueDate: form.dueDate || null,
        assignedTo: form.assignedTo,
      });
      router.push("/app/crm/tasks");
    } catch (error) {
      console.error("Failed to create task", error);
      setStatusMessage("Could not save task.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/crm/tasks"
          className="p-2 rounded-[14px] hover:bg-[rgba(110,106,232,0.08)]"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#111111]">Create Task</h1>
          <p className="text-[#6B7280] text-sm">Add a new task to your list</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-[14px] flex items-center gap-2 transition-colors"
          style={{ boxShadow: "0 2px 8px rgba(110,106,232,0.25)" }}
        >
          <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save Task"}
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">Task Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Follow up with Sarah Johnson"
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Add more details about this task..."
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-3 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] resize-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1.5">
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={form.dueTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dueTime: event.target.value,
                      }))
                    }
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">
              Link to Contact
            </h2>
            <div className="relative mb-4">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                type="text"
                placeholder="Search contacts..."
                className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] pl-10 pr-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
              />
            </div>
            <div className="space-y-2">
              {(contacts.length
                ? contacts
                : ["Sarah Johnson", "Emma Wilson", "Sophie Brown"].map(
                    (name) => ({ id: name, name }) as ContactRecord,
                  )
              ).map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact.id)}
                  className={`w-full p-3 bg-[#FAF8F5] border rounded-[14px] flex items-center gap-3 hover:border-[rgba(110,106,232,0.3)] transition-all text-left ${
                    selectedContact === contact.id
                      ? "border-[rgba(110,106,232,0.45)]"
                      : "border-[rgba(0,0,0,0.06)]"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[rgba(110,106,232,0.12)] flex items-center justify-center text-xs font-medium text-[#6E6AE8]">
                    {contact.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <span className="text-sm text-[#111111]">
                    {contact.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">Priority</h2>
            <div className="space-y-2">
              {priorities.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPriority(p.id)}
                  className={`w-full p-3 rounded-[14px] flex items-center gap-3 transition-all ${priority === p.id ? "bg-[rgba(110,106,232,0.06)] border border-[rgba(110,106,232,0.2)]" : "bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]"}`}
                >
                  <div className={`w-3 h-3 rounded-full ${p.color}`} />
                  <span className="text-sm text-[#111111]">{p.name}</span>
                  {priority === p.id && (
                    <CheckSquare className="w-4 h-4 text-[#6E6AE8] ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">Category</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 bg-[#FAF8F5] border rounded-full text-sm text-[#111111] hover:border-[rgba(110,106,232,0.3)] transition-all ${
                    category === cat
                      ? "border-[rgba(110,106,232,0.45)]"
                      : "border-[rgba(0,0,0,0.06)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">Assign To</h2>
            <select
              value={form.assignedTo}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  assignedTo: event.target.value,
                }))
              }
              className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
            >
              <option>Me</option>
              <option>Dr. Sarah Smith</option>
              <option>Emma Johnson</option>
              <option>Sophie Brown</option>
            </select>
          </div>

          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">Reminder</h2>
            <div className="space-y-2">
              {["None", "15 mins before", "1 hour before", "1 day before"].map(
                (reminder) => (
                  <label
                    key={reminder}
                    className="flex items-center gap-3 p-2 rounded-[14px] hover:bg-[rgba(110,106,232,0.04)] cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="reminder"
                      checked={form.reminder === reminder}
                      onChange={() =>
                        setForm((current) => ({ ...current, reminder }))
                      }
                      className="w-4 h-4"
                      style={{ accentColor: "#6E6AE8" }}
                    />
                    <span className="text-sm text-[#111111]">{reminder}</span>
                  </label>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
