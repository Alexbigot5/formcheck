import apiClient from './apiClient';

// Types for analytics functionality
export interface AnalyticsSummary {
  totalLeads: number;
  newLeads: number;
  averageScore: number;
  conversionRate: number;
  meetingConversions: number;
  meetingConversionRate: number;
}

export interface LeadsBySource {
  source: string;
  count: number;
  percentage: number;
}

export interface LeadsByDay {
  date: string;
  count: number;
  cumulative: number;
}

export interface SLAMetrics {
  hitRate: number;
  averageResponseTime: number;
  totalSlaClocks: number;
  satisfiedCount: number;
  escalatedCount: number;
}

export interface ResponseTimeDistribution {
  bucket: string;
  count: number;
  percentage: number;
}

export interface ScoreDistribution {
  band: 'LOW' | 'MEDIUM' | 'HIGH';
  count: number;
  percentage: number;
}

export interface TopSource {
  source: string;
  count: number;
  averageScore: number;
  conversionRate: number;
}

export interface OwnerPerformance {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  assignedLeads: number;
  averageResponseTime: number;
  slaHitRate: number;
}

export interface AnalyticsOverview {
  success: boolean;
  data: {
    summary: AnalyticsSummary;
    sourceBreakdown: LeadsBySource[];
    leadsPerDay: LeadsByDay[];
    slaMetrics: SLAMetrics;
    responseTimeDistribution: ResponseTimeDistribution[];
    scoreDistribution: ScoreDistribution[];
    topSources: TopSource[];
    ownerPerformance: OwnerPerformance[];
  };
}

// Analytics API functions
export const analyticsApi = {
  // GET /analytics/overview - Get comprehensive analytics data
  async getOverview(days: number = 30, timezone: string = 'UTC'): Promise<AnalyticsOverview> {
    const response = await apiClient.get('/analytics/overview', {
      params: { days, timezone }
    });
    return response.data;
  }
};

// CSV Export utilities
export const csvExport = {
  // Convert array of objects to CSV
  arrayToCSV(data: any[], filename: string): void {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle values that might contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ].join('\n');

    // Create and download blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  },

  // Export leads by source data
  exportLeadsBySource(data: LeadsBySource[]): void {
    const exportData = data.map(item => ({
      'Source': item.source,
      'Count': item.count,
      'Percentage': `${item.percentage.toFixed(1)}%`
    }));
    
    this.arrayToCSV(exportData, `leads-by-source-${new Date().toISOString().split('T')[0]}.csv`);
  },

  // Export leads by day data
  exportLeadsByDay(data: LeadsByDay[]): void {
    const exportData = data.map(item => ({
      'Date': item.date,
      'New Leads': item.count,
      'Cumulative': item.cumulative
    }));
    
    this.arrayToCSV(exportData, `leads-by-day-${new Date().toISOString().split('T')[0]}.csv`);
  },

  // Export SLA metrics
  exportSLAMetrics(data: SLAMetrics): void {
    const exportData = [{
      'Metric': 'Hit Rate',
      'Value': `${data.hitRate.toFixed(1)}%`
    }, {
      'Metric': 'Average Response Time (minutes)',
      'Value': data.averageResponseTime.toFixed(1)
    }, {
      'Metric': 'Total SLA Clocks',
      'Value': data.totalSlaClocks
    }, {
      'Metric': 'Satisfied Count',
      'Value': data.satisfiedCount
    }, {
      'Metric': 'Escalated Count',
      'Value': data.escalatedCount
    }];
    
    this.arrayToCSV(exportData, `sla-metrics-${new Date().toISOString().split('T')[0]}.csv`);
  },

  // Export response time distribution
  exportResponseTimeDistribution(data: ResponseTimeDistribution[]): void {
    const exportData = data.map(item => ({
      'Time Bucket': item.bucket,
      'Count': item.count,
      'Percentage': `${item.percentage.toFixed(1)}%`
    }));
    
    this.arrayToCSV(exportData, `response-time-distribution-${new Date().toISOString().split('T')[0]}.csv`);
  },

  // Export score distribution
  exportScoreDistribution(data: ScoreDistribution[]): void {
    const exportData = data.map(item => ({
      'Score Band': item.band,
      'Count': item.count,
      'Percentage': `${item.percentage.toFixed(1)}%`
    }));
    
    this.arrayToCSV(exportData, `score-distribution-${new Date().toISOString().split('T')[0]}.csv`);
  },

  // Export top sources
  exportTopSources(data: TopSource[]): void {
    const exportData = data.map(item => ({
      'Source': item.source,
      'Count': item.count,
      'Average Score': item.averageScore.toFixed(1),
      'Conversion Rate': `${item.conversionRate.toFixed(1)}%`
    }));
    
    this.arrayToCSV(exportData, `top-sources-${new Date().toISOString().split('T')[0]}.csv`);
  },

  // Export owner performance
  exportOwnerPerformance(data: OwnerPerformance[]): void {
    const exportData = data.map(item => ({
      'Owner': item.ownerName,
      'Email': item.ownerEmail,
      'Assigned Leads': item.assignedLeads,
      'Avg Response Time (min)': item.averageResponseTime.toFixed(1),
      'SLA Hit Rate': `${item.slaHitRate.toFixed(1)}%`
    }));
    
    this.arrayToCSV(exportData, `owner-performance-${new Date().toISOString().split('T')[0]}.csv`);
  },

  // Export complete analytics overview
  exportCompleteOverview(data: AnalyticsOverview['data']): void {
    // Create a comprehensive export with multiple sheets worth of data
    const summaryData = [{
      'Metric': 'Total Leads',
      'Value': data.summary.totalLeads
    }, {
      'Metric': 'New Leads (Period)',
      'Value': data.summary.newLeads
    }, {
      'Metric': 'Average Score',
      'Value': data.summary.averageScore.toFixed(1)
    }, {
      'Metric': 'Conversion Rate',
      'Value': `${data.summary.conversionRate.toFixed(1)}%`
    }];

    this.arrayToCSV(summaryData, `analytics-summary-${new Date().toISOString().split('T')[0]}.csv`);
  }
};

// Chart helpers
export const chartHelpers = {
  // Get color for score bands
  getScoreBandColor(band: string): string {
    const colors = {
      'HIGH': '#10b981', // green
      'MEDIUM': '#f59e0b', // yellow
      'LOW': '#ef4444' // red
    };
    return colors[band as keyof typeof colors] || '#6b7280';
  },

  // Get color for SLA status
  getSLAStatusColor(hitRate: number): string {
    if (hitRate >= 90) return '#10b981'; // green
    if (hitRate >= 70) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  },

  // Format number with commas
  formatNumber(num: number): string {
    return new Intl.NumberFormat().format(num);
  },

  // Format percentage
  formatPercentage(num: number): string {
    return `${num.toFixed(1)}%`;
  },

  // Format time duration
  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  },

  // Generate chart colors for multiple series
  generateColors(count: number): string[] {
    const baseColors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // yellow
      '#ef4444', // red
      '#8b5cf6', // purple
      '#06b6d4', // cyan
      '#84cc16', // lime
      '#f97316', // orange
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  },

  // Prepare data for simple bar chart
  prepareBarChartData(data: Array<{label: string, value: number}>) {
    return {
      labels: data.map(item => item.label),
      datasets: [{
        data: data.map(item => item.value),
        backgroundColor: this.generateColors(data.length),
        borderWidth: 1,
        borderColor: '#e5e7eb'
      }]
    };
  },

  // Prepare data for line chart
  prepareLineChartData(data: Array<{label: string, value: number}>, label: string = 'Data') {
    return {
      labels: data.map(item => item.label),
      datasets: [{
        label,
        data: data.map(item => item.value),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    };
  },

  // Prepare data for pie chart
  preparePieChartData(data: Array<{label: string, value: number}>) {
    return {
      labels: data.map(item => item.label),
      datasets: [{
        data: data.map(item => item.value),
        backgroundColor: this.generateColors(data.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };
  }
};
