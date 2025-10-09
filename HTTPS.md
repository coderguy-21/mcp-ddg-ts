# HTTPS Support

The MCP WebSearch Server supports optional HTTPS with automatic certificate detection.

## Quick Start

### Enable HTTPS
```bash
# Generate self-signed certificates
npm run gencerts

# Start server (will automatically use HTTPS if certificates are found)
npm start
```

### Disable HTTPS
```bash
# Remove certificates to return to HTTP mode
rm -rf certs/
# or rename the folder
mv certs certs_disabled
```

## How It Works

1. **Automatic Detection**: Server checks for `certs/cert.pem` and `certs/key.pem` on startup
2. **HTTPS Mode**: If certificates exist, server starts in HTTPS mode
3. **HTTP Fallback**: If no certificates, server starts in HTTP mode
4. **Clear Indication**: Server startup message shows which mode is active

## Certificate Generation

The `gencerts.js` script creates self-signed certificates suitable for development:

```bash
npm run gencerts
```

**Generated Files:**
- `certs/cert.pem` - SSL certificate (valid for 365 days)
- `certs/key.pem` - Private key
- Common Name: `localhost`
- Organization: `MCP WebSearch`

## Browser Security Warnings

Self-signed certificates will trigger browser security warnings. This is normal for development:

1. Click "Advanced" or "Show Details"
2. Click "Proceed to localhost" or "Accept Risk"
3. Certificate will be remembered for the session

## Production Use

For production environments:
1. Replace self-signed certificates with proper SSL certificates from a CA
2. Ensure proper domain names in certificates
3. Consider using Let's Encrypt for free certificates

## Requirements

- **OpenSSL**: Required for certificate generation
  - Windows: Download from [OpenSSL Website](https://slproweb.com/products/Win32OpenSSL.html)
  - macOS: `brew install openssl`
  - Linux: `sudo apt-get install openssl` (Ubuntu/Debian)

## Troubleshooting

### OpenSSL Not Found
If you see "openssl: command not found":
1. Install OpenSSL (see requirements above)
2. Add OpenSSL to your system PATH
3. Restart terminal and try again

### Permission Errors
If certificate generation fails with permission errors:
1. Ensure you have write permissions in the project directory
2. Try running with administrator/sudo privileges (not recommended)
3. Check if antivirus is blocking file creation

### Certificate Errors
If HTTPS server fails to start:
1. Check that both `cert.pem` and `key.pem` exist in `certs/` folder
2. Verify certificates aren't corrupted (regenerate with `npm run gencerts`)
3. Check file permissions on certificate files