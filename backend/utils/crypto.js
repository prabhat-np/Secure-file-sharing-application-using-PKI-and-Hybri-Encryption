const crypto = require('crypto');
const forge = require('node-forge');

class CryptoUtils {
  // Generate RSA key pair (2048-bit)
  static generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    return { publicKey, privateKey };
  }

  // Generate AES key for symmetric encryption
  static generateAESKey() {
    return crypto.randomBytes(32); // 256-bit key
  }

  // Encrypt data using AES
  static encryptAES(data, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted
    };
  }

  // Decrypt data using AES
  static decryptAES(encryptedData, key, iv) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Encrypt data using RSA public key
  static encryptRSA(data, publicKey) {
    return crypto.publicEncrypt(publicKey, Buffer.from(data)).toString('base64');
  }

  // Decrypt data using RSA private key
  static decryptRSA(encryptedData, privateKey) {
    return crypto.privateDecrypt(privateKey, Buffer.from(encryptedData, 'base64')).toString();
  }

  // Create digital signature (returns base64)
  static createSignature(data, privateKey) {
    try {
      const sign = crypto.createSign('SHA256');
      sign.update(data);
      sign.end();
      return sign.sign(privateKey, 'base64');
    } catch (error) {
      console.error('Failed to create signature:', error);
      throw error;
    }
  }

  // FIXED: Comprehensive signature verification with multiple format support
  static verifySignature(data, signature, publicKey) {
    try {
      // Method 1: Try Node.js crypto with base64 (most common from frontend)
      try {
        const verify = crypto.createVerify('SHA256');
        verify.update(data);
        verify.end();
        const result = verify.verify(publicKey, signature, 'base64');
        if (result) {
          console.log('✓ Signature verified with Node.js crypto (base64)');
          return true;
        }
      } catch (base64Error) {
        console.log('Node.js crypto base64 verification failed:', base64Error.message);
      }

      // Method 2: Try Node.js crypto with hex
      try {
        const verify = crypto.createVerify('SHA256');
        verify.update(data);
        verify.end();
        const result = verify.verify(publicKey, signature, 'hex');
        if (result) {
          console.log('✓ Signature verified with Node.js crypto (hex)');
          return true;
        }
      } catch (hexError) {
        console.log('Node.js crypto hex verification failed:', hexError.message);
      }

      // Method 3: Try node-forge with base64
      try {
        const forgePublicKey = forge.pki.publicKeyFromPem(publicKey);
        const md = forge.md.sha256.create();
        md.update(data, 'utf8');
        const signatureBytes = forge.util.decode64(signature);
        const result = forgePublicKey.verify(md.digest().bytes(), signatureBytes);
        if (result) {
          console.log('✓ Signature verified with node-forge (base64)');
          return true;
        }
      } catch (forgeBase64Error) {
        console.log('Node-forge base64 verification failed:', forgeBase64Error.message);
      }

      // Method 4: Try node-forge with hex
      try {
        const forgePublicKey = forge.pki.publicKeyFromPem(publicKey);
        const md = forge.md.sha256.create();
        md.update(data, 'utf8');
        const signatureBytes = forge.util.hexToBytes(signature);
        const result = forgePublicKey.verify(md.digest().bytes(), signatureBytes);
        if (result) {
          console.log('✓ Signature verified with node-forge (hex)');
          return true;
        }
      } catch (forgeHexError) {
        console.log('Node-forge hex verification failed:', forgeHexError.message);
      }

      // Method 5: Try raw buffer interpretation
      try {
        const verify = crypto.createVerify('SHA256');
        verify.update(data);
        verify.end();
        const result = verify.verify(publicKey, Buffer.from(signature, 'base64'));
        if (result) {
          console.log('✓ Signature verified with raw buffer');
          return true;
        }
      } catch (bufferError) {
        console.log('Raw buffer verification failed:', bufferError.message);
      }

      console.log('✗ All signature verification methods failed');
      return false;

    } catch (error) {
      console.error('Critical signature verification error:', error);
      return false;
    }
  }

  // Generate hash
  static generateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Generate certificate serial number
  static generateSerial() {
    return crypto.randomBytes(16).toString('hex');
  }

  // Create X.509 certificate using node-forge
  static createCertificate(publicKeyPem, privateKeyPem, subject, issuer, serialNumber) {
    try {
      const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

      const cert = forge.pki.createCertificate();
      cert.publicKey = publicKey;
      cert.serialNumber = serialNumber;
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

      const attrs = [
        { name: 'commonName', value: subject.commonName },
        { name: 'organizationName', value: subject.organizationName || 'Secure File Sharing' },
        { name: 'emailAddress', value: subject.emailAddress }
      ];

      cert.setSubject(attrs);
      cert.setIssuer(issuer || attrs);

      // Add extensions
      cert.setExtensions([
        {
          name: 'basicConstraints',
          cA: false
        },
        {
          name: 'keyUsage',
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true
        },
        {
          name: 'extKeyUsage',
          serverAuth: true,
          clientAuth: true,
          emailProtection: true
        }
      ]);

      // Sign the certificate
      cert.sign(privateKey, forge.md.sha256.create());

      return forge.pki.certificateToPem(cert);
    } catch (error) {
      console.error('Certificate creation error:', error);
      throw new Error('Failed to create certificate: ' + error.message);
    }
  }

  // Verify certificate
  static verifyCertificate(certPem, caCertPem) {
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      
      // Check if certificate is still valid
      const now = new Date();
      if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
        console.log('Certificate is expired or not yet valid');
        return false;
      }

      // Verify signature (if CA cert is provided)
      if (caCertPem) {
        try {
          const caCert = forge.pki.certificateFromPem(caCertPem);
          const verified = caCert.verify(cert);
          console.log(`Certificate verification result: ${verified}`);
          return verified;
        } catch (verifyError) {
          console.log('Certificate signature verification failed:', verifyError.message);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Certificate verification error:', error);
      return false;
    }
  }

  // Extract public key from certificate
  static getPublicKeyFromCert(certPem) {
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      return forge.pki.publicKeyToPem(cert.publicKey);
    } catch (error) {
      throw new Error('Invalid certificate: ' + error.message);
    }
  }
}

module.exports = CryptoUtils;