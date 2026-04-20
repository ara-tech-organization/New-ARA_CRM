class AnalyticsService {
  // Calculate KPIs for a single metric record
  calculateKPIs(metric) {
    const { impressions, clicks, cost, conversions } = metric;

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? cost / clicks : 0;
    const cpa = conversions > 0 ? cost / conversions : 0;
    const conversion_rate = clicks > 0 ? (conversions / clicks) * 100 : 0;
    const roas = cost > 0 ? (conversions * 100) / cost : 0; // Assuming conversion value = 100 for now

    return {
      ctr: Math.round(ctr * 100) / 100,
      cpc: Math.round(cpc * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
      conversion_rate: Math.round(conversion_rate * 100) / 100,
      roas: Math.round(roas * 100) / 100
    };
  }

  // Calculate aggregated KPIs for multiple metrics
  calculateAggregatedKPIs(metrics) {
    if (!Array.isArray(metrics) || metrics.length === 0) {
      return {
        totalImpressions: 0,
        totalClicks: 0,
        totalCost: 0,
        totalConversions: 0,
        ctr: 0,
        cpc: 0,
        cpa: 0,
        roas: 0
      };
    }

    const totals = metrics.reduce((acc, metric) => {
      acc.impressions += metric.impressions || 0;
      acc.clicks += metric.clicks || 0;
      acc.cost += metric.cost || 0;
      acc.conversions += metric.conversions || 0;
      return acc;
    }, {
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0
    });

    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.cost / totals.clicks : 0;
    const cpa = totals.conversions > 0 ? totals.cost / totals.conversions : 0;
    const roas = totals.cost > 0 ? (totals.conversions * 100) / totals.cost : 0;

    return {
      totalImpressions: totals.impressions,
      totalClicks: totals.clicks,
      totalCost: totals.cost,
      totalConversions: totals.conversions,
      ctr: Math.round(ctr * 100) / 100,
      cpc: Math.round(cpc * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
      roas: Math.round(roas * 100) / 100
    };
  }

  // Calculate performance trends (vs previous period)
  calculateTrends(currentMetrics, previousMetrics) {
    const current = this.calculateAggregatedKPIs(currentMetrics);
    const previous = this.calculateAggregatedKPIs(previousMetrics);

    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      impressionsChange: Math.round(calculateChange(current.totalImpressions, previous.totalImpressions) * 100) / 100,
      clicksChange: Math.round(calculateChange(current.totalClicks, previous.totalClicks) * 100) / 100,
      costChange: Math.round(calculateChange(current.totalCost, previous.totalCost) * 100) / 100,
      conversionsChange: Math.round(calculateChange(current.totalConversions, previous.totalConversions) * 100) / 100,
      ctrChange: Math.round(calculateChange(current.ctr, previous.ctr) * 100) / 100,
      cpcChange: Math.round(calculateChange(current.cpc, previous.cpc) * 100) / 100,
      cpaChange: Math.round(calculateChange(current.cpa, previous.cpa) * 100) / 100,
      roasChange: Math.round(calculateChange(current.roas, previous.roas) * 100) / 100
    };
  }

  // Calculate client performance score (0-100)
  calculatePerformanceScore(kpis) {
    const { ctr, cpc, cpa, roas } = kpis;

    // Weights for different KPIs
    const weights = {
      ctr: 0.3,    // Click through rate
      cpc: 0.2,    // Cost per click (lower is better)
      cpa: 0.3,    // Cost per acquisition (lower is better)
      roas: 0.2    // Return on ad spend
    };

    // Benchmarks (industry averages)
    const benchmarks = {
      ctr: { good: 2.0, excellent: 3.0 },
      cpc: { good: 50, excellent: 30 }, // Lower is better
      cpa: { good: 500, excellent: 300 }, // Lower is better
      roas: { good: 200, excellent: 300 }
    };

    const scores = {
      ctr: Math.min(100, (ctr / benchmarks.ctr.excellent) * 100),
      cpc: Math.min(100, Math.max(0, ((benchmarks.cpc.good - cpc) / benchmarks.cpc.good) * 100)),
      cpa: Math.min(100, Math.max(0, ((benchmarks.cpa.good - cpa) / benchmarks.cpa.good) * 100)),
      roas: Math.min(100, (roas / benchmarks.roas.excellent) * 100)
    };

    const totalScore = (
      scores.ctr * weights.ctr +
      scores.cpc * weights.cpc +
      scores.cpa * weights.cpa +
      scores.roas * weights.roas
    );

    return Math.round(totalScore);
  }
}

const analyticsService = new AnalyticsService();

export default analyticsService;