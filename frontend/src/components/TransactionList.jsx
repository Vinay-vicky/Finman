import React, { useState, useMemo, useRef } from 'react';
import { Trash2, ArrowUpRight, ArrowDownRight, Search, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import ConfirmModal from './ConfirmModal';

const TransactionList = ({ transactions, onDelete, onEdit }) => {
  const containerRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  const [deleteId, setDeleteId] = useState(null);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', minimumFractionDigits: 0
    }).format(amount);
  };

  const processedTransactions = useMemo(() => {
    let result = transactions.filter(tx => 
      tx.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    result.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'date_asc') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'amount_desc') return b.amount - a.amount;
      if (sortBy === 'amount_asc') return a.amount - b.amount;
      return 0;
    });

    return result;
  }, [transactions, searchTerm, sortBy]);

  const totalPages = Math.ceil(processedTransactions.length / itemsPerPage) || 1;
  const paginatedTransactions = processedTransactions.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  const isDateSort = sortBy.includes('date');
  
  const groupedTransactions = useMemo(() => {
    if (!isDateSort) return null;
    return paginatedTransactions.reduce((groups, tx) => {
      let txDate = new Date(tx.date);
      if (isNaN(txDate.getTime())) txDate = new Date();
      const dateKey = txDate.toLocaleDateString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
      return groups;
    }, {});
  }, [paginatedTransactions, isDateSort]);

  useGSAP(() => {
    gsap.from('.tx-row', {
      y: 10,
      opacity: 0,
      duration: 0.32,
      stagger: 0.03,
      ease: 'power2.out',
      clearProps: 'all',
    });
  }, { scope: containerRef, dependencies: [currentPage, searchTerm, sortBy, paginatedTransactions.length] });

  const renderTransaction = (tx) => (
    <div key={tx.id} className="tx-row group flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-700/50 hover:border-slate-600 transition-all mb-2 last:mb-0 hover:shadow-lg hover:shadow-slate-900/20">
      <div className="flex flex-col flex-1">
        <span className="font-semibold text-white text-lg">{tx.title}</span>
        <span className="text-sm text-slate-400 mt-0.5">
          {tx.category} {!isDateSort && ` • ${new Date(tx.date).toLocaleDateString()}`}
        </span>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <span className={`font-bold flex items-center gap-1.5 text-lg whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
          {tx.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
          {formatCurrency(tx.amount)}
        </span>
        <button 
          className="p-2.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-full transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100" 
          onClick={() => onEdit(tx)} 
          title="Edit transaction" 
        >
          <Edit2 size={18} />
        </button>
        <button 
          className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100" 
          onClick={() => setDeleteId(tx.id)} 
          title="Delete transaction" 
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      <ConfirmModal 
        isOpen={!!deleteId}
        title="Delete Transaction"
        message="Are you sure you want to permanently delete this transaction? This action cannot be undone."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          onDelete(deleteId);
          setDeleteId(null);
        }}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h3 className="text-xl font-bold text-white">Recent Transactions</h3>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          
          <select 
            className="w-full sm:w-auto bg-slate-900/50 border border-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm appearance-none cursor-pointer" 
            value={sortBy} 
            onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Amount: High to Low</option>
            <option value="amount_asc">Amount: Low to High</option>
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-[400px]">
        {paginatedTransactions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-10 mt-8 border border-slate-800 rounded-2xl bg-slate-900/20 border-dashed">
            <p className="text-slate-400 text-lg mb-2">No transactions found</p>
            <p className="text-slate-500 text-sm">Try adjusting your search or filters.</p>
          </div>
        ) : (
          isDateSort ? (
            Object.keys(groupedTransactions).map((dateStr) => (
              <div key={dateStr} className="mb-6 last:mb-0">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-700/50 pb-2">
                  {dateStr}
                </h4>
                <div className="flex flex-col">
                  {groupedTransactions[dateStr].map(renderTransaction)}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col">
              {paginatedTransactions.map(renderTransaction)}
            </div>
          )
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-8 gap-4 pb-2">
          <button 
            className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-slate-300 font-medium text-sm bg-slate-800/50 px-4 py-1.5 rounded-full">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionList;
