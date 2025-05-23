// api.ts
import axios from "axios";

// Configuration de base
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Gestion du token d'authentification
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    localStorage.removeItem("accessToken");
  }
}

// Récupérer le token du localStorage lors du chargement de la page
if (typeof window !== "undefined") {
  const storedToken = localStorage.getItem("accessToken");
  if (storedToken) {
    accessToken = storedToken;
  }
}

// Création de l'instance axios avec configuration
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use((config) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Intercepteur pour gérer les réponses et les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Gérer les erreurs d'authentification
    if (error.response && error.response.status === 401) {
      setAccessToken(null);
      // Rediriger vers la page de connexion
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    
    // Améliorer les messages d'erreur pour le débogage
    if (error.response) {
      console.error(`API Error (${error.response.status}):`, error.response.data);
    } else if (error.request) {
      console.error("No response received:", error.request);
    } else {
      console.error("Error setting up request:", error.message);
    }
    
    return Promise.reject(error);
  }
);

// FONCTIONS API POUR L'IMMOBILIER
// ===============================

// Types pour les paramètres des fonctions
interface PropertyData {
  propertyAddress: string;
  propertyType: string;
  usage: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValuation: number;
  squareFootage?: number | null;
  yearBuilt?: number | null;
  numberOfBedrooms?: number | null;
  numberOfBathrooms?: number | null;
  mortgage?: MortgageData | null;
  labels?: number[];
}

interface MortgageData {
  mortgageAmount: number;
  interestRate: number;
  monthlyPayment: number;
  termInYears?: number;
}

interface ExpenseData {
  realEstateInvestmentId: number;
  amount: number;
  description: string;
  date: string;
  category?: string;
  labelIds?: number[];
}

interface ValuationData {
  realEstateInvestmentId: number;
  valuationDate: string;
  valuationAmount: number;
  valuationMethod?: string;
}

interface DocumentFormData extends FormData {
  append(name: string, value: string | Blob | number, fileName?: string): void;
}

// Propriétés
export const fetchRealEstateInvestments = () => {
  return api.get("/real-estate/investments");
};

export const fetchRealEstateInvestment = (id: number) => {
  return api.get(`/real-estate/investments/${id}`);
};

export const createRealEstateInvestment = (data: PropertyData) => {
  return api.post("/real-estate/investments", data);
};

export const updateRealEstateInvestment = (id: number, data: PropertyData) => {
  return api.put(`/real-estate/investments/${id}`, data);
};

export const deleteRealEstateInvestment = (id: number) => {
  return api.delete(`/real-estate/investments/${id}`);
};

// Dépenses
export const fetchRealEstateExpenses = (propertyId: number) => {
  return api.get(`/real-estate/expenses?propertyId=${propertyId}`);
};

export const fetchRealEstateExpense = (id: number) => {
  return api.get(`/real-estate/expenses/${id}`);
};

export const createRealEstateExpense = (data: ExpenseData) => {
  return api.post("/real-estate/expenses", data);
};

export const updateRealEstateExpense = (id: number, data: Partial<ExpenseData>) => {
  return api.put(`/real-estate/expenses/${id}`, data);
};

export const deleteRealEstateExpense = (id: number) => {
  return api.delete(`/real-estate/expenses/${id}`);
};

// Évaluations
export const fetchRealEstateValuations = (propertyId: number) => {
  return api.get(`/real-estate/valuations?propertyId=${propertyId}`);
};

export const createRealEstateValuation = (data: ValuationData) => {
  return api.post("/real-estate/valuations", data);
};

// Documents
export const fetchRealEstateDocuments = (propertyId: number) => {
  return api.get(`/real-estate/documents?propertyId=${propertyId}`);
};

export const createRealEstateDocument = (propertyId: number, name: string, documentType: string, file: File, description?: string) => {
  const formData: DocumentFormData = new FormData();
  formData.append("realEstateInvestmentId", propertyId);
  formData.append("name", name);
  formData.append("documentType", documentType);
  formData.append("file", file);
  
  if (description) {
    formData.append("description", description);
  }
  
  return api.post("/real-estate/documents", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
};

export const deleteRealEstateDocument = (id: number) => {
  return api.delete(`/real-estate/documents/${id}`);
};

// Locataires
export const fetchRealEstateTenants = (propertyId: number) => {
  return api.get(`/real-estate/tenants?propertyId=${propertyId}`);
};

export const fetchRealEstateTenant = (id: number) => {
  return api.get(`/real-estate/tenants/${id}`);
};

export const createRealEstateTenant = (data: any) => {
  return api.post("/real-estate/tenants", data);
};

export const updateRealEstateTenant = (id: number, data: any) => {
  return api.put(`/real-estate/tenants/${id}`, data);
};

export const deleteRealEstateTenant = (id: number) => {
  return api.delete(`/real-estate/tenants/${id}`);
};

// Paiements de loyer
export const fetchTenantPayments = (tenantId: number) => {
  return api.get(`/real-estate/tenants/${tenantId}/payments`);
};

export const createRentPayment = (tenantId: number, data: any) => {
  return api.post(`/real-estate/tenants/${tenantId}/payments`, data);
};

export const updateRentPayment = (id: number, data: any) => {
  return api.put(`/real-estate/payments/${id}`, data);
};

// Maintenance
export const fetchMaintenanceRequests = (propertyId: number) => {
  return api.get(`/real-estate/maintenance?propertyId=${propertyId}`);
};

export const createMaintenanceRequest = (data: any) => {
  return api.post("/real-estate/maintenance", data);
};

export const updateMaintenanceRequest = (id: number, data: any) => {
  return api.put(`/real-estate/maintenance/${id}`, data);
};

// Statistiques
export const fetchRealEstateStatistics = () => {
  return api.get("/real-estate/statistics");
};

// Étiquettes
export const fetchLabels = () => {
  return api.get("/labels");
};

export const createLabel = (name: string, color: string) => {
  return api.post("/labels", { name, color });
};

// Export pour utilisation globale
export default api;