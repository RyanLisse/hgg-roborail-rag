#!/usr/bin/env node

/**
 * Generate Supabase JWT Keys
 * Creates the necessary JWT tokens for Supabase services
 */

const crypto = require('crypto');

// Generate a strong JWT secret (base64 encoded)
function generateJWTSecret() {
    return crypto.randomBytes(64).toString('base64');
}

// Generate a simple JWT token without external dependencies
function generateSimpleJWT(payload, secret) {
    const header = {
        "alg": "HS256",
        "typ": "JWT"
    };
    
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Generate all required keys
function generateSupabaseKeys() {
    const jwtSecret = generateJWTSecret();
    
    // Anonymous key payload
    const anonPayload = {
        "role": "anon",
        "iss": "supabase",
        "iat": Math.floor(Date.now() / 1000),
        "exp": Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 years
    };
    
    // Service role key payload
    const servicePayload = {
        "role": "service_role",
        "iss": "supabase",
        "iat": Math.floor(Date.now() / 1000),
        "exp": Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 years
    };
    
    const anonKey = generateSimpleJWT(anonPayload, jwtSecret);
    const serviceKey = generateSimpleJWT(servicePayload, jwtSecret);
    
    return {
        jwtSecret,
        anonKey,
        serviceKey,
        postgresPassword: crypto.randomBytes(32).toString('hex'),
        secretKeyBase: crypto.randomBytes(64).toString('base64')
    };
}

// Main execution
if (require.main === module) {
    const keys = generateSupabaseKeys();
    
    console.log('# Supabase Keys Generated');
    console.log('# Store these securely - you\'ll need them for Railway configuration');
    console.log('');
    console.log(`JWT_SECRET="${keys.jwtSecret}"`);
    console.log(`ANON_KEY="${keys.anonKey}"`);
    console.log(`SERVICE_KEY="${keys.serviceKey}"`);
    console.log(`POSTGRES_PASSWORD="${keys.postgresPassword}"`);
    console.log(`SECRET_KEY_BASE="${keys.secretKeyBase}"`);
    console.log('');
    console.log('# Railway Commands to Set Variables:');
    console.log(`railway variables set JWT_SECRET="${keys.jwtSecret}"`);
    console.log(`railway variables set ANON_KEY="${keys.anonKey}"`);
    console.log(`railway variables set SERVICE_KEY="${keys.serviceKey}"`);
    console.log(`railway variables set POSTGRES_PASSWORD="${keys.postgresPassword}"`);
    console.log(`railway variables set SECRET_KEY_BASE="${keys.secretKeyBase}"`);
}

module.exports = { generateSupabaseKeys };