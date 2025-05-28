import { useState, useEffect, useMemo } from "react";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
// Couleurs pour les graphiques
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a569bd', '#5dade2'];
import { 
  fetchRealEstateInvestments, 
  createRealEstateInvestment, 
  updateRealEstateInvestment, 
  deleteRealEstateInvestment,
  createRealEstateExpense,
  fetchRealEstateExpenses,
  createRealEstateValuation
} from "./api";


const USE_API = false; 

// Fonctions de stockage local
const saveToLocalStorage = (properties) => {
  try {
    localStorage.setItem('realEstateProperties', JSON.stringify(properties));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

const loadFromLocalStorage = () => {
  try {
    const storedProperties = localStorage.getItem('realEstateProperties');
    return storedProperties ? JSON.parse(storedProperties) : null;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return null;
  }
};

// Types
interface Property {
  id: number;
  propertyAddress: string;
  propertyType: string;
  usage: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValuation: number;
  squareFootage?: number;
  yearBuilt?: number;
  numberOfBedrooms?: number;
  numberOfBathrooms?: number;
  expenses: Expense[];
  valuations: Valuation[];
  mortgage?: Mortgage;
}

interface Expense {
  id: number;
  amount: number;
  description: string;
  date: string;
  category?: string;
}

interface Valuation {
  id: number;
  valuationDate: string;
  valuationAmount: number;
  valuationMethod?: string;
}

interface Mortgage {
  id: number;
  mortgageAmount: number;
  interestRate: number;
  monthlyPayment: number;
  termInYears?: number;
}

// Constantes
const PROPERTY_TYPES = [
  "HOUSE", "APARTMENT", "CONDO", "LAND", "COMMERCIAL", 
  "INDUSTRIAL", "MULTIFAMILY", "OTHER"
];

const USAGE_TYPES = [
  "PRIMARY_RESIDENCE", "RENTAL", "INVESTMENT", 
  "VACATION", "MIXED_USE", "AIRBNB"
];

export default function RealEstate() {
  // États
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  // Formulaires
  const [propertyForm, setPropertyForm] = useState({
    propertyAddress: "",
    propertyType: "HOUSE",
    usage: "PRIMARY_RESIDENCE",
    purchaseDate: "",
    purchasePrice: "",
    currentValuation: "",
    squareFootage: "",
    yearBuilt: "",
    numberOfBedrooms: "",
    numberOfBathrooms: "",
    hasMortgage: false,
    mortgageAmount: "",
    interestRate: "",
    monthlyPayment: "",
    termInYears: ""
  });

  const [expenseForm, setExpenseForm] = useState({
    propertyId: "",
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    category: ""
  });

  // Calculs résumés
  const summary = useMemo(() => {
    const totalValue = properties.reduce((sum, p) => sum + p.currentValuation, 0);
    const totalCost = properties.reduce((sum, p) => sum + p.purchasePrice, 0);
    const totalMortgage = properties.reduce((sum, p) => sum + (p.mortgage?.mortgageAmount || 0), 0);
    const totalGain = totalValue - totalCost;
    const equity = totalValue - totalMortgage;
    
    return { 
      totalValue, 
      totalCost, 
      totalMortgage, 
      totalGain, 
      equity 
    };
  }, [properties]);

  // Données pour les graphiques
  const chartData = useMemo(() => {
    return properties.map(p => ({
      name: p.propertyAddress.split(',')[0],
      achat: p.purchasePrice,
      valeur: p.currentValuation,
      gain: p.currentValuation - p.purchasePrice
    }));
  }, [properties]);

  // Chargement initial
  useEffect(() => {
    loadData();
  }, []);

  // Fonction de chargement des données (hybride API/localStorage)
  const loadData = async () => {
    try {
      setLoading(true);
      
      if (USE_API) {
        // Mode API - Décommentez quand votre API est prête
        /*
        const response = await fetchRealEstateInvestments();
        if (response && response.data) {
          setProperties(response.data);
        } else {
          setProperties([]);
        }
        */
      } else {
        // Mode localStorage/simulation
        const storedProperties = loadFromLocalStorage();
        
        if (storedProperties && storedProperties.length > 0) {
          setProperties(storedProperties);
        } else {
          // Données de démo si rien n'est stocké
          const demoProperties = [{
            id: 1,
            propertyAddress: "123 Rue Exemple, Montréal",
            propertyType: "HOUSE",
            usage: "PRIMARY_RESIDENCE",
            purchaseDate: "2023-01-15",
            purchasePrice: 350000,
            currentValuation: 380000,
            squareFootage: 120,
            yearBuilt: 2010,
            numberOfBedrooms: 3,
            numberOfBathrooms: 2,
            expenses: [
              { id: 1, amount: 500, description: "Taxe foncière", date: "2023-12-15", category: "Taxes" },
              { id: 2, amount: 300, description: "Entretien", date: "2024-02-20", category: "Maintenance" }
            ],
            valuations: [
              { id: 1, valuationDate: "2023-01-15", valuationAmount: 350000 },
              { id: 2, valuationDate: "2023-06-15", valuationAmount: 360000 },
              { id: 3, valuationDate: "2024-01-15", valuationAmount: 380000 }
            ],
            mortgage: {
              id: 1,
              mortgageAmount: 280000,
              interestRate: 3.5,
              monthlyPayment: 1250,
              termInYears: 25
            }
          }];
          
          setProperties(demoProperties);
          saveToLocalStorage(demoProperties);
        }
      }
    } catch (error) {
      console.error("Failed to load real estate data:", error);
      
      // Fallback aux données locales en cas d'erreur API
      const storedProperties = loadFromLocalStorage();
      if (storedProperties && storedProperties.length > 0) {
        setProperties(storedProperties);
      } else {
        setProperties([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fonctions pour gérer les propriétés
  const openPropertyForm = (property?: Property) => {
    if (property) {
      setEditingProperty(property);
      setPropertyForm({
        propertyAddress: property.propertyAddress,
        propertyType: property.propertyType,
        usage: property.usage,
        purchaseDate: property.purchaseDate,
        purchasePrice: property.purchasePrice.toString(),
        currentValuation: property.currentValuation.toString(),
        squareFootage: property.squareFootage?.toString() || "",
        yearBuilt: property.yearBuilt?.toString() || "",
        numberOfBedrooms: property.numberOfBedrooms?.toString() || "",
        numberOfBathrooms: property.numberOfBathrooms?.toString() || "",
        hasMortgage: !!property.mortgage,
        mortgageAmount: property.mortgage?.mortgageAmount.toString() || "",
        interestRate: property.mortgage?.interestRate.toString() || "",
        monthlyPayment: property.mortgage?.monthlyPayment.toString() || "",
        termInYears: property.mortgage?.termInYears?.toString() || ""
      });
    } else {
      setEditingProperty(null);
      setPropertyForm({
        propertyAddress: "",
        propertyType: "HOUSE",
        usage: "PRIMARY_RESIDENCE",
        purchaseDate: new Date().toISOString().slice(0, 10),
        purchasePrice: "",
        currentValuation: "",
        squareFootage: "",
        yearBuilt: "",
        numberOfBedrooms: "",
        numberOfBathrooms: "",
        hasMortgage: false,
        mortgageAmount: "",
        interestRate: "",
        monthlyPayment: "",
        termInYears: "25"
      });
    }
    setShowPropertyForm(true);
  };

  const handlePropertySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      propertyAddress: propertyForm.propertyAddress,
      propertyType: propertyForm.propertyType,
      usage: propertyForm.usage,
      purchaseDate: propertyForm.purchaseDate,
      purchasePrice: parseFloat(propertyForm.purchasePrice),
      currentValuation: parseFloat(propertyForm.currentValuation),
      squareFootage: propertyForm.squareFootage ? parseFloat(propertyForm.squareFootage) : undefined,
      yearBuilt: propertyForm.yearBuilt ? parseInt(propertyForm.yearBuilt) : undefined,
      numberOfBedrooms: propertyForm.numberOfBedrooms ? parseInt(propertyForm.numberOfBedrooms) : undefined,
      numberOfBathrooms: propertyForm.numberOfBathrooms ? parseFloat(propertyForm.numberOfBathrooms) : undefined
    };

    const mortgageData = propertyForm.hasMortgage ? {
      mortgageAmount: parseFloat(propertyForm.mortgageAmount),
      interestRate: parseFloat(propertyForm.interestRate),
      monthlyPayment: parseFloat(propertyForm.monthlyPayment),
      termInYears: propertyForm.termInYears ? parseInt(propertyForm.termInYears) : 25
    } : undefined;

    try {
      if (USE_API) {
        // Mode API - Décommentez quand votre API est prête
        /*
        if (editingProperty) {
          await updateRealEstateInvestment(editingProperty.id, {
            ...payload,
            mortgage: mortgageData
          });
        } else {
          await createRealEstateInvestment({
            ...payload,
            mortgage: mortgageData
          });
        }
        */
      } else {
        // Mode simulation avec localStorage
        if (editingProperty) {
          // Mise à jour d'une propriété existante
          const updatedProperties = properties.map(p => 
            p.id === editingProperty.id 
              ? { 
                  ...p, 
                  ...payload,
                  mortgage: mortgageData ? {
                    ...p.mortgage,
                    ...mortgageData,
                    id: p.mortgage?.id || 1
                  } : undefined,
                  valuations: [
                    ...p.valuations,
                    // Ajouter une nouvelle évaluation si la valeur a changé
                    p.currentValuation !== payload.currentValuation ? {
                      id: Math.max(...p.valuations.map(v => v.id)) + 1,
                      valuationDate: new Date().toISOString().slice(0, 10),
                      valuationAmount: payload.currentValuation,
                      valuationMethod: "MANUAL_UPDATE"
                    } : null
                  ].filter(Boolean)
                } 
              : p
          );
          setProperties(updatedProperties);
          saveToLocalStorage(updatedProperties);
        } else {
          // Création d'une nouvelle propriété
          const newId = properties.length > 0 
            ? Math.max(...properties.map(p => p.id)) + 1 
            : 1;
            
          const newProperty: Property = {
            id: newId,
            ...payload,
            expenses: [],
            valuations: [
              { 
                id: 1, 
                valuationDate: payload.purchaseDate, 
                valuationAmount: payload.purchasePrice,
                valuationMethod: "INITIAL"
              }
            ],
            mortgage: mortgageData ? {
              id: 1,
              ...mortgageData
            } : undefined
          };
          
          const updatedProperties = [...properties, newProperty];
          setProperties(updatedProperties);
          saveToLocalStorage(updatedProperties);
        }
      }
      
      setShowPropertyForm(false);
      if (USE_API) {
        loadData(); // Recharger depuis l'API si en mode API
      }
    } catch (error) {
      console.error("Failed to save property:", error);
      alert("Erreur lors de l'enregistrement de la propriété");
    }
  };

  const deleteProperty = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette propriété?")) return;
    
    try {
      if (USE_API) {
        // Mode API - Décommentez quand votre API est prête
        /*
        await deleteRealEstateInvestment(id);
        loadData();
        */
      } else {
        // Mode simulation avec localStorage
        const updatedProperties = properties.filter(p => p.id !== id);
        setProperties(updatedProperties);
        saveToLocalStorage(updatedProperties);
      }
      
      if (selectedProperty === id) setSelectedProperty(null);
    } catch (error) {
      console.error("Failed to delete property:", error);
      alert("Erreur lors de la suppression de la propriété");
    }
  };

  // Fonctions pour gérer les dépenses
  const openExpenseForm = (propertyId?: number) => {
    setExpenseForm({
      propertyId: propertyId ? propertyId.toString() : "",
      amount: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      category: ""
    });
    setShowExpenseForm(true);
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const propertyId = parseInt(expenseForm.propertyId);
    const payload = {
      amount: parseFloat(expenseForm.amount),
      description: expenseForm.description,
      date: expenseForm.date,
      category: expenseForm.category || "Autres"
    };

    try {
      if (USE_API) {
        // Mode API - Décommentez quand votre API est prête
        /*
        await createRealEstateExpense({
          realEstateInvestmentId: propertyId,
          ...payload
        });
        loadData();
        */
      } else {
        // Mode simulation avec localStorage
        const updatedProperties = properties.map(p => 
          p.id === propertyId
            ? { 
                ...p, 
                expenses: [
                  ...p.expenses, 
                  { 
                    id: p.expenses.length > 0 ? Math.max(...p.expenses.map(e => e.id)) + 1 : 1, 
                    ...payload
                  }
                ]
              } 
            : p
        );
        
        setProperties(updatedProperties);
        saveToLocalStorage(updatedProperties);
      }
      
      setShowExpenseForm(false);
    } catch (error) {
      console.error("Failed to add expense:", error);
      alert("Erreur lors de l'ajout de la dépense");
    }
  };

  // Fonctions utilitaires
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatType = (type: string) => {
    return type.replace(/_/g, ' ');
  };

  const getStatusColor = (usage: string) => {
    const colors = {
      'PRIMARY_RESIDENCE': 'var(--success)',
      'RENTAL': 'var(--primary)',
      'INVESTMENT': 'var(--warning)',
      'VACATION': 'var(--info)',
      'MIXED_USE': 'var(--primary)',
      'AIRBNB': 'var(--info)'
    };
    return colors[usage] || '#6b7280';
  };

  // Affichage du chargement
  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--primary)' }}></div>
          <div>Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--text)' }}>
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Immobilier</h1>
          <div className="flex gap-2">
            <button
              onClick={() => openPropertyForm()}
              className="px-4 py-2 text-white rounded hover:opacity-90"
              style={{ backgroundColor: 'var(--success)' }}
            >
              Ajouter une propriété
            </button>
            <button
              onClick={() => openExpenseForm()}
              className="px-4 py-2 text-white rounded hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              Ajouter une dépense
            </button>
          </div>
        </div>

        {/* Cartes résumé */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded shadow" style={{ backgroundColor: 'var(--background-2)' }}>
            <div className="text-sm text-gray-600">Valeur totale</div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</div>
          </div>
          <div className="p-4 rounded shadow" style={{ backgroundColor: 'var(--background-2)' }}>
            <div className="text-sm text-gray-600">Valeur nette (Equity)</div>
            <div className="text-2xl font-bold">{formatCurrency(summary.equity)}</div>
          </div>
          <div className="p-4 rounded shadow" style={{ backgroundColor: 'var(--background-2)' }}>
            <div className="text-sm text-gray-600">Gain/Perte</div>
            <div className={`text-2xl font-bold ${summary.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.totalGain)}
            </div>
          </div>
          <div className="p-4 rounded shadow" style={{ backgroundColor: 'var(--background-2)' }}>
            <div className="text-sm text-gray-600">Investissement total</div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</div>
          </div>
        </div>

        {/* Graphiques */}
        {properties.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Graphique à barres existant */}
            <div className="p-4 rounded shadow" style={{ backgroundColor: 'var(--background-2)' }}>
              <h3 className="text-lg font-semibold mb-4">Valeurs par propriété</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="achat" name="Prix d'achat" fill="#8884d8" />
                  <Bar dataKey="valeur" name="Valeur actuelle" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Graphique circulaire */}
            <div className="p-4 rounded shadow" style={{ backgroundColor: 'var(--background-2)' }}>
              <h3 className="text-lg font-semibold mb-4">Répartition par type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(
                      properties.reduce((acc, p) => {
                        acc[p.propertyType] = (acc[p.propertyType] || 0) + p.currentValuation;
                        return acc;
                      }, {})
                    ).map(([type, value]) => ({
                      name: formatType(type),
                      value
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {Object.keys(
                      properties.reduce((acc, p) => {
                        acc[p.propertyType] = true;
                        return acc;
                      }, {})
                    ).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Table des propriétés */}
        <div className="p-4 rounded shadow mb-6" style={{ backgroundColor: 'var(--background-2)' }}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Propriétés ({properties.length})</h2>
          </div>

          {properties.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">Aucune propriété enregistrée.</p>
              <button
                onClick={() => openPropertyForm()}
                className="px-4 py-2 text-white rounded hover:opacity-90"
                style={{ backgroundColor: 'var(--success)' }}
              >
                Ajouter une propriété
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: 'var(--background)' }}>
                    <th className="border p-3 text-left" style={{ borderColor: '#ddd' }}>Propriété</th>
                    <th className="border p-3 text-center" style={{ borderColor: '#ddd' }}>Usage</th>
                    <th className="border p-3 text-right" style={{ borderColor: '#ddd' }}>Valeur</th>
                    <th className="border p-3 text-right" style={{ borderColor: '#ddd' }}>Gain/Perte</th>
                    <th className="border p-3 text-center" style={{ borderColor: '#ddd' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map(property => {
                    const gain = property.currentValuation - property.purchasePrice;
                    const gainPercent = (gain / property.purchasePrice) * 100;
                    
                    return (
                      <tr 
                        key={property.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedProperty(selectedProperty === property.id ? null : property.id)}
                        style={{ backgroundColor: selectedProperty === property.id ? 'var(--background-3)' : 'transparent' }}
                      >
                        <td className="border p-3" style={{ borderColor: '#ddd' }}>
                          <div className="font-medium">{property.propertyAddress}</div>
                          <div className="text-sm text-gray-500">
                            {property.propertyType}
                            {property.squareFootage ? ` • ${property.squareFootage}m²` : ''}
                          </div>
                        </td>
                        <td className="border p-3 text-center" style={{ borderColor: '#ddd' }}>
                          <span 
                            className="px-2 py-1 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: getStatusColor(property.usage) }}
                          >
                            {formatType(property.usage)}
                          </span>
                        </td>
                        <td className="border p-3 text-right font-semibold" style={{ borderColor: '#ddd' }}>
                          {formatCurrency(property.currentValuation)}
                        </td>
                        <td className="border p-3 text-right" style={{ borderColor: '#ddd' }}>
                          <div className={gain >= 0 ? 'text-green-600' : 'text-red-600'}>
                            <div className="font-semibold">{formatCurrency(gain)}</div>
                            <div className="text-sm">{gainPercent.toFixed(1)}%</div>
                          </div>
                        </td>
                        <td className="border p-3 text-center" style={{ borderColor: '#ddd' }}>
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={e => { e.stopPropagation(); openPropertyForm(property); }}
                              className="px-2 py-1 text-white rounded text-xs hover:opacity-90"
                              style={{ backgroundColor: 'var(--primary)' }}
                            >
                              Modifier
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); deleteProperty(property.id); }}
                              className="px-2 py-1 text-white rounded text-xs hover:opacity-90"
                              style={{ backgroundColor: 'var(--danger)' }}
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Détails de la propriété sélectionnée */}
        {selectedProperty && (
          <div className="p-4 rounded shadow mb-6" style={{ backgroundColor: 'var(--background-2)' }}>
            {(() => {
              const property = properties.find(p => p.id === selectedProperty);
              if (!property) return null;

              return (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">{property.propertyAddress}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openExpenseForm(property.id)}
                        className="px-3 py-1 text-white rounded text-sm hover:opacity-90"
                        style={{ backgroundColor: 'var(--warning)' }}
                      >
                        + Dépense
                      </button>
                      <button onClick={() => setSelectedProperty(null)} className="text-gray-500">✕</button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Informations de base */}
                    <div>
                      <h4 className="font-medium mb-3">Informations</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Type:</span>
                          <span>{property.propertyType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Usage:</span>
                          <span>{formatType(property.usage)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Prix d'achat:</span>
                          <span>{formatCurrency(property.purchasePrice)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Valeur actuelle:</span>
                          <span>{formatCurrency(property.currentValuation)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Date d'achat:</span>
                          <span>{new Date(property.purchaseDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Gain/Perte:</span>
                          <span className={property.currentValuation - property.purchasePrice >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(property.currentValuation - property.purchasePrice)} 
                            ({(((property.currentValuation - property.purchasePrice) / property.purchasePrice) * 100).toFixed(2)}%)
                          </span>
                        </div>
                        
                        {property.squareFootage && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Surface:</span>
                            <span>{property.squareFootage} m²</span>
                          </div>
                        )}
                        
                        {property.yearBuilt && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Année de construction:</span>
                            <span>{property.yearBuilt}</span>
                          </div>
                        )}
                        
                        {property.numberOfBedrooms && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Chambres:</span>
                            <span>{property.numberOfBedrooms}</span>
                          </div>
                        )}
                        
                        {property.numberOfBathrooms && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Salles de bain:</span>
                            <span>{property.numberOfBathrooms}</span>
                          </div>
                        )}
                        
                        {property.mortgage && (
                          <>
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <span className="font-medium">Prêt immobilier</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Montant:</span>
                              <span>{formatCurrency(property.mortgage.mortgageAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Taux d'intérêt:</span>
                              <span>{property.mortgage.interestRate.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Mensualité:</span>
<span>{formatCurrency(property.mortgage.monthlyPayment)}</span>
                            </div>
                            {property.mortgage.termInYears && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Durée:</span>
                                <span>{property.mortgage.termInYears} ans</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Dépenses récentes */}
                    <div>
                      <h4 className="font-medium mb-3">Dépenses récentes</h4>
                      {!property.expenses || property.expenses.length === 0 ? (
                        <p className="text-gray-500 text-sm">Aucune dépense enregistrée</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {property.expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(expense => (
                            <div key={expense.id} className="flex justify-between p-2 rounded" style={{ backgroundColor: 'var(--background)' }}>
                              <div>
                                <div className="text-sm font-medium">{expense.description}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(expense.date).toLocaleDateString()}
                                  {expense.category && ` - ${expense.category}`}
                                </div>
                              </div>
                              <div className="text-red-600 font-semibold">{formatCurrency(expense.amount)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Évolution de la valeur */}
                      <h4 className="font-medium mt-6 mb-3">Évolution de la valeur</h4>
                      {property.valuations.length > 1 ? (
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={property.valuations
                            .sort((a, b) => new Date(a.valuationDate).getTime() - new Date(b.valuationDate).getTime())
                            .map(v => ({
                              date: new Date(v.valuationDate).toLocaleDateString(),
                              valeur: v.valuationAmount
                            }))}>
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip formatter={(value) => formatCurrency(value as number)} />
                            <Line type="monotone" dataKey="valeur" stroke="#8884d8" />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-gray-500 text-sm">Pas assez de données pour afficher l'évolution.</p>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Modale Propriété */}
        {showPropertyForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-auto">
            <div 
              className="bg-white p-6 rounded shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: 'var(--background-2)', color: 'var(--text)' }}
            >
              <h3 className="text-lg font-semibold mb-4">
                {editingProperty ? 'Modifier la propriété' : 'Ajouter une propriété'}
              </h3>
              
              <form onSubmit={handlePropertySubmit} className="space-y-4">
                <div>
                  <label className="block font-medium mb-1">Adresse*</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded p-2"
                    style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                    value={propertyForm.propertyAddress}
                    onChange={e => setPropertyForm(prev => ({ ...prev, propertyAddress: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-medium mb-1">Type</label>
                    <select
                      className="w-full border rounded p-2"
                      style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                      value={propertyForm.propertyType}
                      onChange={e => setPropertyForm(prev => ({ ...prev, propertyType: e.target.value }))}
                    >
                      {PROPERTY_TYPES.map(type => (
                        <option key={type} value={type}>
                          {formatType(type)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Usage</label>
                    <select
                      className="w-full border rounded p-2"
                      style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                      value={propertyForm.usage}
                      onChange={e => setPropertyForm(prev => ({ ...prev, usage: e.target.value }))}
                    >
                      {USAGE_TYPES.map(type => (
                        <option key={type} value={type}>
                          {formatType(type)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block font-medium mb-1">Date d'achat*</label>
                    <input
                      type="date"
                      required
                      className="w-full border rounded p-2"
                      style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                      value={propertyForm.purchaseDate}
                      onChange={e => setPropertyForm(prev => ({ ...prev, purchaseDate: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium mb-1">Prix d'achat*</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="w-full border rounded p-2"
                      style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                      value={propertyForm.purchasePrice}
                      onChange={e => setPropertyForm(prev => ({ ...prev, purchasePrice: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1">Valeur actuelle*</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      className="w-full border rounded p-2"
                      style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                      value={propertyForm.currentValuation}
                      onChange={e => setPropertyForm(prev => ({ ...prev, currentValuation: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block font-medium mb-1">Surface (m²)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border rounded p-2"
                      style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                      value={propertyForm.squareFootage}
                      onChange={e => setPropertyForm(prev => ({ ...prev, squareFootage: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label className="block font-medium mb-1">Année construction</label>
                    <input
                      type="number"
                      className="w-full border rounded p-2"
                      style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                      value={propertyForm.yearBuilt}
                      onChange={e => setPropertyForm(prev => ({ ...prev, yearBuilt: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label className="block font-medium mb-1">Chambres</label>
                    <input
                      type="number"
                      className="w-full border rounded p-2"
                      style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                      value={propertyForm.numberOfBedrooms}
                      onChange={e => setPropertyForm(prev => ({ ...prev, numberOfBedrooms: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label className="block font-medium mb-1">Salles de bain</label>
                    <input
                      type="number"
                      step="0.5"
                      className="w-full border rounded p-2"
                      style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                      value={propertyForm.numberOfBathrooms}
                      onChange={e => setPropertyForm(prev => ({ ...prev, numberOfBathrooms: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={propertyForm.hasMortgage}
                      onChange={e => setPropertyForm(prev => ({ ...prev, hasMortgage: e.target.checked }))}
                      className="mr-2 h-4 w-4"
                    />
                    <span>Prêt immobilier</span>
                  </label>
                </div>

                {propertyForm.hasMortgage && (
                  <div className="space-y-4 pl-4 border-l-2 mt-3" style={{ borderColor: 'var(--primary)' }}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block font-medium mb-1">Montant du prêt*</label>
                        <input
                          type="number"
                          step="0.01"
                          required={propertyForm.hasMortgage}
                          className="w-full border rounded p-2"
                          style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                          value={propertyForm.mortgageAmount}
                          onChange={e => setPropertyForm(prev => ({ ...prev, mortgageAmount: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <label className="block font-medium mb-1">Taux d'intérêt (%)*</label>
                        <input
                          type="number"
                          step="0.01"
                          required={propertyForm.hasMortgage}
                          className="w-full border rounded p-2"
                          style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                          value={propertyForm.interestRate}
                          onChange={e => setPropertyForm(prev => ({ ...prev, interestRate: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <label className="block font-medium mb-1">Mensualité*</label>
                        <input
                          type="number"
                          step="0.01"
                          required={propertyForm.hasMortgage}
                          className="w-full border rounded p-2"
                          style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                          value={propertyForm.monthlyPayment}
                          onChange={e => setPropertyForm(prev => ({ ...prev, monthlyPayment: e.target.value }))}
                        />
                      </div>
                      
                      <div>
                        <label className="block font-medium mb-1">Durée (années)</label>
                        <input
                          type="number"
                          className="w-full border rounded p-2"
                          style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                          value={propertyForm.termInYears}
                          onChange={e => setPropertyForm(prev => ({ ...prev, termInYears: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPropertyForm(false)}
                    className="flex-1 px-4 py-2 border rounded hover:opacity-90"
                    style={{ borderColor: '#ddd' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-white rounded hover:opacity-90"
                    style={{ backgroundColor: 'var(--success)' }}
                  >
                    {editingProperty ? 'Mettre à jour' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modale Dépense */}
        {showExpenseForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div 
              className="bg-white p-6 rounded shadow-lg w-full max-w-md"
              style={{ backgroundColor: 'var(--background-2)', color: 'var(--text)' }}
            >
              <h3 className="text-lg font-semibold mb-4">Ajouter une dépense</h3>
              
              <form onSubmit={handleExpenseSubmit} className="space-y-4">
                <div>
                  <label className="block font-medium mb-1">Propriété*</label>
                  <select
                    required
                    className="w-full border rounded p-2"
                    style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                    value={expenseForm.propertyId}
                    onChange={e => setExpenseForm(prev => ({ ...prev, propertyId: e.target.value }))}
                  >
                    <option value="">Sélectionner une propriété</option>
                    {properties.map(property => (
                      <option key={property.id} value={property.id}>
                        {property.propertyAddress}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Montant*</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full border rounded p-2"
                    style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">Description*</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded p-2"
                    style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                    value={expenseForm.description}
                    onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block font-medium mb-1">Catégorie</label>
                  <select
                    className="w-full border rounded p-2"
                    style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                    value={expenseForm.category}
                    onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="">Sélectionner une catégorie</option>
                    <option value="Taxes">Taxes</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Utilities">Services publics</option>
                    <option value="Insurance">Assurance</option>
                    <option value="Management">Gestion</option>
                    <option value="Renovation">Rénovation</option>
                    <option value="Other">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Date*</label>
                  <input
                    type="date"
                    required
                    className="w-full border rounded p-2"
                    style={{ backgroundColor: 'var(--background)', borderColor: '#ddd' }}
                    value={expenseForm.date}
                    onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowExpenseForm(false)}
                    className="flex-1 px-4 py-2 border rounded hover:opacity-90"
                    style={{ borderColor: '#ddd' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-white rounded hover:opacity-90"
                    style={{ backgroundColor: 'var(--warning)' }}
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}