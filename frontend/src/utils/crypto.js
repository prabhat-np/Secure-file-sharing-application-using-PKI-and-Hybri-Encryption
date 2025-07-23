import forge from 'node-forge';

class ClientCrypto {
  // FIXED: Generate challenge signature for login - consistently returns base64 format
  static signChallenge(challenge, privateKeyPem) {
    try {
      // Validate inputs
      if (!challenge || !privateKeyPem) {
        throw new Error('Challenge and private key are required');
      }

      // Validate private key format
      if (!this.isValidPEM(privateKeyPem, 'PRIVATE KEY')) {
        throw new Error('Invalid private key format');
      }

      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      const md = forge.md.sha256.create();
      md.update(challenge, 'utf8');
      const signature = privateKey.sign(md);
      const base64Signature = forge.util.encode64(signature);
      
      console.log('✓ Challenge signed successfully (base64 format)');
      console.log('Signature length:', base64Signature.length);
      console.log('Challenge:', challenge);
      
      return base64Signature;
    } catch (error) {
      console.error('Failed to sign challenge:', error);
      throw new Error('Failed to sign challenge: ' + error.message);
    }
  }

  // Verify digital signature
  static verifySignature(data, signature, publicKeyPem) {
    try {
      const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
      const md = forge.md.sha256.create();
      md.update(data, 'utf8');
      const signatureBytes = forge.util.decode64(signature);
      return publicKey.verify(md.digest().bytes(), signatureBytes);
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  // FIXED: Create digital signature - consistently returns base64 format
  static createSignature(data, privateKeyPem) {
    try {
      if (!data || !privateKeyPem) {
        throw new Error('Data and private key are required');
      }

      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      const md = forge.md.sha256.create();
      md.update(data, 'utf8');
      const signature = privateKey.sign(md);
      const base64Signature = forge.util.encode64(signature);
      
      console.log('✓ Signature created successfully (base64 format)');
      return base64Signature;
    } catch (error) {
      console.error('Failed to create signature:', error);
      throw new Error('Failed to create signature: ' + error.message);
    }
  }

  // Encrypt data with public key (for small data like AES keys)
  static encryptWithPublicKey(data, publicKeyPem) {
    try {
      if (!data || !publicKeyPem) {
        throw new Error('Data and public key are required');
      }

      const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
      const encrypted = publicKey.encrypt(data, 'RSA-OAEP');
      return forge.util.encode64(encrypted);
    } catch (error) {
      console.error('Failed to encrypt with public key:', error);
      throw new Error('Failed to encrypt with public key: ' + error.message);
    }
  }

  // Decrypt data with private key
  static decryptWithPrivateKey(encryptedData, privateKeyPem) {
    try {
      if (!encryptedData || !privateKeyPem) {
        throw new Error('Encrypted data and private key are required');
      }

      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      const encrypted = forge.util.decode64(encryptedData);
      const decrypted = privateKey.decrypt(encrypted, 'RSA-OAEP');
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt with private key:', error);
      throw new Error('Failed to decrypt with private key: ' + error.message);
    }
  }

  // Generate random AES key
  static generateAESKey() {
    return forge.random.getBytesSync(32); // 256-bit key
  }

  // Encrypt data with AES
  static encryptAES(data, key) {
    try {
      if (!data || !key) {
        throw new Error('Data and key are required');
      }

      const cipher = forge.cipher.createCipher('AES-CBC', key);
      const iv = forge.random.getBytesSync(16);
      cipher.start({ iv: iv });
      cipher.update(forge.util.createBuffer(data, 'utf8'));
      cipher.finish();
      
      return {
        encrypted: forge.util.encode64(cipher.output.data),
        iv: forge.util.encode64(iv)
      };
    } catch (error) {
      console.error('Failed to encrypt with AES:', error);
      throw new Error('Failed to encrypt with AES: ' + error.message);
    }
  }

  // Decrypt data with AES
  static decryptAES(encryptedData, key, iv) {
    try {
      if (!encryptedData || !key || !iv) {
        throw new Error('Encrypted data, key, and IV are required');
      }

      const decipher = forge.cipher.createDecipher('AES-CBC', key);
      const encryptedBytes = forge.util.decode64(encryptedData);
      const ivBytes = forge.util.decode64(iv);
      
      decipher.start({ iv: ivBytes });
      decipher.update(forge.util.createBuffer(encryptedBytes));
      decipher.finish();
      
      return decipher.output.toString('utf8');
    } catch (error) {
      console.error('Failed to decrypt with AES:', error);
      throw new Error('Failed to decrypt with AES: ' + error.message);
    }
  }

  // Generate hash
  static generateHash(data) {
    try {
      const md = forge.md.sha256.create();
      md.update(data, 'utf8');
      return md.digest().toHex();
    } catch (error) {
      console.error('Failed to generate hash:', error);
      throw new Error('Failed to generate hash: ' + error.message);
    }
  }

  // IMPROVED: Validate PEM format with better regex
  static isValidPEM(pem, type = 'PRIVATE KEY') {
    try {
      if (!pem || typeof pem !== 'string') {
        return false;
      }

      // Check for proper PEM format
      const regex = new RegExp(`-----BEGIN ${type}-----[\\s\\S]*-----END ${type}-----`);
      const hasValidFormat = regex.test(pem);
      
      if (!hasValidFormat) {
        console.log(`Invalid PEM format for ${type}`);
        return false;
      }

      // Try to parse the key to ensure it's valid
      if (type === 'PRIVATE KEY') {
        try {
          forge.pki.privateKeyFromPem(pem);
          return true;
        } catch (parseError) {
          console.log('Failed to parse private key:', parseError.message);
          return false;
        }
      } else if (type === 'PUBLIC KEY') {
        try {
          forge.pki.publicKeyFromPem(pem);
          return true;
        } catch (parseError) {
          console.log('Failed to parse public key:', parseError.message);
          return false;
        }
      } else if (type === 'CERTIFICATE') {
        try {
          forge.pki.certificateFromPem(pem);
          return true;
        } catch (parseError) {
          console.log('Failed to parse certificate:', parseError.message);
          return false;
        }
      }

      return hasValidFormat;
    } catch (error) {
      console.error('PEM validation error:', error);
      return false;
    }
  }

  // Extract public key from certificate
  static getPublicKeyFromCert(certPem) {
    try {
      if (!certPem) {
        throw new Error('Certificate is required');
      }

      const cert = forge.pki.certificateFromPem(certPem);
      return forge.pki.publicKeyToPem(cert.publicKey);
    } catch (error) {
      console.error('Failed to extract public key from certificate:', error);
      throw new Error('Failed to extract public key from certificate: ' + error.message);
    }
  }

  // Verify certificate validity
  static verifyCertificate(certPem) {
    try {
      if (!certPem) {
        return false;
      }

      const cert = forge.pki.certificateFromPem(certPem);
      const now = new Date();
      const isValid = now >= cert.validity.notBefore && now <= cert.validity.notAfter;
      
      if (!isValid) {
        console.log('Certificate is expired or not yet valid');
        console.log('Current time:', now);
        console.log('Valid from:', cert.validity.notBefore);
        console.log('Valid until:', cert.validity.notAfter);
      }
      
      return isValid;
    } catch (error) {
      console.error('Certificate verification error:', error);
      return false;
    }
  }

  // NEW: Generate key pair on client side (if needed)
  static generateKeyPair() {
    try {
      const rsa = forge.pki.rsa;
      const keypair = rsa.generateKeyPair({ bits: 2048 });
      
      return {
        publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
        privateKey: forge.pki.privateKeyToPem(keypair.privateKey)
      };
    } catch (error) {
      console.error('Failed to generate key pair:', error);
      throw new Error('Failed to generate key pair: ' + error.message);
    }
  }

  // NEW: Test signature compatibility with backend
  static testSignatureCompatibility(challenge, privateKeyPem) {
    try {
      console.log('🧪 Testing signature compatibility...');
      
      // Create signature
      const signature = this.signChallenge(challenge, privateKeyPem);
      console.log('Generated signature:', signature);
      
      // Get public key from private key for verification
      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
      const publicKeyPem = forge.pki.publicKeyToPem(publicKey);
      
      // Verify signature locally
      const isValid = this.verifySignature(challenge, signature, publicKeyPem);
      console.log('Local verification result:', isValid);
      
      return {
        signature,
        isValid,
        publicKey: publicKeyPem
      };
    } catch (error) {
      console.error('Signature compatibility test failed:', error);
      throw error;
    }
  }
}

export default ClientCrypto;