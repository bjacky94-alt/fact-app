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

// Conversion fichier -> data URL
export const fileToDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        dataUrl: reader.result,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// CRUD localStorage
export const loadExpenses = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveExpenses = (expenses) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  // Déclencher un événement pour notifier les composants
  window.dispatchEvent(new CustomEvent('expensesUpdated'));
};

// Anciennes fonctions (pour compatibilité)
export const getExpenses = () => {
  return loadExpenses();
};

export const saveExpense = (expense) => {
  const expenses = getExpenses();
  expenses.push(expense);
  saveExpenses(expenses);
  return expense;
};

export const deleteExpense = (id) => {
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
