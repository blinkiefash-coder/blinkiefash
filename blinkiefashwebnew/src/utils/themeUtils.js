/**
 * Gender-based theme utilities for BlinkieFash
 */

export const THEME_COLORS = {
  women: {
    primary: '#ec4899', // Pink
    light: '#fce7f3',   // Light pink
    dark: '#be185d',    // Dark pink
    accent: '#db2777',  // Darker pink
  },
  men: {
    primary: '#2563eb', // Blue
    light: '#dbeafe',   // Light blue
    dark: '#1e40af',    // Dark blue
    accent: '#1d4ed8',  // Darker blue
  },
  default: {
    primary: '#16a34a', // Green (default brand color)
    light: '#dcfce7',
    dark: '#15803d',
    accent: '#22c55e',
  }
};

export const getThemeColors = (gender) => {
  const normalizedGender = (gender || '').toLowerCase().trim();
  return THEME_COLORS[normalizedGender] || THEME_COLORS.default;
};

export const applyThemeVariables = (gender) => {
  const colors = getThemeColors(gender);
  const root = document.documentElement;
  
  root.style.setProperty('--theme-primary', colors.primary);
  root.style.setProperty('--theme-light', colors.light);
  root.style.setProperty('--theme-dark', colors.dark);
  root.style.setProperty('--theme-accent', colors.accent);
};

export const removeThemeVariables = () => {
  const root = document.documentElement;
  root.style.removeProperty('--theme-primary');
  root.style.removeProperty('--theme-light');
  root.style.removeProperty('--theme-dark');
  root.style.removeProperty('--theme-accent');
};

export const getGenderBasedCategory = (gender) => {
  const normalizedGender = (gender || '').toLowerCase().trim();
  if (normalizedGender === 'women') return 'women';
  if (normalizedGender === 'men') return 'men';
  return null;
};
