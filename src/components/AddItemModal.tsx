import React, { useState } from 'react';
import { X, Plus, Layers } from 'lucide-react';
import { StockItem, Supplier } from '../types/stock';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: Partial<StockItem>) => void;
  suppliers: Supplier[];
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onAddItem,
  suppliers
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Dairy');
  const [customCategory, setCustomCategory] = useState('');
  const [unit, setUnit] = useState('Liters');
  const [openingStock, setOpeningStock] = useState('50');
  const [minLevel, setMinLevel] = useState('30');
  const [maxLevel, setMaxLevel] = useState('100');
  const [unitCost, setUnitCost] = useState('2.50');
  const [supplierId, setSupplierId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalCat = category === 'Custom' ? customCategory.trim() || 'General' : category;

    onAddItem({
      name: name.trim(),
      category: finalCat,
      unit: unit.trim() || 'pcs',
      openingStock: parseFloat(openingStock) || 0,
      currentStock: parseFloat(openingStock) || 0,
      minLevel: parseFloat(minLevel) || 0,
      maxLevel: parseFloat(maxLevel) || 0,
      unitCost: parseFloat(unitCost) || 0,
      supplierId: supplierId || undefined,
      totalIn: 0,
      totalOut: 0,
      totalWaste: 0,
      lastUpdated: new Date().toISOString()
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">Add New Inventory Product</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Organic Almond Milk"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department / Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
              >
                <option value="Dairy">Dairy & Milks</option>
                <option value="Coffee Beans">Coffee Beans</option>
                <option value="Syrups">Syrups & Flavors</option>
                <option value="Packaging">Packaging & Cups</option>
                <option value="Tea & Powder">Tea & Powder</option>
                <option value="Condiments">Condiments & Sugar</option>
                <option value="Bakery">Bakery & Food</option>
                <option value="Cleaning">Cleaning & Hygiene</option>
                <option value="Beverages">Beverages & Water</option>
                <option value="Custom">Custom Category...</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit of Measure *</label>
              <input
                type="text"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="e.g. Liters, kg, Bottles, Sleeves"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                required
              />
            </div>
          </div>

          {category === 'Custom' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Custom Category Name</label>
              <input
                type="text"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                placeholder="e.g. Seasonal Merch"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Opening Stock</label>
              <input
                type="number"
                step="any"
                min="0"
                value={openingStock}
                onChange={e => setOpeningStock(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-slate-800"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Min Level (Alert)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={minLevel}
                onChange={e => setMinLevel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-slate-800"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Level (Capacity)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={maxLevel}
                onChange={e => setMaxLevel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-slate-800"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit Cost ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={e => setUnitCost(e.target.value)}
                placeholder="e.g. 2.45"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-none focus:border-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Default Supplier</label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800"
              >
                <option value="">-- None / General --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Save Product to Master Stock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
