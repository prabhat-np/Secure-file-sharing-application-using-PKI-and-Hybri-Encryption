const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const CryptoUtils = require('../utils/crypto');
const CA = require('../utils/ca');
const rateLimit = require('express-rate-limit');

const isTesting = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';

const authLimiter = rateLimit({
  windowMs: isTesting ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1 minute for testing, 15 minutes for production
  max: isTesting ? 50 : 5, // 50 requests for testing, 5 for production
  message: {
    error: 'Too many authentication attempts, please try again later.',
    success: false
  }
});

// Initialize CA on startup with error handling
CA.initializeCA().catch(error => {
  console.error('❌ CA initialization failed on startup:', error);
});

// IMPROVED: User registration with PKI and better validation
router.post('/register', authLimiter, async (req, res) => {
  const { username, email } = req.body;
  
  try {
    console.log(`📋 Registration attempt for username: ${username}, email: ${email}`);
    
    // Validate input
    if (!username || !email) {
      console.log('❌ Registration failed: Missing username or email');
      return res.status(400).json({ 
        error: 'Username and email are required',
        success: false 
      });
    }

    // Sanitize input
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      console.log('❌ Registration failed: Invalid username format');
      return res.status(400).json({ 
        error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
        success: false 
      });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      console.log('❌ Registration failed: Invalid email format');
      return res.status(400).json({ 
        error: 'Please enter a valid email address',
        success: false 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username: cleanUsername }, { email: cleanEmail }] 
    });
    
    if (existingUser) {
      console.log('❌ Registration failed: User already exists');
      return res.status(409).json({ 
        error: 'Username or email already exists',
        success: false 
      });
    }

    console.log('🔑 Generating RSA key pair...');
    // Generate RSA key pair
    const { publicKey, privateKey } = CryptoUtils.generateKeyPair();
    console.log('✓ Key pair generated successfully');
    
    // Create certificate subject
    const subject = {
      commonName: cleanUsername,
      organizationName: 'Secure File Sharing Users',
      emailAddress: cleanEmail
    };

    console.log('🎫 Issuing certificate from CA...');
    // Issue certificate from CA
    const certData = await CA.issueCertificate(publicKey, subject);
    console.log('✓ Certificate issued successfully');
    
    // Create user in database
    const user = new User({
      username: cleanUsername,
      email: cleanEmail,
      publicKey,
      certificate: certData.certificate,
      certificateSerial: certData.serial,
      issuedAt: certData.issuedAt,
      expiresAt: certData.expiresAt
    });

    await user.save();
    console.log('✓ User saved to database');

    // Return keys and certificate to client
    console.log('🎉 Registration successful for user:', cleanUsername);
    res.json({
      success: true,
      message: 'User registered successfully',
      data: {
        publicKey,
        privateKey, // Client must store this securely
        certificate: certData.certificate,
        userId: user._id
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed', 
      success: false,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// IMPROVED: User login with digital signature verification and better logging
router.post('/login', authLimiter, async (req, res) => {
  const { username, challenge, signature } = req.body;
  
  try {
    console.log(`🔐 Login attempt for username: ${username}`);
    
    // Validate input
    if (!username || !challenge || !signature) {
      console.log('❌ Login failed: Missing required fields');
      return res.status(400).json({ 
        error: 'Username, challenge, and signature are required',
        success: false 
      });
    }

    const cleanUsername = username.trim();
    console.log('📋 Login details:');
    console.log('   Username:', cleanUsername);
    console.log('   Challenge:', challenge);
    console.log('   Signature length:', signature.length);
    console.log('   Signature format:', signature.includes('=') ? 'base64' : 'hex');

    // Find user
    const user = await User.findOne({ username: cleanUsername });
    if (!user) {
      console.log('❌ Login failed: User not found');
      return res.status(401).json({ 
        error: 'Invalid credentials',
        success: false 
      });
    }

    console.log('✓ User found in database');
    console.log('   Email:', user.email);
    console.log('   Certificate Serial:', user.certificateSerial);

    // Check if certificate is still valid
    if (user.isRevoked) {
      console.log('❌ Login failed: Certificate has been revoked');
      return res.status(401).json({ 
        error: 'Certificate has been revoked',
        success: false 
      });
    }

    if (new Date() > user.expiresAt) {
      console.log('❌ Login failed: Certificate has expired');
      return res.status(401).json({ 
        error: 'Certificate has expired',
        success: false 
      });
    }

    console.log('✓ Certificate validity checks passed');

    // Verify certificate against CA
    console.log('🔍 Verifying certificate against CA...');
    const isValidCert = await CA.verifyCertificate(user.certificate);
    if (!isValidCert) {
      console.log('❌ Login failed: Invalid certificate');
      return res.status(401).json({ 
        error: 'Invalid certificate',
        success: false 
      });
    }

    console.log('✓ Certificate verified against CA');

    // FIXED: Verify digital signature with improved error handling
    console.log('🔍 Verifying digital signature...');
    console.log('   Challenge to verify:', challenge);
    console.log('   Signature to verify:', signature);
    console.log('   Public key length:', user.publicKey.length);
    
    const isValidSignature = CryptoUtils.verifySignature(
      challenge, 
      signature, 
      user.publicKey
    );

    if (!isValidSignature) {
      console.log('❌ Login failed: Invalid signature');
      console.log('   Challenge:', challenge);
      console.log('   Signature:', signature);
      console.log('   Public Key (first 100 chars):', user.publicKey.substring(0, 100));
      return res.status(401).json({ 
        error: 'Invalid signature - authentication failed',
        success: false 
      });
    }

    console.log('✓ Digital signature verified successfully');

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username 
      }, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '24h' }
    );

    console.log('🎉 Login successful for user:', cleanUsername);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          publicKey: user.publicKey
        }
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      success: false,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// IMPROVED: Generate challenge for login with better randomness
router.post('/challenge', authLimiter, async (req, res) => {
  try {
    console.log('🎲 Generating authentication challenge...');
    
    const timestamp = Date.now().toString();
    const randomData = Math.random().toString() + Math.random().toString();
    const challenge = CryptoUtils.generateHash(timestamp + randomData);
    
    console.log('✓ Challenge generated successfully');
    console.log('   Challenge:', challenge);
    console.log('   Timestamp:', timestamp);
    
    res.json({
      success: true,
      challenge,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Challenge generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate challenge',
      success: false 
    });
  }
});

// Get user's public key by username (for encryption)
router.get('/publickey/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const cleanUsername = username.trim();
    
    console.log(`🔑 Public key request for user: ${cleanUsername}`);
    
    const user = await User.findOne({ username: cleanUsername }).select('publicKey username');
    
    if (!user) {
      console.log('❌ Public key request failed: User not found');
      return res.status(404).json({ 
        error: 'User not found',
        success: false 
      });
    }

    console.log('✓ Public key retrieved successfully');

    res.json({
      success: true,
      data: {
        username: user.username,
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    console.error('❌ Public key fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch public key',
      success: false 
    });
  }
});

// IMPROVED: Get CA certificate with better error handling
router.get('/ca-certificate', async (req, res) => {
  try {
    console.log('🏛️ CA certificate request...');
    
    const caCert = await CA.getCACertificate();
    
    console.log('✓ CA certificate retrieved successfully');
    
    res.json({
      success: true,
      data: {
        caCertificate: caCert
      }
    });
  } catch (error) {
    console.error('❌ CA certificate fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to get CA certificate',
      success: false 
    });
  }
});

// NEW: Debug endpoint for development (remove in production)
router.post('/debug/test-signature', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { challenge, signature, username } = req.body;
    
    if (!challenge || !signature || !username) {
      return res.status(400).json({
        error: 'Challenge, signature, and username are required',
        success: false
      });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        success: false
      });
    }

    const isValid = CryptoUtils.verifySignature(challenge, signature, user.publicKey);
    
    res.json({
      success: true,
      data: {
        isValid,
        challenge,
        signature,
        signatureLength: signature.length,
        signatureFormat: signature.includes('=') ? 'base64' : 'hex',
        publicKeyLength: user.publicKey.length
      }
    });
  } catch (error) {
    console.error('Debug signature test error:', error);
    res.status(500).json({
      error: 'Debug test failed',
      success: false,
      details: error.message
    });
  }
});

module.exports = router;
