export interface SopResponse {
  id: string;
  clinicId: string;
  title: string;
  category: string;
  content: string | null;
  owner: string | null;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface CreateSopDTO {
  title: string;
  category?: string;
  content?: string | null;
  owner?: string | null;
  status?: "draft" | "published" | "archived";
}

export interface UpdateSopDTO {
  title?: string;
  category?: string;
  content?: string | null;
  owner?: string | null;
  status?: "draft" | "published" | "archived";
}

export interface SopListQuery {
  category?: string;
  status?: "draft" | "published" | "archived";
  search?: string;
}
