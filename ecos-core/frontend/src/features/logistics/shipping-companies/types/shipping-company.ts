export type ShippingCompanyType = 'internal' | 'external';
export type ShippingCompanyStatus = 'active' | 'inactive' | 'archived';
export type ShippingContractStatus = 'active' | 'inactive';

export type ShippingContract = {
  id: number;
  shipping_company_id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  payment_terms: string | null;
  notes: string | null;
  status: ShippingContractStatus;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
};

export type ShippingCompanyMapping = {
  id: number;
  shipping_company_id: number;
  company_id: string;
  company_name?: string | null;
  company_code?: string | null;
  created_at: string;
};

export type ShippingCompany = {
  id: number;
  name: string;
  code: string;
  type: ShippingCompanyType;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: ShippingCompanyStatus;
  contracts_count?: number;
  companies_count?: number;
  active_contract?: ShippingContract | null;
  contracts?: ShippingContract[];
  mappings?: ShippingCompanyMapping[];
  created_at: string;
  updated_at: string;
};

export type ShippingCompanyStats = {
  total_companies: number;
  active_companies: number;
  internal_companies: number;
  external_companies: number;
  archived_companies: number;
};

export type ShippingCompanyPayload = {
  name: string;
  code: string;
  type?: ShippingCompanyType; // required on create; immutable afterwards
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: Exclude<ShippingCompanyStatus, 'archived'>;
};

export type ShippingContractPayload = {
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  status?: ShippingContractStatus;
};

export type ShippingCompaniesQuery = {
  search?: string;
  type?: ShippingCompanyType;
  status?: ShippingCompanyStatus | 'all';
  page?: number;
  per_page?: number;
};

export type ShippingCompaniesResult = {
  data: ShippingCompany[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};
