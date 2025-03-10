'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Define custom simplified Select components since imports are failing
const SelectTrigger = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`border rounded p-2 cursor-pointer flex justify-between items-center ${className}`}>
        {children}
        <span>▼</span>
    </div>
);

const SelectValue = ({ placeholder }: { placeholder: string }) => (
    <span className="text-muted-foreground">{placeholder}</span>
);

const SelectContent = ({ children }: { children: React.ReactNode }) => (
    <div className="absolute mt-1 w-full bg-background border rounded-md shadow-lg z-10 max-h-60 overflow-auto">
        {children}
    </div>
);

const SelectItem = ({ value, children, onClick }: { value: string, children: React.ReactNode, onClick?: () => void }) => (
    <div
        className="px-3 py-2 hover:bg-muted cursor-pointer"
        onClick={onClick}
        data-value={value}
    >
        {children}
    </div>
);

const Select = ({
    value,
    onValueChange,
    children
}: {
    value: string,
    onValueChange: (value: string) => void,
    children: React.ReactNode
}) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const item = target.closest('[data-value]');
        if (item) {
            const value = (item as HTMLElement).dataset.value || '';
            onValueChange(value);
            setOpen(false);
        }
    };

    return (
        <div className="relative">
            <div onClick={() => setOpen(!open)}>
                {Array.isArray(children) && children[0]}
            </div>
            {open && (
                <div onClick={handleSelect}>
                    {Array.isArray(children) && children[1]}
                </div>
            )}
        </div>
    );
};

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
    timestamp: number;
    message: string;
    level: LogLevel;
    source: string;
    data?: any;
}

export default function DebugPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
    const [sources, setSources] = useState<string[]>([]);
    const [logStats, setLogStats] = useState({ total: 0, filtered: 0 });
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [filter, setFilter] = useState({
        source: '',
        level: '',
        search: '',
    });

    const fetchLogs = async () => {
        try {
            // Build query string based on filters
            let url = '/api/debug-log?limit=1000';

            if (filter.source) {
                url += `&source=${encodeURIComponent(filter.source)}`;
            }

            if (filter.level) {
                url += `&level=${encodeURIComponent(filter.level)}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch logs');
            }

            const data = await response.json();
            setLogs(data.logs);
            setLogStats({
                total: data.totalLogs,
                filtered: data.filteredCount,
            });

            // Extract unique sources for the filter dropdown
            const uniqueSources = [...new Set(data.logs.map((log: LogEntry) => log.source))].filter(
                (source): source is string => typeof source === 'string'
            );
            setSources(uniqueSources.sort());

            applySearchFilter(data.logs);
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    // Apply text search filter
    const applySearchFilter = (logsToFilter: LogEntry[]) => {
        if (!filter.search.trim()) {
            setFilteredLogs(logsToFilter);
            return;
        }

        const searchLower = filter.search.toLowerCase();
        const filtered = logsToFilter.filter(log =>
            log.message.toLowerCase().includes(searchLower) ||
            log.source.toLowerCase().includes(searchLower) ||
            (log.data && JSON.stringify(log.data).toLowerCase().includes(searchLower))
        );

        setFilteredLogs(filtered);
    };

    // Handle search input changes
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const searchValue = e.target.value;
        setFilter(prev => ({ ...prev, search: searchValue }));
        applySearchFilter(logs);
    };

    // Clear all logs
    const clearLogs = async () => {
        try {
            await fetch('/api/debug-log', { method: 'DELETE' });
            fetchLogs();
        } catch (error) {
            console.error('Error clearing logs:', error);
        }
    };

    // Set up auto-refresh interval
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;

        if (autoRefresh) {
            interval = setInterval(fetchLogs, 5000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh, filter]);

    // Initial fetch
    useEffect(() => {
        fetchLogs();
    }, [filter.source, filter.level]);

    // Apply search filter when search term changes
    useEffect(() => {
        applySearchFilter(logs);
    }, [filter.search, logs]);

    // Format timestamp to readable date/time
    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    // Get color class based on log level
    const getLevelColor = (level: LogLevel) => {
        switch (level) {
            case 'error': return 'text-red-500';
            case 'warn': return 'text-yellow-500';
            case 'info': return 'text-blue-500';
            default: return 'text-gray-500';
        }
    };

    return (
        <div className="container mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold mb-6">Debug Logs</h1>

            {/* Filters and controls */}
            <div className="bg-background rounded-lg border p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
                    <div className="w-full md:w-1/4">
                        <label className="block text-sm font-medium mb-1">Source</label>
                        <Select
                            value={filter.source}
                            onValueChange={(value: string) => setFilter(prev => ({ ...prev, source: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All sources" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All sources</SelectItem>
                                {sources.map(source => (
                                    <SelectItem key={source} value={source}>{source}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full md:w-1/4">
                        <label className="block text-sm font-medium mb-1">Level</label>
                        <Select
                            value={filter.level}
                            onValueChange={(value: string) => setFilter(prev => ({ ...prev, level: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All levels" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All levels</SelectItem>
                                <SelectItem value="info">Info</SelectItem>
                                <SelectItem value="warn">Warning</SelectItem>
                                <SelectItem value="error">Error</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-full md:w-1/3">
                        <label className="block text-sm font-medium mb-1">Search</label>
                        <Input
                            type="text"
                            placeholder="Search in logs..."
                            value={filter.search}
                            onChange={handleSearchChange}
                        />
                    </div>

                    <div className="w-full md:w-1/4 flex gap-2">
                        <Button onClick={fetchLogs} variant="outline" className="flex-1">
                            Refresh
                        </Button>
                        <Button onClick={clearLogs} variant="destructive" className="flex-1">
                            Clear
                        </Button>
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                        Showing {filteredLogs.length} of {logStats.filtered} logs (total: {logStats.total})
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm">Auto-refresh:</label>
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="ml-1"
                        />
                    </div>
                </div>
            </div>

            {/* Logs display */}
            <div className="bg-background border rounded-lg">
                {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        No logs to display
                    </div>
                ) : (
                    <div className="overflow-auto max-h-[70vh]">
                        <table className="w-full">
                            <thead className="bg-muted sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Time</th>
                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Level</th>
                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Source</th>
                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log, index) => (
                                    <tr key={index} className="border-t">
                                        <td className="px-4 py-2 text-xs">{formatTimestamp(log.timestamp)}</td>
                                        <td className="px-4 py-2">
                                            <span className={`text-xs font-medium ${getLevelColor(log.level)}`}>
                                                {log.level.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2">
                                            <code className="text-xs bg-muted px-1 py-0.5 rounded">{log.source}</code>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="text-xs whitespace-pre-wrap break-words">{log.message}</div>
                                            {log.data && (
                                                <details className="mt-1">
                                                    <summary className="text-xs cursor-pointer text-muted-foreground">
                                                        Additional data
                                                    </summary>
                                                    <pre className="text-xs mt-1 p-2 bg-muted/50 rounded overflow-auto max-w-full">
                                                        {JSON.stringify(log.data, null, 2)}
                                                    </pre>
                                                </details>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
} 