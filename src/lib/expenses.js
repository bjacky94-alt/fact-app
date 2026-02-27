// Types et catégories
export const EXPENSE_CATEGORIES = [
  'Transport',
  'Repas',
  'Hôtel',
  'Matériel',
  'Logiciel',
  'Télécom',
  'Frais bancaires',
  'Autre',
];

// Clé localStorage
const STORAGE_KEY = 'nodebox_expenses';

// Fonctions utilitaires
export const newId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

export const yearOfISO = (isoDate) => {
  return parseInt(isoDate.split('-')[0], 10);
};

export const monthOfISO = (isoDate) => {
  return parseInt(isoDate.split('-')[1], 10);
};

export const fmtEUR = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export const sumExpenses = (expenses) => {
  return expenses.reduce((sum, exp) => sum + exp.amount, 0);
};

// Conversion fichier -> data URL avec timeout
export const fileToDataUrl = (file, timeoutMs = 30000) => {
  console.log(`[expenses] Début conversion fichier: ${file.name} (${(file.size / 1024).toFixed(2)} Ko)`);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let timeoutId;
    
    // Timeout pour éviter les blocages
    timeoutId = setTimeout(() => {
      reader.abort();
      console.error(`[expenses] Timeout conversion fichier ${file.name} après ${timeoutMs}ms`);
      reject(new Error(`Timeout: La conversion du fichier ${file.name} a pris trop de temps`));
    }, timeoutMs);
    
    reader.onload = () => {
      clearTimeout(timeoutId);
      console.log(`[expenses] Conversion réussie: ${file.name}`);
      resolve({
        name: file.name,
        dataUrl: reader.result,
      });
    };
    
    reader.onerror = (error) => {
      clearTimeout(timeoutId);
      console.error(`[expenses] Erreur conversion fichier ${file.name}:`, error);
      reject(error);
    };
    
    reader.readAsDataURL(file);
  });
};

// CRUD localStorage
export const loadExpenses = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const expenses = stored ? JSON.parse(stored) : [];
    console.log(`[expenses] Chargement de ${expenses.length} dépense(s)`);
    return expenses;
  } catch (error) {
    console.error('[expenses] Erreur lors du chargement des dépenses:', error);
    return [];
  }
};

export const saveExpenses = (expenses) => {
  try {
    console.log(`[expenses] Sauvegarde de ${expenses.length} dépense(s)`);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    // Déclencher un événement pour notifier les composants
    window.dispatchEvent(new CustomEvent('expensesUpdated'));
    console.log('[expenses] Sauvegarde réussie');
  } catch (error) {
    console.error('[expenses] Erreur lors de la sauvegarde des dépenses:', error);
    throw error;
  }
};

// Anciennes fonctions (pour compatibilité)
export const getExpenses = () => {
  return loadExpenses();
};

export const saveExpense = (expense) => {
  console.log(`[expenses] Ajout d'une nouvelle dépense:`, { id: expense.id, category: expense.category, amount: expense.amount });
  const expenses = getExpenses();
  expenses.push(expense);
  saveExpenses(expenses);
  return expense;
};

export const deleteExpense = (id) => {
  console.log(`[expenses] Suppression de la dépense: ${id}`);
  const expenses = getExpenses().filter((exp) => exp.id !== id);
  saveExpenses(expenses);
};

export const getExpensesByCategory = (category) => {
  return getExpenses().filter((exp) => exp.category === category);
};

export const getTotalExpenses = () => {
  return sumExpenses(getExpenses());
};

export const getExpensesByMonth = (month, year) => {
  return getExpenses().filter((exp) => {
    return monthOfISO(exp.date) === month && yearOfISO(exp.date) === year;
  });
};

export const getTotalExpensesByMonth = (month, year) => {
  return sumExpenses(getExpensesByMonth(month, year));
};
