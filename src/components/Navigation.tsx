import React from 'react';
import {
  Coffee,
  Clock,
  ClipboardCheck,
  PackagePlus,
  Trash2,
  ShoppingCart,
  Truck,
  LayoutDashboard,
  Layers,
  Users,
  ShieldAlert,
  MoreHorizontal,
  FileSpreadsheet,
  Building2,
  Brain,
  ArrowLeftRight,
  Clock3
} from 'lucide-react';
import { UserRole } from '../types/stock';

export type TabId =
  | 'take'
  | 'history'
  | 'count'
  | 'stockin'
  | 'waste'
  | 'autoorder'
  | 'prediction'
  | 'transfer'
  | 'suppliers'
  | 'overview'
  | 'audit'
  | 'stock'
  | 'excel'
  | 'team'
  | 'workforce'
  | 'license'
  | 'superadmin';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ElementType;
  minRole: UserRole;
  badge?: number;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { id: 'take', label: 'Take to Bar/Kitchen', icon: Coffee, minRole: 'staff' },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, minRole: 'manager' },
  { id: 'audit', label: 'Smart Audit', icon: ShieldAlert, minRole: 'admin' },
  { id: 'stock', label: 'Stock Levels', icon: Layers, minRole: 'teamlead' },
  { id: 'prediction', label: 'ML Prediction', icon: Brain, minRole: 'manager' },
  { id: 'autoorder', label: 'Auto Order', icon: ShoppingCart, minRole: 'manager' },
  { id: 'transfer', label: 'Branch Transfer', icon: ArrowLeftRight, minRole: 'admin' },
  { id: 'excel', label: 'Excel & Catalog', icon: FileSpreadsheet, minRole: 'manager' },
  { id: 'stockin', label: 'Add Stock', icon: PackagePlus, minRole: 'teamlead' },
  { id: 'waste', label: 'Waste Log', icon: Trash2, minRole: 'teamlead' },
  { id: 'count', label: 'Count & Audit', icon: ClipboardCheck, minRole: 'staff' },
  { id: 'history', label: 'My History', icon: Clock, minRole: 'staff' },
  { id: 'workforce', label: 'Working Hours', icon: Clock3, minRole: 'staff' },
  { id: 'suppliers', label: 'Suppliers', icon: Truck, minRole: 'manager' },
  { id: 'team', label: 'Team PINs', icon: Users, minRole: 'admin' },
  { id: 'license', label: 'License & Security', icon: ShieldAlert, minRole: 'admin' },
  { id: 'superadmin', label: 'Super Admin', icon: Building2, minRole: 'superadmin' }
];

interface NavigationProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  userRole: UserRole;
  reorderCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  reorderCount = 0
}) => {
  const roleLevel: Record<UserRole, number> = {
    staff: 1,
    teamlead: 2,
    manager: 3,
    admin: 4,
    superadmin: 5
  };
  const userLevel = roleLevel[userRole] || 1;

  // Strict multi-tenant security: store admin can NEVER see superadmin
  const accessibleItems = ALL_NAV_ITEMS.filter(item => {
    if (item.minRole === 'superadmin' && userRole !== 'superadmin') return false;
    return userLevel >= roleLevel[item.minRole];
  });

  // Mobile layout ordering optimization:
  let orderedItems = [...accessibleItems];
  if (userRole === 'admin') {
    const adminPrios: TabId[] = ['overview', 'audit', 'stock', 'prediction'];
    orderedItems = [
      ...accessibleItems.filter(it => adminPrios.includes(it.id)),
      ...accessibleItems.filter(it => !adminPrios.includes(it.id))
    ];
  } else if (userRole === 'manager') {
    const mgrPrios: TabId[] = ['overview', 'stock', 'autoorder', 'prediction'];
    orderedItems = [
      ...accessibleItems.filter(it => mgrPrios.includes(it.id)),
      ...accessibleItems.filter(it => !mgrPrios.includes(it.id))
    ];
  } else if (userRole === 'teamlead') {
    const tlPrios: TabId[] = ['take', 'stock', 'stockin', 'count'];
    orderedItems = [
      ...accessibleItems.filter(it => tlPrios.includes(it.id)),
      ...accessibleItems.filter(it => !tlPrios.includes(it.id))
    ];
  } else if (userRole === 'staff') {
    orderedItems = accessibleItems; // take, count, history
  }

  const primaryMobileTabs = orderedItems.slice(0, 4);
  const secondaryMobileTabs = orderedItems.slice(4);
  const isCurrentInSecondary = secondaryMobileTabs.some(t => t.id === currentTab);
  const [showMobileMore, setShowMobileMore] = React.useState(false);

  return (
    <>
      {/* Desktop & Tablet Top Nav Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-14 sm:top-16 z-30 shadow-xs hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center space-x-1 overflow-x-auto py-2 no-scrollbar">
            {accessibleItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              const showBadge = item.id === 'autoorder' && reorderCount > 0;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {showBadge && (
                    <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                      {reorderCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Thumb Tab Bar (Ergonomic thumb reach <15% viewport height) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {primaryMobileTabs.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const showBadge = item.id === 'autoorder' && reorderCount > 0;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setShowMobileMore(false);
                  onSelectTab(item.id);
                }}
                className={`flex flex-col items-center justify-center py-1 rounded-lg transition-colors min-h-[44px] ${
                  isActive ? 'text-amber-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {showBadge && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center font-bold">
                      {reorderCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium tracking-tight mt-1 whitespace-nowrap truncate max-w-[58px]">
                  {item.label.split(' ')[0]}
                </span>
              </button>
            );
          })}

          {secondaryMobileTabs.length > 0 && (
            <button
              onClick={() => setShowMobileMore(!showMobileMore)}
              className={`flex flex-col items-center justify-center py-1 rounded-lg min-h-[44px] ${
                isCurrentInSecondary || showMobileMore
                  ? 'text-amber-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight mt-1">More</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile "More" Drawer / Popover */}
      {showMobileMore && (
        <div
          className="sm:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setShowMobileMore(false)}
        >
          <div
            className="bg-white rounded-t-3xl p-5 shadow-2xl max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">
              Manager & Admin Tools
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {secondaryMobileTabs.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                const showBadge = item.id === 'autoorder' && reorderCount > 0;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      setShowMobileMore(false);
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-xl text-left border transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-amber-500" />
                    <span className="text-xs font-medium truncate">{item.label}</span>
                    {showBadge && (
                      <span className="ml-auto w-4 h-4 rounded-full bg-red-600 text-white text-[9px] flex items-center justify-center font-bold">
                        {reorderCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowMobileMore(false)}
              className="w-full mt-4 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
