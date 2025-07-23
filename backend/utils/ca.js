const fs = require('fs-extra');
const path = require('path');
const CryptoUtils = require('./crypto');

class CertificateAuthority {
  constructor() {
    this.caDir = path.join(__dirname, '../ca');
    this.caKeyPath = path.join(this.caDir, 'ca-key.pem');
    this.caCertPath = path.join(this.caDir, 'ca-cert.pem');
    this.initialized = false;
  }

  // IMPROVED: Initialize CA if it doesn't exist with better error handling
  async initializeCA() {
    try {
      console.log('🔑 Initializing Certificate Authority...');
      
      await fs.ensureDir(this.caDir);
      console.log(`✓ CA directory ensured: ${this.caDir}`);

      // Check if CA already exists
      if (await fs.pathExists(this.caKeyPath) && await fs.pathExists(this.caCertPath)) {
        // Validate existing CA files
        try {
          const existingKey = await fs.readFile(this.caKeyPath, 'utf8');
          const existingCert = await fs.readFile(this.caCertPath, 'utf8');
          
          // Basic validation
          if (existingKey.includes('-----BEGIN PRIVATE KEY-----') && 
              existingCert.includes('-----BEGIN CERTIFICATE-----')) {
            console.log('✓ CA already initialized and valid');
            this.initialized = true;
            return;
          } else {
            console.log('⚠️ Existing CA files are invalid, regenerating...');
          }
        } catch (validationError) {
          console.log('⚠️ Error validating existing CA files, regenerating...');
        }
      }

      console.log('🚀 Generating new Certificate Authority...');

      // Generate CA key pair
      const caKeys = CryptoUtils.generateKeyPair();
      console.log('✓ CA key pair generated');
      
      // Create CA certificate with longer validity
      const caSubject = {
        commonName: 'Secure File Sharing Root CA',
        organizationName: 'Secure File Sharing System',
        emailAddress: 'ca@securefilesharing.com'
      };

      const caSerial = CryptoUtils.generateSerial();
      console.log(`✓ CA serial number: ${caSerial}`);

      // Create self-signed CA certificate
      const caCert = CryptoUtils.createCertificate(
        caKeys.publicKey,
        caKeys.privateKey,
        caSubject,
        null, // Self-signed (issuer same as subject)
        caSerial
      );
      console.log('✓ CA certificate created');

      // Save CA private key and certificate with proper permissions
      await fs.writeFile(this.caKeyPath, caKeys.privateKey, { mode: 0o600 });
      await fs.writeFile(this.caCertPath, caCert, { mode: 0o644 });
      
      console.log('✓ CA files saved securely');
      console.log(`   Private Key: ${this.caKeyPath}`);
      console.log(`   Certificate: ${this.caCertPath}`);

      // Test the newly created CA
      await this.testCA();
      
      this.initialized = true;
      console.log('🎉 Certificate Authority initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize CA:', error);
      throw new Error(`CA initialization failed: ${error.message}`);
    }
  }

  // NEW: Test CA functionality
  async testCA() {
    try {
      console.log('🧪 Testing CA functionality...');
      
      const caCert = await this.getCACertificate();
      const caKey = await this.getCAPrivateKey();
      
      // Verify we can parse the CA certificate
      const forge = require('node-forge');
      const cert = forge.pki.certificateFromPem(caCert);
      
      console.log(`✓ CA certificate valid from ${cert.validity.notBefore} to ${cert.validity.notAfter}`);
      console.log(`✓ CA subject: ${cert.subject.getField('CN').value}`);
      
      return true;
    } catch (error) {
      console.error('❌ CA test failed:', error);
      throw error;
    }
  }

  // IMPROVED: Get CA certificate with initialization check
  async getCACertificate() {
    try {
      if (!this.initialized) {
        await this.initializeCA();
      }
      
      if (!(await fs.pathExists(this.caCertPath))) {
        throw new Error('CA certificate file not found');
      }
      
      const caCert = await fs.readFile(this.caCertPath, 'utf8');
      
      // Validate certificate format
      if (!caCert.includes('-----BEGIN CERTIFICATE-----')) {
        throw new Error('Invalid CA certificate format');
      }
      
      return caCert;
    } catch (error) {
      console.error('Failed to get CA certificate:', error);
      throw new Error('Failed to get CA certificate: ' + error.message);
    }
  }

  // IMPROVED: Get CA private key with initialization check
  async getCAPrivateKey() {
    try {
      if (!this.initialized) {
        await this.initializeCA();
      }
      
      if (!(await fs.pathExists(this.caKeyPath))) {
        throw new Error('CA private key file not found');
      }
      
      const caKey = await fs.readFile(this.caKeyPath, 'utf8');
      
      // Validate private key format
      if (!caKey.includes('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('Invalid CA private key format');
      }
      
      return caKey;
    } catch (error) {
      console.error('Failed to get CA private key:', error);
      throw new Error('Failed to get CA private key: ' + error.message);
    }
  }

  // IMPROVED: Issue certificate for user with better validation
  async issueCertificate(userPublicKey, userSubject) {
    try {
      console.log(`🎫 Issuing certificate for user: ${userSubject.commonName}`);
      
      // Validate inputs
      if (!userPublicKey || !userSubject) {
        throw new Error('User public key and subject are required');
      }
      
      if (!userSubject.commonName || !userSubject.emailAddress) {
        throw new Error('User common name and email address are required');
      }

      // Validate public key format
      if (!userPublicKey.includes('-----BEGIN PUBLIC KEY-----')) {
        throw new Error('Invalid user public key format');
      }

      const caPrivateKey = await this.getCAPrivateKey();
      const caCert = await this.getCACertificate();
      
      // Extract CA subject for issuer field
      const forge = require('node-forge');
      const caX509 = forge.pki.certificateFromPem(caCert);
      const caSubject = caX509.subject.attributes.map(attr => ({
        name: attr.name,
        value: attr.value
      }));

      const serial = CryptoUtils.generateSerial();
      console.log(`✓ Generated serial number: ${serial}`);
      
      // Create user certificate signed by CA
      const userCert = CryptoUtils.createCertificate(
        userPublicKey,
        caPrivateKey,
        userSubject,
        caSubject,
        serial
      );

      const issuedAt = new Date();
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

      console.log(`✓ Certificate issued successfully`);
      console.log(`   Subject: ${userSubject.commonName}`);
      console.log(`   Email: ${userSubject.emailAddress}`);
      console.log(`   Serial: ${serial}`);
      console.log(`   Valid from: ${issuedAt}`);
      console.log(`   Valid until: ${expiresAt}`);

      return {
        certificate: userCert,
        serial: serial,
        issuedAt: issuedAt,
        expiresAt: expiresAt
      };
    } catch (error) {
      console.error('❌ Failed to issue certificate:', error);
      throw new Error('Failed to issue certificate: ' + error.message);
    }
  }

  // IMPROVED: Verify certificate against CA with detailed logging
  async verifyCertificate(userCert) {
    try {
      console.log('🔍 Verifying user certificate against CA...');
      
      if (!userCert) {
        console.log('❌ No certificate provided');
        return false;
      }

      // Validate certificate format
      if (!userCert.includes('-----BEGIN CERTIFICATE-----')) {
        console.log('❌ Invalid certificate format');
        return false;
      }

      const caCert = await this.getCACertificate();
      const result = CryptoUtils.verifyCertificate(userCert, caCert);
      
      if (result) {
        console.log('✓ Certificate verification successful');
      } else {
        console.log('❌ Certificate verification failed');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Certificate verification error:', error);
      return false;
    }
  }

  // IMPROVED: Revoke certificate with proper tracking
  async revokeCertificate(serial) {
    try {
      console.log(`🚫 Revoking certificate with serial: ${serial}`);
      
      if (!serial) {
        throw new Error('Certificate serial number is required');
      }
      
      // In a production system, you would maintain a Certificate Revocation List (CRL)
      // For this demo, we'll implement a simple revocation check
      const revokedCertsPath = path.join(this.caDir, 'revoked.json');
      
      let revokedCerts = [];
      if (await fs.pathExists(revokedCertsPath)) {
        try {
          const revokedData = await fs.readFile(revokedCertsPath, 'utf8');
          revokedCerts = JSON.parse(revokedData);
        } catch (parseError) {
          console.log('Warning: Could not parse revoked certificates file');
          revokedCerts = [];
        }
      }
      
      // Add to revoked list if not already present
      const revocationEntry = {
        serial: serial,
        revokedAt: new Date().toISOString(),
        reason: 'Certificate revoked by administrator'
      };
      
      if (!revokedCerts.find(cert => cert.serial === serial)) {
        revokedCerts.push(revocationEntry);
        await fs.writeFile(revokedCertsPath, JSON.stringify(revokedCerts, null, 2));
        console.log(`✓ Certificate ${serial} has been revoked`);
      } else {
        console.log(`⚠️ Certificate ${serial} was already revoked`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to revoke certificate:', error);
      throw new Error('Failed to revoke certificate: ' + error.message);
    }
  }

  // NEW: Check if certificate is revoked
  async isCertificateRevoked(serial) {
    try {
      const revokedCertsPath = path.join(this.caDir, 'revoked.json');
      
      if (!(await fs.pathExists(revokedCertsPath))) {
        return false;
      }
      
      const revokedData = await fs.readFile(revokedCertsPath, 'utf8');
      const revokedCerts = JSON.parse(revokedData);
      
      return revokedCerts.some(cert => cert.serial === serial);
    } catch (error) {
      console.error('Failed to check certificate revocation status:', error);
      return false; // Assume not revoked if we can't check
    }
  }

  // NEW: Get CA information
  async getCAInfo() {
    try {
      const caCert = await this.getCACertificate();
      const forge = require('node-forge');
      const cert = forge.pki.certificateFromPem(caCert);
      
      return {
        subject: cert.subject.getField('CN').value,
        organization: cert.subject.getField('O')?.value || 'N/A',
        email: cert.subject.getField('emailAddress')?.value || 'N/A',
        validFrom: cert.validity.notBefore,
        validUntil: cert.validity.notAfter,
        serialNumber: cert.serialNumber,
        fingerprint: CryptoUtils.generateHash(caCert)
      };
    } catch (error) {
      console.error('Failed to get CA information:', error);
      throw new Error('Failed to get CA information: ' + error.message);
    }
  }
}

module.exports = new CertificateAuthority();