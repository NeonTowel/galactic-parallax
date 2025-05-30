import { browser } from '$app/environment';

// Auth0 configuration - these should be set as environment variables
export const AUTH0_DOMAIN = browser ? (import.meta.env.VITE_AUTH0_DOMAIN || '') : '';
export const AUTH0_CLIENT_ID = browser ? (import.meta.env.VITE_AUTH0_CLIENT_ID || '') : '';
export const AUTH0_AUDIENCE = browser ? (import.meta.env.VITE_AUTH0_AUDIENCE || '') : '';

// API configuration
export const API_BASE_URL = browser ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787') : '';