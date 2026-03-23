import React, { useState, useMemo } from 'react';
import { Trash2, ArrowUpRight, ArrowDownRight, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const TransactionList = ({ transactions, onDelete }) => {
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

  const renderTransaction = (tx) => (
    <div key={tx.id} className="transaction-item" style={{ padding: '0.75rem 1rem', marginBottom: isDateSort ? '0' : '0.5rem' }}>
      <div className="transaction-info">
        <span className="transaction-title">{tx.title}</span>
        <span className="transaction-category">{tx.category} {!isDateSort && ` • ${new Date(tx.date).toLocaleDateString()}`}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span className={`transaction-amount ${tx.type === 'income' ? 'amount-income' : 'amount-expense'}`} style={{ fontSize: '1rem' }}>
          {tx.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {formatCurrency(tx.amount)}
        </span>
        <button 
          className="delete-btn" 
          onClick={() => setDeleteId(tx.id)} 
          title="Delete transaction" 
          style={{ padding: '0.25rem' }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>History</h3>
        
        <div style={{ display: 'flex', gap: '1rem', flex: 1, justifyContent: 'flex-end', minWidth: '300px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '250px' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search transactions..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ paddingLeft: '2.5rem', width: '100%' }}
            />
          </div>
          
          <select 
            className="form-control" 
            value={sortBy} 
            onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            style={{ width: 'auto', WebkitAppearance: 'none', appearance: 'none' }}
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Amount: High to Low</option>
            <option value="amount_asc">Amount: Low to High</option>
          </select>
        </div>
      </div>

      <div className="transaction-list" style={{ flex: 1 }}>
        {paginatedTransactions.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', background: 'rgba(30, 41, 59, 0.2)' }}>
            <p style={{ color: 'var(--text-muted)' }}>No transactions found.</p>
          </div>
        ) : (
          isDateSort ? (
            Object.keys(groupedTransactions).map((dateStr) => (
              <div key={dateStr} style={{ marginBottom: '1rem' }}>
                <h4 style={{ 
                  marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', 
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem'
                }}>
                  {dateStr}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {groupedTransactions[dateStr].map(renderTransaction)}
                </div>
              </div>
            ))
          ) : (
            paginatedTransactions.map(renderTransaction)
          )
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '2rem', gap: '1rem' }}>
          <button 
            className="btn" 
            style={{ width: 'auto', padding: '0.5rem', background: 'var(--panel-bg)' }}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
            <ChevronLeft size={20} color="var(--text-main)" />
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button 
            className="btn" 
            style={{ width: 'auto', padding: '0.5rem', background: 'var(--panel-bg)' }}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          >
            <ChevronRight size={20} color="var(--text-main)" />
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionList;
