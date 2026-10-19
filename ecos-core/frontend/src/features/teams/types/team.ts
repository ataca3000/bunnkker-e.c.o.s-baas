export interface TeamCompany {
  id: string;
  code: string;
  name: string;
}

export interface Team {
  id: string;
  company_id: string;
  company?: TeamCompany;
  code: string;
  name: string;
  leader_name: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamPayload {
  company_id: string;
  name: string;
  code?: string;
  leader_name?: string | null;
  description?: string | null;
  is_active?: boolean;
}

export interface TeamsQuery {
  page?: number;
  per_page?: number;
  search?: string;
  company_id?: string;
  status?: string;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface TeamsResult {
  items: Team[];
  meta: PaginationMeta;
}
