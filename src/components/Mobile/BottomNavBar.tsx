import React from "react";
import { Home, Compass, Library, Search, BarChart2 } from "lucide-react";

export type MobileTab = "home" | "discovery" | "library" | "search" | "analytics";

interface BottomNavBarProps {
  activeTab: MobileTab;
  setActiveTab: (tab: MobileTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: "home" as const, label: "Trang chủ", icon: Home },
    { id: "discovery" as const, label: "Khám phá", icon: Compass },
    { id: "library" as const, label: "Thư viện", icon: Library },
    { id: "search" as const, label: "Tìm kiếm", icon: Search },
    { id: "analytics" as const, label: "Thống kê", icon: BarChart2 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 px-2 pb-safe pt-1.5 shadow-2xl">
      <div className="flex justify-around items-center h-13 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 rounded-xl transition-all duration-200 ${
                isActive ? "text-apple-pink scale-105 font-bold" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
              <span className="text-[11px] tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
