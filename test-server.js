const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'admin-secret-key-2024';

// Admin credentials
const ADMIN_USERS = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    role: 'super_admin',
    email: 'admin@notemate.com'
  }
];

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    message: 'Test Server Running!',
    timestamp: new Date().toISOString()
  });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }
    
    const admin = ADMIN_USERS.find(user => user.username === username);
    
    if (!admin || password !== admin.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username, 
        role: admin.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
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

// Mock analytics endpoint
app.get('/api/admin/analytics', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }
  
  try {
    jwt.verify(token, JWT_SECRET);
    
    res.json({
      success: true,
      data: {
        totalRequests: 150,
        successfulRequests: 142,
        failedRequests: 8,
        requestsByType: {
          text: 45,
          audio: 32,
          video: 28,
          image: 35,
          ppt: 10
        },
        prints: {
          notes: 25,
          ppt: 8,
          audio: 12,
          video: 15,
          image: 18
        },
        dailyStats: {
          '2024-01-01': { requests: 20, prints: 5, errors: 1 },
          '2024-01-02': { requests: 25, prints: 8, errors: 2 },
          '2024-01-03': { requests: 30, prints: 12, errors: 1 },
          '2024-01-04': { requests: 22, prints: 6, errors: 0 },
          '2024-01-05': { requests: 28, prints: 10, errors: 2 },
          '2024-01-06': { requests: 15, prints: 4, errors: 1 },
          '2024-01-07': { requests: 10, prints: 3, errors: 1 }
        },
        userAgents: {
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36': 85,
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36': 42,
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36': 23
        },
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Test Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Admin login: POST http://localhost:${PORT}/api/admin/login`);
  console.log(`📊 Admin credentials: admin / admin123`);
});
