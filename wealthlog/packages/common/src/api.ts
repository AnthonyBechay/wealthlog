// api.ts
import axios from "axios";

// We'll store the token in localStorage OR memory in production.
let accessToken: string | null = null;

// A helper to set or clear the token
export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem("accessToken", token);
  } else {
    localStorage.removeItem("accessToken");
  }
}

// On page load, let's see if there's a token in localStorage
const storedToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
if (storedToken) {
  accessToken = storedToken;
}

// Create Axios instance
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
});

// Interceptor to add Bearer token
api.interceptors.request.use((config) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Interceptor pour gérer les erreurs d'authentification
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si le token est invalide ou expiré
    if (error.response && error.response.status === 401) {
      setAccessToken(null);
      // Rediriger vers la page de connexion si nécessaire
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// =============== REAL ESTATE API ===============
// Vous pouvez ajouter ces fonctions pour faciliter l'accès à vos routes immobilières

// Récupérer toutes les propriétés
export const fetchRealEstateInvestments = () => api.get("/real-estate/investments");

// Récupérer une propriété spécifique
export const fetchRealEstateInvestment = (id: number) => api.get(`/real-estate/investments/${id}`);

// Créer une nouvelle propriété
export const createRealEstateInvestment = (data: any) => api.post("/real-estate/investments", data);

// Mettre à jour une propriété
export const updateRealEstateInvestment = (id: number, data: any) => api.put(`/real-estate/investments/${id}`, data);

// Supprimer une propriété
export const deleteRealEstateInvestment = (id: number) => api.delete(`/real-estate/investments/${id}`);

// Récupérer les dépenses d'une propriété
export const fetchRealEstateExpenses = (propertyId: number) => api.get(`/real-estate/expenses?propertyId=${propertyId}`);

// Ajouter une dépense
export const createRealEstateExpense = (data: any) => api.post("/real-estate/expenses", data);

// Récupérer les évaluations d'une propriété
export const fetchRealEstateValuations = (propertyId: number) => api.get(`/real-estate/valuations?propertyId=${propertyId}`);

// Ajouter une évaluation
export const createRealEstateValuation = (data: any) => api.post("/real-estate/valuations", data);

// Récupérer les documents d'une propriété
export const fetchRealEstateDocuments = (propertyId: number) => api.get(`/real-estate/documents?propertyId=${propertyId}`);

// Ajouter un document (avec formData pour les fichiers)
export const createRealEstateDocument = (formData: FormData) => api.post("/real-estate/documents", formData, {
  headers: {
    "Content-Type": "multipart/form-data"
  }
});

// Récupérer les locataires d'une propriété
export const fetchRealEstateTenants = (propertyId: number) => api.get(`/real-estate/tenants?propertyId=${propertyId}`);

// Récupérer un locataire spécifique
export const fetchRealEstateTenant = (id: number) => api.get(`/real-estate/tenants/${id}`);

// Ajouter un locataire
export const createRealEstateTenant = (data: any) => api.post("/real-estate/tenants", data);

// Mettre à jour un locataire
export const updateRealEstateTenant = (id: number, data: any) => api.put(`/real-estate/tenants/${id}`, data);

// Récupérer les paiements d'un locataire
export const fetchTenantPayments = (tenantId: number) => api.get(`/real-estate/tenants/${tenantId}/payments`);

// Ajouter un paiement de loyer
export const createRentPayment = (tenantId: number, data: any) => api.post(`/real-estate/tenants/${tenantId}/payments`, data);

// Récupérer les demandes de maintenance d'une propriété
export const fetchMaintenanceRequests = (propertyId: number) => api.get(`/real-estate/maintenance?propertyId=${propertyId}`);

// Ajouter une demande de maintenance
export const createMaintenanceRequest = (data: any) => api.post("/real-estate/maintenance", data);

// Mettre à jour une demande de maintenance
export const updateMaintenanceRequest = (id: number, data: any) => api.put(`/real-estate/maintenance/${id}`, data);

// Récupérer les projections financières d'une propriété
export const fetchRealEstateProjections = (propertyId: number) => api.get(`/real-estate/projections?propertyId=${propertyId}`);

// Ajouter une projection financière
export const createRealEstateProjection = (data: any) => api.post("/real-estate/projections", data);

// Récupérer les statistiques globales du portefeuille immobilier
export const fetchRealEstateStatistics = () => api.get("/real-estate/statistics");