import React, { useMemo, useState } from 'react';

export const DEFAULT_COUNTRY_CODE_OPTIONS = [
  { code: '+91', label: '🇮🇳 India (+91)' },
  { code: '+1', label: '🇺🇸/🇨🇦 US/Canada (+1)' },
  { code: '+44', label: '🇬🇧 United Kingdom (+44)' },
  { code: '+61', label: '🇦🇺 Australia (+61)' },
  { code: '+971', label: '🇦🇪 UAE (+971)' },
  { code: '+65', label: '🇸🇬 Singapore (+65)' },
  { code: '+49', label: '🇩🇪 Germany (+49)' },
  { code: '+33', label: '🇫🇷 France (+33)' },
];

const CountryCodePicker = ({
  value,
  onChange,
  options = DEFAULT_COUNTRY_CODE_OPTIONS,
  searchPlaceholder = 'Search country or code (e.g. India, +91)',
  helperText,
}) => {
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q) || opt.code.includes(q));
  }, [options, search]);

  return (
    <div>
      <input
        type="text"
        className="w-full mb-2 bg-slate-900/50 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={searchPlaceholder}
      />
      <div className="px-3 py-3 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 text-sm font-semibold min-w-[150px] text-center">
        <select
          className="w-full bg-transparent text-slate-200 text-sm font-semibold focus:outline-none"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        >
          {filteredOptions.map((opt) => (
            <option key={opt.code} value={opt.code} className="bg-slate-900 text-slate-100">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {helperText ? <p className="text-[11px] text-slate-500 mt-1">{helperText}</p> : null}
    </div>
  );
};

export default CountryCodePicker;
