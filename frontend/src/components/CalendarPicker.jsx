import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const CalendarPicker = ({ selectedDate, onDateSelect, onClose }) => {
  const [value, setValue] = useState(selectedDate || new Date());

  const handleDateClick = (date) => {
    setValue(date);
    onDateSelect(date);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 transform transition-all">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Select Date</h3>
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
            display: none;
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

        <div className="mb-6">
          <Calendar
            value={value}
            onChange={handleDateClick}
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
            onClick={() => {
              onDateSelect(value);
              onClose();
            }}
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
