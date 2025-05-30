import { createAuth0Client, type Auth0Client, type User } from '@auth0/auth0-spa-js';
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_AUDIENCE } from './env.js';

// Stores
export const isLoading = writable(true);
export const isAuthenticated = writable(false);
export const user = writable<User | null>(null);
export const authError = writable<string | null>(null);

let auth0Client: Auth0Client;

// Initialize Auth0
export async function initAuth0() {
  if (!browser) return;

  if (!AUTH0_CLIENT_ID) {
    authError.set('Auth0 client ID not configured');
    isLoading.set(false);
    return;
  }

  try {
    auth0Client = await createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: AUTH0_AUDIENCE,
      },
      cacheLocation: 'localstorage',
    });

    // Check if user is authenticated
    const authenticated = await auth0Client.isAuthenticated();
    isAuthenticated.set(authenticated);

    if (authenticated) {
      const userData = await auth0Client.getUser();
      user.set(userData || null);
    }

    // Handle redirect callback
    if (window.location.search.includes('code=') || window.location.search.includes('error=')) {
      try {
        await auth0Client.handleRedirectCallback();
        const userData = await auth0Client.getUser();
        user.set(userData || null);
        isAuthenticated.set(true);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error('Error handling redirect callback:', error);
        authError.set('Authentication failed. Please try again.');
      }
    }
  } catch (error) {
    console.error('Error initializing Auth0:', error);
    authError.set('Failed to initialize authentication.');
  } finally {
    isLoading.set(false);
  }
}

// Login function
export async function login() {
  if (!auth0Client) return;
  
  try {
    await auth0Client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: window.location.origin,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    authError.set('Login failed. Please try again.');
  }
}

// Logout function
export async function logout() {
  if (!auth0Client) return;
  
  try {
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
    isAuthenticated.set(false);
    user.set(null);
  } catch (error) {
    console.error('Logout error:', error);
    authError.set('Logout failed. Please try again.');
  }
}

// Get access token for API calls
export async function getAccessToken(): Promise<string | null> {
  if (!auth0Client) return null;
  
  try {
    return await auth0Client.getTokenSilently();
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}