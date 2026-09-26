import React, { useEffect, useState, useCallback } from 'react';
import {
  Phone,
  MessageSquare,
  Globe,
  ShieldAlert,
  Clock,
  MapPin,
  Search,
  RefreshCw,
  Sparkles,
  Building2,
  Scale,
  Stethoscope,
  Heart,
  Users,
} from 'lucide-react';
import type { SupportResource, ResourceCategory } from '../../types/domain.ts';

interface PublicResourcesViewProps {
  readonly onSelectCategory?: (category: ResourceCategory | 'all') => void;
}

const CATEGORY_MAP: Record<ResourceCategory | 'all', { label: string; icon: React.ElementType }> = {
  all: { label: 'All Services', icon: Sparkles },
  crisis_hotline: { label: 'Crisis Hotlines', icon: ShieldAlert },
  emergency_shelter: { label: 'Emergency Shelters', icon: Building2 },
  legal_aid: { label: 'Legal Aid & Protection', icon: Scale },
  medical_advocacy: { label: 'Medical Advocacy', icon: Stethoscope },
  counseling: { label: 'Counseling & Therapy', icon: Heart },
  community_support: { label: 'Community Support', icon: Users },
};

export const PublicResourcesView: React.FC<PublicResourcesViewProps> = ({ onSelectCategory }) => {
  const [resources, setResources] = useState<SupportResource[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = useCallback(async (cat: ResourceCategory | 'all') => {
    setIsLoading(true);
    setError(null);
    try {
      const url =
        cat === 'all'
          ? '/api/v1/resources'
          : `/api/v1/resources?category=${encodeURIComponent(cat)}`;
      const res = await fetch(url, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!res.ok) {
        throw new Error('Unable to load verified support resources at this time.');
      }

      const data = await res.json();
      setResources(Array.isArray(data.resources) ? data.resources : []);
    } catch {
      setError('A connection error occurred while loading verified support resources.');
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources(selectedCategory);
  }, [selectedCategory, fetchResources]);

  const handleCategoryChange = (cat: ResourceCategory | 'all') => {
    setSelectedCategory(cat);
    if (onSelectCategory) {
      onSelectCategory(cat);
    }
  };

  const filteredResources = resources.filter((resource) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      resource.name.toLowerCase().includes(q) ||
      resource.description.toLowerCase().includes(q) ||
      resource.generalCityRegion.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 text-slate-900">
      {/* View Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Verified Support Directory
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed max-w-2xl">
              24/7 confidential hotlines, emergency shelters, legal aid centers, and advocacy organizations. Every listed resource is vetted and verified for survivor safety.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full self-start sm:self-auto">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Active & Verified Services
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative pt-2">
          <Search className="absolute left-3.5 top-5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by service name, city, or keyword..."
            aria-label="Search resources"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {(Object.keys(CATEGORY_MAP) as (ResourceCategory | 'all')[]).map((catKey) => {
          const catInfo = CATEGORY_MAP[catKey];
          const Icon = catInfo.icon;
          const isActive = selectedCategory === catKey;

          return (
            <button
              key={catKey}
              type="button"
              onClick={() => handleCategoryChange(catKey)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>{catInfo.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 animate-pulse"
            >
              <div className="h-4 bg-slate-200 rounded-md w-2/3" />
              <div className="h-3 bg-slate-150 rounded-md w-full" />
              <div className="h-3 bg-slate-150 rounded-md w-4/5" />
              <div className="pt-2 flex gap-2">
                <div className="h-8 bg-slate-200 rounded-lg w-24" />
                <div className="h-8 bg-slate-200 rounded-lg w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3">
          <p className="text-sm font-medium text-rose-900">{error}</p>
          <button
            type="button"
            onClick={() => fetchResources(selectedCategory)}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 focus:outline-hidden"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry Connection
          </button>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
          <Building2 className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="text-base font-semibold text-slate-900">No Verified Resources Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            No active services matched your current category or search query. Try clearing search filters or choosing &quot;All Services&quot;.
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear Search Query
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResources.map((resource) => (
            <div
              key={resource.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                {/* Header badges & title */}
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900 leading-snug">
                    {resource.name}
                  </h2>
                  {resource.is24_7 && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      <Clock className="h-3 w-3" />
                      24/7
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {resource.description}
                </p>

                {/* Location & Languages */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {resource.generalCityRegion}
                  </span>
                  {resource.isPhysicalAddressConfidential && (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-xs font-medium text-[11px]">
                      Confidential Location
                    </span>
                  )}
                </div>

                {resource.languagesSupported && resource.languagesSupported.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {resource.languagesSupported.map((lang) => (
                      <span
                        key={lang}
                        className="rounded-xs bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 uppercase"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact Actions */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                {resource.contactPhone && (
                  <a
                    href={`tel:${resource.contactPhone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>Call {resource.contactPhone}</span>
                  </a>
                )}

                {resource.contactText && (
                  <a
                    href={`sms:${resource.contactText}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                    <span>Text {resource.contactText}</span>
                  </a>
                )}

                {resource.websiteUrl && (
                  <a
                    href={resource.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors ml-auto"
                  >
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                    <span>Website</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PublicResourcesView;
