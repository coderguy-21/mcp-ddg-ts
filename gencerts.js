#!/usr/bin/env node

/**
 * Generate self-signed certificates for HTTPS development
 * Creates cert.pem and key.pem in the certs folder
 */

import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const certsDir = './certs';
const certFile = join(certsDir, 'cert.pem');
const keyFile = join(certsDir, 'key.pem');

console.log('🔐 Generating self-signed certificates for HTTPS development...\n');

try {
  // Create certs directory if it doesn't exist
  if (!existsSync(certsDir)) {
    mkdirSync(certsDir, { recursive: true });
    console.log(`✅ Created ${certsDir} directory`);
  }

  // Check if certificates already exist
  if (existsSync(certFile) && existsSync(keyFile)) {
    console.log('⚠️  Certificates already exist!');
    console.log(`   - ${certFile}`);
    console.log(`   - ${keyFile}`);
    console.log('\n🤔 Do you want to overwrite them? (Ctrl+C to cancel)');
    
    // Wait a moment to let user cancel if they want
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('⏳ Proceeding with certificate generation...\n');
  }

  // Generate private key
  console.log('🔑 Generating private key...');
  execSync(`openssl genrsa -out "${keyFile}" 2048`, { stdio: 'pipe' });
  console.log(`✅ Private key generated: ${keyFile}`);

  // Generate certificate
  console.log('📜 Generating self-signed certificate...');
  const opensslCmd = `openssl req -new -x509 -key "${keyFile}" -out "${certFile}" -days 365 -subj "/C=US/ST=Dev/L=Local/O=MCP/OU=WebSearch/CN=localhost"`;
  execSync(opensslCmd, { stdio: 'pipe' });
  console.log(`✅ Certificate generated: ${certFile}`);

  console.log('\n🎉 Self-signed certificates generated successfully!');
  console.log('\n📋 Certificate Details:');
  console.log('   - Valid for: 365 days');
  console.log('   - Common Name: localhost');
  console.log('   - Organization: MCP WebSearch');
  console.log('\n🚀 Usage:');
  console.log('   - Start your MCP server normally');
  console.log('   - Server will automatically detect certificates and use HTTPS');
  console.log('   - Connect to: https://localhost:3000/mcp');
  console.log('\n⚠️  Browser Warning:');
  console.log('   - Your browser will show a security warning for self-signed certificates');
  console.log('   - This is normal for development - click "Advanced" and "Proceed to localhost"');
  console.log('\n🗑️  To remove HTTPS:');
  console.log(`   - Delete the ${certsDir} folder to return to HTTP mode`);

} catch (error) {
  console.error('\n❌ Error generating certificates:');
  
  if (error.message.includes('openssl')) {
    console.error('🔧 OpenSSL is required but not found in PATH');
    console.error('\n📥 Install OpenSSL:');
    console.error('   - Windows: Download from https://slproweb.com/products/Win32OpenSSL.html');
    console.error('   - macOS: brew install openssl');
    console.error('   - Linux: sudo apt-get install openssl (Ubuntu/Debian) or sudo yum install openssl (RHEL/CentOS)');
  } else {
    console.error(`   ${error.message}`);
  }
  
  process.exit(1);
}