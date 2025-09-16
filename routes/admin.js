const express = require('express');
const jwt = require('jsonwebtoken');
const { getDashboardInsights, trackEvent, getAnalyticsData } = require('../middleware/analytics');

const router = express.Router();

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'admin-secret-key-2024';

// Admin credentials (simplified for demo - in production, use proper hashing)
const ADMIN_USERS = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    role: 'super_admin',
    email: 'admin@notemate.com'
  },
  {
    id: 2,
    username: 'manager',
    password: 'manager123',
    role: 'manager',
    email: 'manager@notemate.com'
  }
];

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Admin login with simple authentication (fixed for demo)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }
    
    // Find admin user
    const admin = ADMIN_USERS.find(user => user.username === username);
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Simple password check (no bcrypt to avoid crashes)
    if (password !== admin.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username, 
        role: admin.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Track admin login
    await trackEvent('admin_login', {
      adminId: admin.id,
      username: admin.username,
      role: admin.role
    });
    
    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      data: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        email: admin.email
      }
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get comprehensive analytics dashboard data
router.get('/analytics', verifyAdminToken, async (req, res) => {
  try {
    const insights = getDashboardInsights();
    
    res.json({
      success: true,
      data: insights,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data'
    });
  }
});

// Get raw analytics data (for advanced users)
router.get('/analytics/raw', verifyAdminToken, (req, res) => {
  try {
    const rawData = getAnalyticsData();
    
    res.json({
      success: true,
      data: rawData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Raw analytics fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch raw analytics data'
    });
  }
});

// Get system health and performance metrics
router.get('/system/health', verifyAdminToken, (req, res) => {
  try {
    const analyticsData = getAnalyticsData();
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const healthData = {
      status: 'healthy',
      uptime: {
        seconds: Math.floor(uptime),
        formatted: formatUptime(uptime)
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      requests: {
        total: analyticsData.totalRequests,
        successful: analyticsData.successfulRequests,
        failed: analyticsData.failedRequests,
        successRate: analyticsData.totalRequests > 0 ? 
          ((analyticsData.successfulRequests / analyticsData.totalRequests) * 100).toFixed(2) : 0
      },
      performance: {
        averageResponseTime: Math.round(analyticsData.responseTimeStats.average || 0),
        minResponseTime: analyticsData.responseTimeStats.min === Infinity ? 0 : analyticsData.responseTimeStats.min,
        maxResponseTime: analyticsData.responseTimeStats.max
      }
    };
    
    res.json({
      success: true,
      data: healthData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('System health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system health data'
    });
  }
});

// Get user activity insights
router.get('/users/activity', verifyAdminToken, (req, res) => {
  try {
    const analyticsData = getAnalyticsData();
    const { timeframe = '7d' } = req.query;
    
    // Calculate unique users and activity patterns
    const uniqueIPs = Object.keys(analyticsData.ipAddresses).length;
    const totalSessions = Object.keys(analyticsData.sessionData).length;
    
    // Get activity by time periods
    const now = new Date();
    const activityData = [];
    
    if (timeframe === '24h') {
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now);
        hour.setHours(hour.getHours() - i);
        const hourKey = `${hour.toDateString()}-${hour.getHours()}:00`;
        
        activityData.push({
          period: hour.getHours(),
          requests: analyticsData.hourlyStats[hourKey]?.requests || 0,
          errors: analyticsData.hourlyStats[hourKey]?.errors || 0
        });
      }
    } else {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateKey = date.toDateString();
        
        activityData.push({
          period: dateKey,
          requests: analyticsData.dailyStats[dateKey]?.requests || 0,
          errors: analyticsData.dailyStats[dateKey]?.errors || 0,
          prints: analyticsData.dailyStats[dateKey]?.prints || 0
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        overview: {
          uniqueUsers: uniqueIPs,
          totalSessions: totalSessions,
          averageRequestsPerUser: uniqueIPs > 0 ? Math.round(analyticsData.totalRequests / uniqueIPs) : 0
        },
        activity: activityData,
        topUserAgents: Object.entries(analyticsData.userAgents)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([agent, count]) => ({
            userAgent: agent.length > 80 ? agent.substring(0, 80) + '...' : agent,
            count
          }))
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('User activity fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user activity data'
    });
  }
});

// Get business insights and recommendations
router.get('/insights/business', verifyAdminToken, (req, res) => {
  try {
    const analyticsData = getAnalyticsData();
    const insights = getDashboardInsights();
    
    // Calculate business metrics
    const totalFeatureUsage = Object.values(analyticsData.requestsByType).reduce((sum, count) => sum + count, 0);
    const mostPopularFeature = Object.entries(analyticsData.requestsByType)
      .sort(([,a], [,b]) => b - a)[0];
    
    const businessInsights = {
      featureAdoption: {
        totalUsage: totalFeatureUsage,
        mostPopular: mostPopularFeature ? {
          feature: mostPopularFeature[0],
          usage: mostPopularFeature[1],
          percentage: ((mostPopularFeature[1] / totalFeatureUsage) * 100).toFixed(1)
        } : null,
        breakdown: insights.charts.requestsByType
      },
      userEngagement: {
        printRate: analyticsData.totalRequests > 0 ? 
          ((analyticsData.prints.total / analyticsData.totalRequests) * 100).toFixed(2) : 0,
        errorRate: analyticsData.totalRequests > 0 ? 
          ((analyticsData.failedRequests / analyticsData.totalRequests) * 100).toFixed(2) : 0,
        averageResponseTime: Math.round(analyticsData.responseTimeStats.average || 0)
      },
      recommendations: generateBusinessRecommendations(analyticsData),
      trends: {
        dailyGrowth: calculateGrowthTrend(analyticsData.dailyStats),
        popularTimes: getPopularUsageTimes(analyticsData.hourlyStats)
      }
    };
    
    res.json({
      success: true,
      data: businessInsights,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Business insights fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch business insights'
    });
  }
});

// Track custom events (for frontend to report specific actions)
router.post('/track', verifyAdminToken, async (req, res) => {
  try {
    const { eventType, details } = req.body;
    
    if (!eventType) {
      return res.status(400).json({
        success: false,
        message: 'Event type is required'
      });
    }
    
    await trackEvent(eventType, details);
    
    res.json({
      success: true,
      message: 'Event tracked successfully'
    });
    
  } catch (error) {
    console.error('Event tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track event'
    });
  }
});

// Helper functions
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  return `${days}d ${hours}h ${minutes}m`;
}

function generateBusinessRecommendations(analyticsData) {
  const recommendations = [];
  
  // Error rate recommendation
  const errorRate = analyticsData.totalRequests > 0 ? 
    (analyticsData.failedRequests / analyticsData.totalRequests) * 100 : 0;
  
  if (errorRate > 5) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      title: 'High Error Rate Detected',
      description: `Current error rate is ${errorRate.toFixed(1)}%. Consider investigating and fixing common errors.`,
      action: 'Review error logs and improve error handling'
    });
  }
  
  // Response time recommendation
  const avgResponseTime = analyticsData.responseTimeStats.average || 0;
  if (avgResponseTime > 5000) {
    recommendations.push({
      type: 'performance',
      priority: 'medium',
      title: 'Slow Response Times',
      description: `Average response time is ${Math.round(avgResponseTime)}ms. Consider optimizing performance.`,
      action: 'Optimize API endpoints and consider caching'
    });
  }
  
  // Feature usage recommendation
  const totalUsage = Object.values(analyticsData.requestsByType).reduce((sum, count) => sum + count, 0);
  const underusedFeatures = Object.entries(analyticsData.requestsByType)
    .filter(([, count]) => count < totalUsage * 0.1)
    .map(([feature]) => feature);
  
  if (underusedFeatures.length > 0) {
    recommendations.push({
      type: 'business',
      priority: 'low',
      title: 'Underutilized Features',
      description: `Features like ${underusedFeatures.join(', ')} have low usage. Consider promoting them.`,
      action: 'Improve feature visibility and user education'
    });
  }
  
  return recommendations;
}

function calculateGrowthTrend(dailyStats) {
  const dates = Object.keys(dailyStats).sort();
  if (dates.length < 2) return 0;
  
  const recent = dailyStats[dates[dates.length - 1]]?.requests || 0;
  const previous = dailyStats[dates[dates.length - 2]]?.requests || 0;
  
  if (previous === 0) return recent > 0 ? 100 : 0;
  return ((recent - previous) / previous * 100).toFixed(1);
}

function getPopularUsageTimes(hourlyStats) {
  const hourCounts = {};
  
  Object.entries(hourlyStats).forEach(([hourKey, stats]) => {
    const hour = hourKey.split('-')[1].split(':')[0];
    hourCounts[hour] = (hourCounts[hour] || 0) + stats.requests;
  });
  
  return Object.entries(hourCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }));
}

// Export trackEvent function for use in other routes
module.exports = { router, trackEvent };
