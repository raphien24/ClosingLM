"use client";

import { useState } from "react";
import { Calendar, Filter, X, RefreshCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { todayWIB } from "@/lib/dateUtils";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

interface FilterBarProps {
  allHubs: string[];
  missingHubs?: string[];
  selectedDate: string;
  selectedHubs: string[];
  onDateChange: (date: string) => void;
  onHubsChange: (hubs: string[]) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function FilterBar({
  allHubs,
  missingHubs = [],
  selectedDate,
  selectedHubs,
  onDateChange,
  onHubsChange,
  onRefresh,
  isLoading,
}: FilterBarProps) {
  const [hubDropdownOpen, setHubDropdownOpen] = useState(false);

  const today = todayWIB();

  const toggleHub = (hub: string) => {
    if (selectedHubs.includes(hub)) {
      onHubsChange(selectedHubs.filter((h) => h !== hub));
    } else {
      onHubsChange([...selectedHubs, hub]);
    }
  };

  const clearFilters = () => {
    onDateChange(today);
    onHubsChange([]);
  };

  const hasActiveFilters =
    selectedDate !== today || selectedHubs.length > 0;

  return (
    <div className="relative z-30 bg-white rounded-xl border border-slate-300/75 dark:border-slate-700/80 border-l-4 border-l-[#0f4c5c] dark:border-l-cyan-500 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Picker */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="text-sm text-gray-700 bg-transparent outline-none cursor-pointer"
          />
        </div>

        {/* Hub Filter */}
        <div className="relative">
          <button
            onClick={() => setHubDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Filter className="h-4 w-4 text-gray-400" />
            {selectedHubs.length > 0 ? (
              <span>
                {selectedHubs.length} hub dipilih
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 bg-red-600 text-white text-xs rounded-full">
                  {selectedHubs.length}
                </span>
              </span>
            ) : (
              <span>Semua Hub</span>
            )}
          </button>

          {hubDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setHubDropdownOpen(false)}
              />
              <div className="animate-dropdown absolute top-full mt-1.5 left-0 bg-white rounded-xl border border-gray-200 shadow-2xl z-50 w-60 max-h-72 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                  <span className="text-xs font-semibold text-gray-500 uppercase">
                    Filter Hub
                  </span>
                  <button
                    onClick={() => onHubsChange([])}
                    className="text-xs text-blue-600 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                {allHubs.map((hub) => (
                  <label
                    key={hub}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedHubs.includes(hub)}
                      onChange={() => toggleHub(hub)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{hub}</span>
                  </label>
                ))}
                <div className="px-3 py-2 border-t border-gray-100 sticky bottom-0 bg-white z-10">
                  <button
                    onClick={() => setHubDropdownOpen(false)}
                    className="w-full text-center text-xs font-medium text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Clear Filter */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Reset Filter
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Copy daftar hub yang belum closing (untuk reminder WhatsApp) */}
          {missingHubs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const text =
                  `📋 *Reminder Closing SPX JTT08 (${formatDate(selectedDate)})*\n` +
                  `Hub belum submit (${missingHubs.length}):\n` +
                  missingHubs.map((h, i) => `${i + 1}. ${h}`).join("\n");
                navigator.clipboard.writeText(text).then(() => {
                  toast.success(`Daftar ${missingHubs.length} hub belum closing disalin ke clipboard!`);
                });
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Belum Closing ({missingHubs.length})
            </Button>
          )}

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            loading={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
