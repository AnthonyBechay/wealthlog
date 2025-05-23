//  apps/web/pages/reset-password.tsx true
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { api } from '@wealthlog/common';
import Link from 'next/link';

interface ResetPasswordForm {
  password: string;
  passwordConfirm: string;
}
export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;
  
  const [formData, setFormData] = useState<ResetPasswordForm>({
    password: '',
    passwordConfirm: '',
  });
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isTokenChecked, setIsTokenChecked] = useState(false);

  useEffect(() => {
    // Vérifier la validité du token une fois qu'il est disponible
    if (token && !isTokenChecked) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    if (!token) return;

    try {
      // CORRECTION ICI : Utilisez verify-reset-token au lieu de verify-email
      const response = await api.get(`/auth/verify-reset-token?token=${token}`);
      
      if (response.data?.success) {
        setIsTokenValid(true);
      } else {
        setError('Ce lien de réinitialisation est invalide ou a expiré.');
      }
    } catch (err) {
      console.error('Error verifying token:', err);
      setError('Ce lien de réinitialisation est invalide ou a expiré.');
    } finally {
      setIsTokenChecked(true);
    }
  };

  const handleInputChange = (field: keyof ResetPasswordForm) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    
    // Effacer l'erreur quand l'utilisateur commence à taper
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validation côté client
    if (!formData.password.trim()) {
      setError('Le mot de passe est requis.');
      setIsLoading(false);
      return;
    }
    
    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      setIsLoading(false);
      return;
    }
    
    if (formData.password !== formData.passwordConfirm) {
      setError('Les mots de passe ne correspondent pas.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/reset-password', {
        token,
        password: formData.password
      });
      
      if (response.data?.success) {
        setIsSuccess(true);
      } else {
        setError('Échec de la réinitialisation du mot de passe. Veuillez réessayer.');
      }
    } catch (err: any) {
      console.error('Erreur de réinitialisation:', err);
      setError(err.response?.data?.error || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  // État de succès
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <div className="w-full max-w-md bg-[var(--background-2)] rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[var(--text)] mb-2">
              Mot de passe réinitialisé
            </h2>
            <p className="text-[var(--text)] mb-6">
              Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
            </p>
            
            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full py-2 text-white font-semibold bg-[var(--primary)] rounded-lg hover:opacity-90 transition"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  // État de vérification du token ou token invalide
  if (!isTokenChecked || (isTokenChecked && !isTokenValid)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <div className="w-full max-w-md bg-[var(--background-2)] rounded-lg shadow-lg p-6">
          <div className="text-center">
            {!isTokenChecked ? (
              <>
                <div className="mx-auto flex items-center justify-center h-12 w-12 mb-4">
                  <svg className="animate-spin h-6 w-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <p className="text-[var(--text)]">
                  Vérification du lien de réinitialisation...
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[var(--text)] mb-2">
                  Lien invalide
                </h2>
                <p className="text-[var(--text)] mb-6">
                  {error || "Ce lien de réinitialisation est invalide ou a expiré."}
                </p>
                
                <div className="space-y-3">
                  <Link href="/forgot-password">
                    <span className="block w-full py-2 text-[var(--primary)] font-semibold border border-[var(--primary)] rounded-lg hover:bg-[var(--primary)] hover:text-white transition cursor-pointer">
                      Demander un nouveau lien
                    </span>
                  </Link>
                  
                  <Link href="/login">
                    <span className="block w-full py-2 text-[var(--text)] font-semibold border border-gray-300 rounded-lg hover:bg-[var(--background)] transition cursor-pointer">
                      Retour à la connexion
                    </span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Formulaire de réinitialisation
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
      <div className="w-full max-w-md bg-[var(--background-2)] rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-[var(--text)]">
            Réinitialiser votre mot de passe
          </h2>
          <p className="text-[var(--text)] mt-2">
            Veuillez créer un nouveau mot de passe sécurisé.
          </p>
        </div>

        {error && (
          <div 
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Nouveau mot de passe */}
          <div>
            <label 
              htmlFor="password"
              className="block text-sm font-medium text-[var(--text)] mb-1"
            >
              Nouveau mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none bg-[var(--background)] text-[var(--text)]"
              value={formData.password}
              onChange={handleInputChange("password")}
              disabled={isLoading}
              required
              minLength={8}
              placeholder="Entrez votre nouveau mot de passe"
            />
          </div>

          {/* Confirmation du mot de passe */}
          <div>
            <label 
              htmlFor="passwordConfirm"
              className="block text-sm font-medium text-[var(--text)] mb-1"
            >
              Confirmer le mot de passe
            </label>
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none bg-[var(--background)] text-[var(--text)]"
              value={formData.passwordConfirm}
              onChange={handleInputChange("passwordConfirm")}
              disabled={isLoading}
              required
              placeholder="Confirmez votre mot de passe"
            />
          </div>

          {/* Bouton de soumission */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 mt-6 text-white font-bold rounded-lg bg-[var(--primary)] hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Réinitialisation...</span>
              </>
            ) : (
              <span>Réinitialiser le mot de passe</span>
            )}
          </button>
        </form>

        {/* Lien retour à la connexion */}
        <div className="mt-6 text-center">
          <Link href="/login">
            <span className="text-[var(--primary)] hover:opacity-80 font-semibold flex items-center justify-center space-x-1 cursor-pointer">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Retour à la connexion</span>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
