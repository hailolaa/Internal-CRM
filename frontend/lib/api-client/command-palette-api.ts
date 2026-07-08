import type {
  CommandPaletteQueryParams,
  CommandPaletteResponse,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

function buildCommandPaletteQuery(params: CommandPaletteQueryParams = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function createCommandPaletteApi(apiRequest: ApiRequest) {
  return {
    commandPalette: {
      async search(token: string, params?: CommandPaletteQueryParams) {
        const response = await apiRequest<CommandPaletteResponse>(
          `/api/command-palette${buildCommandPaletteQuery(params)}`,
          { token },
        );
        return response.data!;
      },
    },
  };
}
