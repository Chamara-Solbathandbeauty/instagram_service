#!/usr/bin/env node

/**
 * Simple migration script for production
 * This script will create the database tables if they don't exist
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'postgres', // Changed from 'username' to 'user'
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'instamanager',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    
    console.log('📊 Creating tables...');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR UNIQUE NOT NULL,
        password VARCHAR NOT NULL,
        "firstName" VARCHAR NOT NULL,
        "lastName" VARCHAR NOT NULL,
        role VARCHAR DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create ig_accounts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ig_accounts (
        id SERIAL PRIMARY KEY,
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        description TEXT,
        topics TEXT,
        tone VARCHAR,
        type VARCHAR DEFAULT 'business' CHECK (type IN ('business', 'creator')),
        "instagramAccountId" VARCHAR,
        "facebookPageId" VARCHAR,
        "accessToken" TEXT,
        "tokenExpiresAt" TIMESTAMP,
        "isConnected" BOOLEAN DEFAULT false,
        username VARCHAR,
        "profilePictureUrl" VARCHAR,
        "followersCount" INTEGER DEFAULT 0,
        "followingCount" INTEGER DEFAULT 0,
        "mediaCount" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create content table
    await client.query(`
      CREATE TABLE IF NOT EXISTS content (
        id SERIAL PRIMARY KEY,
        caption TEXT,
        "hashTags" JSON,
        "generatedSource" VARCHAR NOT NULL,
        "usedTopics" VARCHAR,
        tone VARCHAR,
        type VARCHAR DEFAULT 'post_with_image' CHECK (type IN ('reel', 'story', 'post_with_image')),
        status VARCHAR DEFAULT 'generated' CHECK (status IN ('generated', 'published', 'rejected', 'queued')),
        "accountId" INTEGER NOT NULL REFERENCES ig_accounts(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create media table
    await client.query(`
      CREATE TABLE IF NOT EXISTS media (
        id SERIAL PRIMARY KEY,
        "contentId" INTEGER REFERENCES content(id) ON DELETE CASCADE,
        "fileName" VARCHAR NOT NULL,
        "filePath" VARCHAR NOT NULL,
        "fileSize" INTEGER NOT NULL,
        "mimeType" VARCHAR NOT NULL,
        "mediaType" VARCHAR DEFAULT 'image' CHECK ("mediaType" IN ('image', 'video')),
        prompt TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create account_images table
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_images (
        id SERIAL PRIMARY KEY,
        "accountId" INTEGER NOT NULL REFERENCES ig_accounts(id) ON DELETE CASCADE,
        "fileName" VARCHAR NOT NULL,
        "filePath" VARCHAR NOT NULL,
        "fileSize" INTEGER NOT NULL,
        "mimeType" VARCHAR NOT NULL,
        "displayOrder" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Database migration completed successfully!');
    console.log('🚀 You can now start the application with: npm run start:prod');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
