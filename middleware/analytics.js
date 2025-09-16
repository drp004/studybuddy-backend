const fs = require('fs').promises;
const path = require('path');

// File-based storage for analytics (can be replaced with database)
const ANALYTICS_FILE = path.join(__dirname, '../data/analytics.json');

// Initialize analytics data structure
let analyticsData = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  requestsByEndpoint: {},
  requestsByMethod: {
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
    PATCH: 0
  },
  requestsByType: {
    text: 0,
    audio: 0,
    video: 0,
    image: 0,
    ppt: 0,
    notes: 0
  },
  responseTimeStats: {
    total: 0,
    count: 0,
    average: 0,
    min: Infinity,
    max: 0
  },
  prints: {
    notes: 0,
    ppt: 0,
    audio: 0,
    video: 0,
    image: 0,
    total: 0
  },
  dailyStats: {},
  hourlyStats: {},
  userAgents: {},
  ipAddresses: {},
  errorsByType: {},
  popularFeatures: {},
  sessionData: {},
  performanceMetrics: {
    slowestEndpoints: {},
    fastestEndpoints: {},
    errorRates: {}
  },
  lastUpdated: new Date().toISOString(),
  systemInfo: {
    startTime: new Date().toISOString(),
    uptime: 0
  }
};

// Load existing analytics data on startup
async function loadAnalyticsData() {
  try {
    const data = await fs.readFile(ANALYTICS_FILE, 'utf8');
    const loadedData = JSON.parse(data);
    
    // Merge with default structure to ensure all properties exist
    analyticsData = { ...analyticsData, ...loadedData };
    
    // Convert uniqueUsers arrays back to Sets for each daily stat
    if (analyticsData.dailyStats) {
      Object.keys(analyticsData.dailyStats).forEach(date => {
        if (analyticsData.dailyStats[date].uniqueUsers && Array.isArray(analyticsData.dailyStats[date].uniqueUsers)) {
          analyticsData.dailyStats[date].uniqueUsers = new Set(analyticsData.dailyStats[date].uniqueUsers);
        }
      });
    }
    
    console.log('📊 Analytics data loaded successfully');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📊 Creating new analytics data file');
      await saveAnalyticsData();
    } else {
      console.error('Error loading analytics data:', error);
    }
  }
}

// Save analytics data
const saveAnalyticsData = async () => {
  try {
    // Convert Sets to Arrays for JSON serialization
    const dataToSave = JSON.parse(JSON.stringify(analyticsData, (key, value) => {
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }));
    
    await fs.writeFile(ANALYTICS_FILE, JSON.stringify(dataToSave, null, 2));
  } catch (error) {
    console.error('❌ Error saving analytics data:', error);
  }
};

// Get current date/time strings
const getDateStrings = () => {
  const now = new Date();
  return {
    today: now.toDateString(),
    hour: `${now.toDateString()}-${now.getHours()}:00`,
    timestamp: now.toISOString()
  };
};

// Track analytics event
const trackEvent = async (eventType, details = {}) => {
  const { today, hour, timestamp } = getDateStrings();
  
  analyticsData.totalRequests++;
  analyticsData.lastUpdated = timestamp;
  analyticsData.systemInfo.uptime = Date.now() - new Date(analyticsData.systemInfo.startTime).getTime();
  
  // Initialize daily stats
  if (!analyticsData.dailyStats[today]) {
    analyticsData.dailyStats[today] = {
      requests: 0,
      prints: 0,
      errors: 0,
      successRate: 0,
      avgResponseTime: 0,
      uniqueUsers: new Set(),
      topEndpoints: {}
    };
  }
  
  // Initialize hourly stats
  if (!analyticsData.hourlyStats[hour]) {
    analyticsData.hourlyStats[hour] = {
      requests: 0,
      errors: 0,
      avgResponseTime: 0
    };
  }
  
  const dailyStats = analyticsData.dailyStats[today];
  const hourlyStats = analyticsData.hourlyStats[hour];
  
  switch (eventType) {
    case 'request_start':
      dailyStats.requests++;
      hourlyStats.requests++;
      
      if (details.endpoint) {
        analyticsData.requestsByEndpoint[details.endpoint] = 
          (analyticsData.requestsByEndpoint[details.endpoint] || 0) + 1;
        
        dailyStats.topEndpoints[details.endpoint] = 
          (dailyStats.topEndpoints[details.endpoint] || 0) + 1;
      }
      
      if (details.method) {
        analyticsData.requestsByMethod[details.method] = 
          (analyticsData.requestsByMethod[details.method] || 0) + 1;
      }
      
      if (details.userAgent) {
        analyticsData.userAgents[details.userAgent] = 
          (analyticsData.userAgents[details.userAgent] || 0) + 1;
      }
      
      if (details.ip) {
        analyticsData.ipAddresses[details.ip] = 
          (analyticsData.ipAddresses[details.ip] || 0) + 1;
        
        // Ensure uniqueUsers is a Set
        if (!(dailyStats.uniqueUsers instanceof Set)) {
          dailyStats.uniqueUsers = new Set(Array.isArray(dailyStats.uniqueUsers) ? dailyStats.uniqueUsers : []);
        }
        dailyStats.uniqueUsers.add(details.ip);
      }
      break;
      
    case 'request_success':
      analyticsData.successfulRequests++;
      
      if (details.responseTime) {
        const responseTime = details.responseTime;
        analyticsData.responseTimeStats.total += responseTime;
        analyticsData.responseTimeStats.count++;
        analyticsData.responseTimeStats.average = 
          analyticsData.responseTimeStats.total / analyticsData.responseTimeStats.count;
        analyticsData.responseTimeStats.min = Math.min(analyticsData.responseTimeStats.min, responseTime);
        analyticsData.responseTimeStats.max = Math.max(analyticsData.responseTimeStats.max, responseTime);
        
        // Track endpoint performance
        if (details.endpoint) {
          if (!analyticsData.performanceMetrics.slowestEndpoints[details.endpoint]) {
            analyticsData.performanceMetrics.slowestEndpoints[details.endpoint] = {
              total: 0,
              count: 0,
              average: 0,
              max: 0
            };
          }
          const endpointStats = analyticsData.performanceMetrics.slowestEndpoints[details.endpoint];
          endpointStats.total += responseTime;
          endpointStats.count++;
          endpointStats.average = endpointStats.total / endpointStats.count;
          endpointStats.max = Math.max(endpointStats.max, responseTime);
        }
      }
      
      if (details.type) {
        analyticsData.requestsByType[details.type] = 
          (analyticsData.requestsByType[details.type] || 0) + 1;
        analyticsData.popularFeatures[details.type] = 
          (analyticsData.popularFeatures[details.type] || 0) + 1;
      }
      break;
      
    case 'request_error':
      analyticsData.failedRequests++;
      dailyStats.errors++;
      hourlyStats.errors++;
      
      if (details.errorType) {
        analyticsData.errorsByType[details.errorType] = 
          (analyticsData.errorsByType[details.errorType] || 0) + 1;
      }
      
      // Track error rates by endpoint
      if (details.endpoint) {
        if (!analyticsData.performanceMetrics.errorRates[details.endpoint]) {
          analyticsData.performanceMetrics.errorRates[details.endpoint] = {
            total: 0,
            errors: 0,
            rate: 0
          };
        }
        const errorStats = analyticsData.performanceMetrics.errorRates[details.endpoint];
        errorStats.errors++;
        errorStats.total++;
        errorStats.rate = (errorStats.errors / errorStats.total) * 100;
      }
      break;
      
    case 'print':
      analyticsData.prints.total++;
      dailyStats.prints++;
      
      if (details.type) {
        analyticsData.prints[details.type] = 
          (analyticsData.prints[details.type] || 0) + 1;
      }
      break;
  }
  
  // Calculate success rate
  if (analyticsData.totalRequests > 0) {
    dailyStats.successRate = 
      ((analyticsData.successfulRequests / analyticsData.totalRequests) * 100).toFixed(2);
  }
  
  // Convert Set to number for storage
  if (dailyStats.uniqueUsers instanceof Set) {
    dailyStats.uniqueUsers = dailyStats.uniqueUsers.size;
  }
  
  // Save data periodically (every 10 requests)
  if (analyticsData.totalRequests % 10 === 0) {
    await saveAnalyticsData();
  }
};

// Analytics middleware
const analyticsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Track request start
  trackEvent('request_start', {
    endpoint: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });
  
  // Override res.json to track response
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    
    if (res.statusCode >= 200 && res.statusCode < 400) {
      trackEvent('request_success', {
        endpoint: req.path,
        responseTime,
        type: req.body?.type || req.query?.type
      });
    } else {
      trackEvent('request_error', {
        endpoint: req.path,
        errorType: `HTTP_${res.statusCode}`,
        responseTime
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Get analytics data
const getAnalyticsData = () => {
  return analyticsData;
};

// Get dashboard insights
const getDashboardInsights = () => {
  const now = new Date();
  const last7Days = [];
  const last24Hours = [];
  
  // Generate last 7 days data
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toDateString();
    last7Days.push({
      date: dateStr,
      requests: analyticsData.dailyStats[dateStr]?.requests || 0,
      errors: analyticsData.dailyStats[dateStr]?.errors || 0,
      prints: analyticsData.dailyStats[dateStr]?.prints || 0
    });
  }
  
  // Generate last 24 hours data
  for (let i = 23; i >= 0; i--) {
    const date = new Date(now);
    date.setHours(date.getHours() - i);
    const hourStr = `${date.toDateString()}-${date.getHours()}:00`;
    last24Hours.push({
      hour: date.getHours(),
      requests: analyticsData.hourlyStats[hourStr]?.requests || 0,
      errors: analyticsData.hourlyStats[hourStr]?.errors || 0
    });
  }
  
  // Calculate top endpoints
  const topEndpoints = Object.entries(analyticsData.requestsByEndpoint)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([endpoint, count]) => ({ endpoint, count }));
  
  // Calculate slowest endpoints
  const slowestEndpoints = Object.entries(analyticsData.performanceMetrics.slowestEndpoints)
    .sort(([,a], [,b]) => b.average - a.average)
    .slice(0, 5)
    .map(([endpoint, stats]) => ({ endpoint, averageTime: Math.round(stats.average) }));
  
  return {
    overview: {
      totalRequests: analyticsData.totalRequests,
      successfulRequests: analyticsData.successfulRequests,
      failedRequests: analyticsData.failedRequests,
      successRate: analyticsData.totalRequests > 0 ? 
        ((analyticsData.successfulRequests / analyticsData.totalRequests) * 100).toFixed(2) : 0,
      averageResponseTime: Math.round(analyticsData.responseTimeStats.average || 0),
      totalPrints: analyticsData.prints.total,
      uptime: analyticsData.systemInfo.uptime
    },
    charts: {
      last7Days,
      last24Hours,
      requestsByType: Object.entries(analyticsData.requestsByType)
        .map(([type, count]) => ({ type, count })),
      requestsByMethod: Object.entries(analyticsData.requestsByMethod)
        .map(([method, count]) => ({ method, count })),
      printsByType: Object.entries(analyticsData.prints)
        .filter(([key]) => key !== 'total')
        .map(([type, count]) => ({ type, count })),
      errorsByType: Object.entries(analyticsData.errorsByType)
        .map(([type, count]) => ({ type, count }))
    },
    insights: {
      topEndpoints,
      slowestEndpoints,
      topUserAgents: Object.entries(analyticsData.userAgents)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([agent, count]) => ({ agent: agent.substring(0, 50) + '...', count })),
      popularFeatures: Object.entries(analyticsData.popularFeatures)
        .sort(([,a], [,b]) => b - a)
        .map(([feature, count]) => ({ feature, count }))
    }
  };
};

// Initialize analytics on module load
loadAnalyticsData();

module.exports = {
  analyticsMiddleware,
  trackEvent,
  getAnalyticsData,
  getDashboardInsights,
  saveAnalyticsData
};
