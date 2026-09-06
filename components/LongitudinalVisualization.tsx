'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  processInteractionsToDataPoints,
  generateSampleLongitudinalArc,
  aggregateThemeFrequencies,
  THEME_PALETTE,
  RawInteractionRecord,
} from '@/lib/analytics';
import { EmotionalDataPoint } from '@/lib/types';
import {
  Activity,
  TrendingUp,
  Calendar,
  Filter,
  Sparkles,
  Info,
  Layers,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

interface LongitudinalVisualizationProps {
  interactions: RawInteractionRecord[];
  onSelectInteraction?: (id: string) => void;
  onBackToJournal?: () => void;
}

const emptySubscribe = () => () => {};

export const LongitudinalVisualization: React.FC<LongitudinalVisualizationProps> = ({
  interactions,
  onSelectInteraction,
  onBackToJournal,
}) => {
  const isMounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [daysWindow, setDaysWindow] = useState<number>(30);
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Count real points in window
  const realPointsCount = useMemo(() => {
    return processInteractionsToDataPoints(interactions, daysWindow).length;
  }, [interactions, daysWindow]);

  // Pure declarative state without cascading effects
  const [userToggledSampleMode, setUserToggledSampleMode] = useState<boolean | null>(null);
  const useSampleData = userToggledSampleMode !== null ? userToggledSampleMode : realPointsCount < 3;

  // Compute active dataset
  const activeDataset: EmotionalDataPoint[] = useMemo(() => {
    if (useSampleData || realPointsCount === 0) {
      return generateSampleLongitudinalArc(daysWindow);
    }
    return processInteractionsToDataPoints(interactions, daysWindow);
  }, [useSampleData, realPointsCount, interactions, daysWindow]);

  // Filtered dataset based on selected theme
  const filteredDataset = useMemo(() => {
    if (!selectedThemeFilter) return activeDataset;
    return activeDataset.filter((pt) => pt.themes.includes(selectedThemeFilter));
  }, [activeDataset, selectedThemeFilter]);

  // Aggregated recurring themes stats
  const themeFrequencies = useMemo(() => {
    return aggregateThemeFrequencies(activeDataset);
  }, [activeDataset]);

  // Metrics summary
  const metrics = useMemo(() => {
    if (activeDataset.length === 0) {
      return {
        avgTone: 0,
        avgResilience: 50,
        topTheme: 'None',
        trajectory: 'Neutral',
      };
    }

    const totalTone = activeDataset.reduce((sum, pt) => sum + pt.toneScore, 0);
    const avgTone = Number((totalTone / activeDataset.length).toFixed(1));

    const totalResilience = activeDataset.reduce((sum, pt) => sum + pt.resilienceScore, 0);
    const avgResilience = Math.round(totalResilience / activeDataset.length);

    const topTheme = themeFrequencies[0]?.theme || 'General Reflection';

    // Compute trajectory slope between first third and last third
    const thirdLen = Math.max(1, Math.floor(activeDataset.length / 3));
    const firstAvg = activeDataset.slice(0, thirdLen).reduce((s, p) => s + p.toneScore, 0) / thirdLen;
    const lastAvg = activeDataset.slice(-thirdLen).reduce((s, p) => s + p.toneScore, 0) / thirdLen;
    const diff = lastAvg - firstAvg;

    let trajectory = 'Stable Equilibrium';
    if (diff > 1.5) trajectory = 'Ascending Growth Arc';
    else if (diff < -1.5) trajectory = 'Cyclical Deepening';

    return { avgTone, avgResilience, topTheme, trajectory };
  }, [activeDataset, themeFrequencies]);

  const activeSelectedPoint = useMemo(() => {
    if (!selectedPointId) return activeDataset[activeDataset.length - 1] || null;
    return activeDataset.find((p) => p.id === selectedPointId) || activeDataset[activeDataset.length - 1] || null;
  }, [selectedPointId, activeDataset]);

  if (!isMounted) {
    return (
      <div id="longitudinal-loading-skeleton" className="p-8 space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-stone-200 rounded-lg" />
        <div className="h-64 w-full bg-stone-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div id="longitudinal-analytics-container" className="flex-1 flex flex-col bg-stone-50 overflow-y-auto">
      {/* Header Bar */}
      <div id="analytics-header" className="p-5 sm:p-6 bg-white border-b border-stone-200 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center shadow-xs">
                <Activity className="w-4 h-4" />
              </div>
              <h1 id="analytics-title" className="text-xl sm:text-2xl font-serif font-semibold text-stone-900">
                Longitudinal Emotional Dynamics
              </h1>
            </div>
            <p className="text-xs text-stone-500">
              Mapping psychological valence, emotional tone shifts, and recurring thematic loops across time.
            </p>
          </div>

          {/* Controls: Time Window & Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Days Window Selector */}
            <div id="window-selector-group" className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  id={`btn-window-${days}d`}
                  onClick={() => setDaysWindow(days)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    daysWindow === days
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>

            {/* Real vs Demo Toggle */}
            <button
              id="btn-toggle-sample-data"
              onClick={() => setUserToggledSampleMode(!useSampleData)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                useSampleData
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
              title="Toggle between live reflections and demo 30-day psychological trajectory"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>{useSampleData ? 'Demo Arc Active' : 'Live User Reflections'}</span>
            </button>

            {onBackToJournal && (
              <button
                id="btn-back-to-journal"
                onClick={onBackToJournal}
                className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
              >
                <span>Write Reflection</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {/* Notice for sample dataset */}
        {useSampleData && (
          <div
            id="demo-data-banner"
            className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-center justify-between"
          >
            <div className="flex items-center space-x-2.5">
              <Info className="w-4 h-4 text-amber-800 shrink-0" />
              <span>
                <strong>Sample Arc Preview:</strong> You have {realPointsCount} reflection(s) in this {daysWindow}-day window.
                Displaying a synthesized longitudinal progression so you can explore patterns.
              </span>
            </div>
            {realPointsCount > 0 && (
              <button
                id="btn-switch-to-real-data"
                onClick={() => setUserToggledSampleMode(false)}
                className="underline font-semibold ml-2 hover:text-amber-950 cursor-pointer"
              >
                View my {realPointsCount} entries
              </button>
            )}
          </div>
        )}

        {/* 4 Summary Metric Cards */}
        <div id="metrics-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div id="metric-avg-tone" className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Average Valence</span>
            <div className="flex items-baseline space-x-2">
              <span className={`text-2xl font-serif font-bold ${metrics.avgTone >= 0 ? 'text-stone-900' : 'text-amber-800'}`}>
                {metrics.avgTone > 0 ? `+${metrics.avgTone}` : metrics.avgTone}
              </span>
              <span className="text-[11px] text-stone-500">(-10 to +10)</span>
            </div>
            <p className="text-[11px] text-stone-600 truncate">
              {metrics.avgTone > 3 ? 'Grounded Clarity' : metrics.avgTone >= 0 ? 'Reflective Equilibrium' : 'Tension & Hesitation'}
            </p>
          </div>

          <div id="metric-resilience-index" className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Resilience Index</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-serif font-bold text-stone-900">
                {metrics.avgResilience}%
              </span>
              <span className="text-[11px] text-stone-500">capacity</span>
            </div>
            <p className="text-[11px] text-stone-600 truncate">
              Adaptive cognitive reframing
            </p>
          </div>

          <div id="metric-top-theme" className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Top Dilemma / Theme</span>
            <div className="text-base font-semibold text-stone-900 truncate">
              {metrics.topTheme}
            </div>
            <p className="text-[11px] text-stone-600 truncate">
              Most recurring psychological thread
            </p>
          </div>

          <div id="metric-longitudinal-arc" className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Temporal Trajectory</span>
            <div className="flex items-center space-x-1.5 text-stone-900 font-semibold text-sm truncate">
              <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="truncate">{metrics.trajectory}</span>
            </div>
            <p className="text-[11px] text-stone-600 truncate">
              Across {activeDataset.length} reflections
            </p>
          </div>
        </div>

        {/* Primary Chart Card: 30-Day Longitudinal Emotional Tone Trajectory */}
        <div id="chart-card-trajectory" className="p-5 sm:p-6 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-stone-700" />
                <h2 id="trajectory-chart-heading" className="text-base font-serif font-semibold text-stone-900">
                  Emotional Tone Trajectory over {daysWindow} Days
                </h2>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Valence mapped from deep tension (-10) to empowered clarity (+10). Hover or tap points to inspect entries.
              </p>
            </div>

            {/* Quick legend badges */}
            <div className="flex items-center space-x-2 text-[11px]">
              <span className="inline-flex items-center space-x-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
                <span>Clarity (&gt;+3)</span>
              </span>
              <span className="inline-flex items-center space-x-1 text-stone-700 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                <span>Equilibrium (0 to +3)</span>
              </span>
              <span className="inline-flex items-center space-x-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-700" />
                <span>Hesitation (&lt;0)</span>
              </span>
            </div>
          </div>

          {/* Recharts Area Container */}
          <div id="recharts-area-wrapper" className="h-[320px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filteredDataset}
                margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                onClick={(e: unknown) => {
                  const evt = e as { activePayload?: Array<{ payload?: unknown }> } | null;
                  if (evt && evt.activePayload && evt.activePayload.length > 0 && evt.activePayload[0].payload) {
                    const point = evt.activePayload[0].payload as EmotionalDataPoint;
                    setSelectedPointId(point.id);
                  }
                }}
              >
                <defs>
                  <linearGradient id="toneGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#292524" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#292524" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  axisLine={{ stroke: '#e7e5e4' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[-10, 10]}
                  ticks={[-10, -5, 0, 5, 10]}
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  axisLine={{ stroke: '#e7e5e4' }}
                  tickLine={false}
                />
                {/* Equilibrium Baseline Reference Line */}
                <ReferenceLine
                  y={0}
                  stroke="#a8a29e"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Equilibrium (0)',
                    position: 'insideTopLeft',
                    fill: '#78716c',
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload as EmotionalDataPoint;
                      return (
                        <div
                          id="chart-custom-tooltip"
                          className="p-3 bg-stone-900 text-stone-100 rounded-xl shadow-lg border border-stone-800 text-xs max-w-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between border-b border-stone-700/60 pb-1">
                            <span className="font-semibold text-stone-200">{data.displayDate}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                data.toneScore >= 4
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : data.toneScore >= 0
                                  ? 'bg-stone-800 text-stone-300'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              Tone: {data.toneScore > 0 ? `+${data.toneScore}` : data.toneScore}
                            </span>
                          </div>
                          <p className="font-medium text-stone-100 line-clamp-1">{data.title}</p>
                          <p className="text-[11px] text-stone-400 italic line-clamp-2">&ldquo;{data.excerpt}&rdquo;</p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {data.themes.map((theme) => (
                              <span
                                key={theme}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-stone-800 text-stone-300"
                              >
                                {theme}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="toneScore"
                  stroke="#292524"
                  strokeWidth={2.5}
                  fill="url(#toneGradient)"
                  dot={{ r: 4, fill: '#292524', stroke: '#fafaf9', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: '#b45309', stroke: '#fafaf9', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Secondary Section: Recurring Themes Breakdown & Point Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recurring Themes Frequency Bar Chart */}
          <div
            id="chart-card-themes"
            className="lg:col-span-7 p-5 sm:p-6 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-stone-700" />
                  <h3 id="themes-chart-heading" className="text-base font-serif font-semibold text-stone-900">
                    Recurring Cognitive & Emotional Themes
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Frequency of cyclical topics identified across entries. Click a bar or chip to filter.
                </p>
              </div>

              {selectedThemeFilter && (
                <button
                  id="btn-clear-theme-filter"
                  onClick={() => setSelectedThemeFilter(null)}
                  className="text-xs text-stone-600 hover:text-stone-900 underline cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </div>

            {/* Filter Chips Bar */}
            <div id="theme-filter-chips" className="flex flex-wrap gap-1.5">
              {themeFrequencies.map((tf) => {
                const isSelected = selectedThemeFilter === tf.theme;
                return (
                  <button
                    key={tf.theme}
                    id={`filter-chip-${tf.theme.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                    onClick={() => setSelectedThemeFilter(isSelected ? null : tf.theme)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: tf.color }}
                    />
                    <span className="truncate">{tf.theme}</span>
                    <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-stone-700' : 'bg-stone-200'}`}>
                      {tf.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Recharts Bar Container */}
            <div id="recharts-bar-wrapper" className="h-[240px] w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={themeFrequencies}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                  onClick={(e: unknown) => {
                    const evt = e as { activePayload?: Array<{ payload?: unknown }> } | null;
                    if (evt && evt.activePayload && evt.activePayload.length > 0 && evt.activePayload[0].payload) {
                      const item = evt.activePayload[0].payload as { theme: string };
                      setSelectedThemeFilter(selectedThemeFilter === item.theme ? null : item.theme);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis
                    type="category"
                    dataKey="theme"
                    width={140}
                    tick={{ fontSize: 11, fill: '#44403c' }}
                    axisLine={{ stroke: '#e7e5e4' }}
                  />
                  <Tooltip
                    formatter={(val) => [`${val ?? 0} occurrence(s)`, 'Frequency']}
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      borderColor: '#292524',
                      borderRadius: '0.75rem',
                      color: '#fafaf9',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {themeFrequencies.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={selectedThemeFilter === entry.theme ? '#1c1917' : entry.color || '#78716c'}
                        opacity={selectedThemeFilter && selectedThemeFilter !== entry.theme ? 0.35 : 1}
                        cursor="pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interactive Selected Entry Inspector Card */}
          <div
            id="entry-inspector-card"
            className="lg:col-span-5 p-5 sm:p-6 bg-white rounded-2xl border border-stone-200 shadow-2xs flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  Selected Timeline Anchor
                </span>
                <span className="text-xs text-stone-500 font-mono">
                  {activeSelectedPoint?.displayDate || 'Latest'}
                </span>
              </div>

              {activeSelectedPoint ? (
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 id="inspector-entry-title" className="text-base font-serif font-semibold text-stone-900 leading-snug">
                      {activeSelectedPoint.title}
                    </h4>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${
                        activeSelectedPoint.toneScore >= 4
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : activeSelectedPoint.toneScore >= 0
                          ? 'bg-stone-100 text-stone-800 border border-stone-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {activeSelectedPoint.toneLabel}
                    </span>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs text-stone-700 leading-relaxed italic">
                    &ldquo;{activeSelectedPoint.excerpt}&rdquo;
                  </div>

                  {/* Themes present */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-stone-500 font-medium">Mapped Cognitive Themes:</span>
                    <div className="flex flex-wrap gap-1">
                      {activeSelectedPoint.themes.map((th) => (
                        <span
                          key={th}
                          className="px-2 py-0.5 rounded-md text-[11px] bg-stone-100 text-stone-700 border border-stone-200/80 font-medium"
                        >
                          {th}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-stone-500">
                  Select any point on the trajectory curve to inspect details.
                </div>
              )}
            </div>

            {/* Action link to open reflection in journal if it's a real entry */}
            {activeSelectedPoint && !useSampleData && onSelectInteraction && (
              <button
                id="btn-inspect-open-reflection"
                onClick={() => onSelectInteraction(activeSelectedPoint.id)}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <span>Open Full Reflection in Journal</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Chronological List of Entries in Window */}
        <div id="chronological-entries-panel" className="p-5 sm:p-6 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 id="entries-list-heading" className="text-base font-serif font-semibold text-stone-900">
                Timeline Reflections in this {daysWindow}-Day Window ({filteredDataset.length})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Click any record to inspect its position along the longitudinal emotional trajectory.
              </p>
            </div>
          </div>

          <div id="timeline-cards-list" className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {filteredDataset.map((pt) => {
              const isSelected = activeSelectedPoint?.id === pt.id;
              return (
                <div
                  key={pt.id}
                  id={`timeline-card-${pt.id}`}
                  onClick={() => setSelectedPointId(pt.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-stone-100/90 border-stone-400 shadow-xs'
                      : 'bg-white hover:bg-stone-50 border-stone-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-stone-900 text-xs truncate">{pt.title}</span>
                    <span className="text-[10px] text-stone-500 font-mono shrink-0">{pt.displayDate}</span>
                  </div>

                  <p className="text-xs text-stone-600 line-clamp-2">&ldquo;{pt.excerpt}&rdquo;</p>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-stone-500">
                      Valence:{' '}
                      <strong className={pt.toneScore >= 0 ? 'text-stone-900' : 'text-amber-800'}>
                        {pt.toneScore > 0 ? `+${pt.toneScore}` : pt.toneScore}
                      </strong>
                    </span>
                    <span className="text-[10px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                      {pt.toneLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
