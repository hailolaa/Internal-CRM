export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
  category: string | null;
  contact: string | null;
  due: string | null;
  dueDate: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SopRecord {
  id: string;
  title: string;
  category: string;
  content: string | null;
  owner: string | null;
  status: "draft" | "published" | "archived";
  updatedAt: string;
}
