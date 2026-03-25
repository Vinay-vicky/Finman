import React, { useEffect, useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const CalendarPicker = ({ selectedDate, onDateSelect, onClose }) => {
  const [value, setValue] = useState(selectedDate || new Date());
  const [selectedMonth, setSelectedMonth] = useState((selectedDate || new Date()).getMonth());
  const [selectedYear, setSelectedYear] = useState((selectedDate || new Date()).getFullYear());
  const [timeValue, setTimeValue] = useState(() => {
    const d = selectedDate || new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  });

  const years = useMemo(() => {
    const nowYear = new Date().getFullYear();
    const list = [];
    for (let y = nowYear - 10; y <= nowYear + 10; y += 1) {
      list.push(y);
    }
    return list;
  }, []);

  useEffect(() => {
    const d = selectedDate || new Date();
    setValue(d);
    setSelectedMonth(d.getMonth());
    setSelectedYear(d.getFullYear());
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    setTimeValue(`${h}:${m}`);
  }, [selectedDate]);

  const handleDateClick = (date) => {
    setValue(date);
    setSelectedMonth(date.getMonth());
    setSelectedYear(date.getFullYear());
  };

  const handleMonthYearChange = (month, year) => {
    const next = new Date(value);
    next.setFullYear(year);
    next.setMonth(month);
    setValue(next);
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  const handleConfirm = () => {
    const [hours, minutes] = timeValue.split(':').map((n) => Number(n) || 0);
    const next = new Date(value);
    next.setHours(hours, minutes, 0, 0);
    onDateSelect(next);
    onClose();
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 transform transition-all">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Select Date & Time</h3>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <style>{`
          .react-calendar {
            background: transparent;
            border: none;
            font-family: inherit;
            width: 100%;
          }
          
          .react-calendar__navigation {
            display: flex;
            margin-bottom: 0.5rem;
          }

          .react-calendar__navigation button {
            color: #cbd5e1;
            min-width: 36px;
            background: transparent;
            border: 0;
            border-radius: 0.5rem;
          }

          .react-calendar__navigation button:hover {
            background: #334155;
          }
          
          .react-calendar__month-view__weekdays {
            text-align: center;
            color: #cbd5e1;
            font-weight: 600;
            font-size: 0.875rem;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid #334155;
          }
          
          .react-calendar__month-view__weekdays__weekday {
            padding: 0.5rem;
          }
          
          .react-calendar__month-view__days {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 0.25rem;
            padding-bottom: 1rem;
          }
          
          .react-calendar__tile {
            aspect-square;
            padding: 0;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 0.75rem;
            font-size: 0.875rem;
            color: #cbd5e1;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .react-calendar__tile:hover:not(:disabled) {
            background: #334155;
            color: #fff;
            border-color: #475569;
            transform: scale(1.05);
          }
          
          .react-calendar__tile--now {
            background: #10b981;
            color: white;
            font-weight: 600;
            border-color: #059669;
          }
          
          .react-calendar__tile--active {
            background: #0ea5e9;
            color: white;
            font-weight: 600;
            border-color: #0284c7;
            box-shadow: 0 0 10px rgba(14, 165, 233, 0.3);
          }
          
          .react-calendar__tile--disabled {
            color: #64748b;
            background: transparent;
          }
          
          .react-calendar__tile--weekend {
            color: #f87171;
          }
          
          .react-calendar__month-view__days__day--weekend {
            color: #f87171;
          }
        `}</style>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <select
            className="col-span-1 bg-slate-900/60 border border-slate-700 text-slate-200 rounded-lg px-2 py-2 text-sm"
            value={selectedMonth}
            onChange={(e) => handleMonthYearChange(Number(e.target.value), selectedYear)}
          >
            {monthNames.map((month, idx) => (
              <option key={month} value={idx} className="bg-slate-800">
                {month}
              </option>
            ))}
          </select>

          <select
            className="col-span-1 bg-slate-900/60 border border-slate-700 text-slate-200 rounded-lg px-2 py-2 text-sm"
            value={selectedYear}
            onChange={(e) => handleMonthYearChange(selectedMonth, Number(e.target.value))}
          >
            {years.map((year) => (
              <option key={year} value={year} className="bg-slate-800">
                {year}
              </option>
            ))}
          </select>

          <input
            type="time"
            className="col-span-1 bg-slate-900/60 border border-slate-700 text-slate-200 rounded-lg px-2 py-2 text-sm"
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <Calendar
            value={value}
            onChange={handleDateClick}
            activeStartDate={new Date(selectedYear, selectedMonth, 1)}
            onActiveStartDateChange={({ activeStartDate }) => {
              if (!activeStartDate) return;
              setSelectedMonth(activeStartDate.getMonth());
              setSelectedYear(activeStartDate.getFullYear());
            }}
            tileClassName="calendar-tile"
            prev2Label={null}
            next2Label={null}
            prevLabel={<ChevronLeft size={18} />}
            nextLabel={<ChevronRight size={18} />}
          />
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-emerald-500/20"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarPicker;
