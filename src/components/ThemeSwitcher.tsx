import { useTheme } from "@/styles/tokens/semantic";
import { Monitor, Moon, Sun } from "lucide-react";

// Define ThemeMode type if not imported from elsewhere
type ThemeMode = 'light' | 'dark' | 'system';

export const ThemeSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, setTheme } = useTheme();

  const themes: { value: ThemeMode; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
    { value: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
    { value: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System' },
  ];

  return (
    <div className={`inline-flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 ${className}`}>
      {themes.map((t) => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          className={`
            px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
            ${theme === t.value 
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }
          `}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
};