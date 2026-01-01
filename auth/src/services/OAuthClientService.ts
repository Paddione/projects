import { db } from '../config/database.js';
import { oauthClients } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { OAuthClientValidation } from '../types/oauth.js';
import bcrypt from 'bcrypt';

/**
 * OAuthClientService
 * Handles OAuth 2.0 client validation and management
 */
export class OAuthClientService {
  /**
   * Validate OAuth client by client_id
   * Checks if client exists and is active
   */
  async validateClient(clientId: string): Promise<OAuthClientValidation> {
    try {
      const client = await db
        .select()
        .from(oauthClients)
        .where(eq(oauthClients.client_id, clientId))
        .limit(1);

      if (client.length === 0) {
        return {
          valid: false,
          error: 'Client not found'
        };
      }

      if (!client[0].is_active) {
        return {
          valid: false,
          error: 'Client is inactive'
        };
      }

      return {
        valid: true,
        client: {
          id: client[0].id,
          client_id: client[0].client_id,
          name: client[0].name,
          redirect_uris: client[0].redirect_uris as string[],
          grant_types: client[0].grant_types as string[],
          is_active: client[0].is_active
        }
      };
    } catch (error) {
      console.error('Error validating OAuth client:', error);
      return {
        valid: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Validate OAuth client credentials (client_id + client_secret)
   * Used for token exchange endpoint
   */
  async validateClientCredentials(clientId: string, clientSecret: string): Promise<OAuthClientValidation> {
    try {
      const client = await db
        .select()
        .from(oauthClients)
        .where(eq(oauthClients.client_id, clientId))
        .limit(1);

      if (client.length === 0) {
        return {
          valid: false,
          error: 'Invalid client credentials'
        };
      }

      // Compare client secret (support both hashed and plain text for development)
      const isSecretValid =
        client[0].client_secret === clientSecret ||
        await bcrypt.compare(clientSecret, client[0].client_secret);

      if (!isSecretValid) {
        return {
          valid: false,
          error: 'Invalid client credentials'
        };
      }

      if (!client[0].is_active) {
        return {
          valid: false,
          error: 'Client is inactive'
        };
      }

      return {
        valid: true,
        client: {
          id: client[0].id,
          client_id: client[0].client_id,
          name: client[0].name,
          redirect_uris: client[0].redirect_uris as string[],
          grant_types: client[0].grant_types as string[],
          is_active: client[0].is_active
        }
      };
    } catch (error) {
      console.error('Error validating OAuth client credentials:', error);
      return {
        valid: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Validate redirect URI against client's allowed URIs
   */
  async validateRedirectUri(clientId: string, redirectUri: string): Promise<boolean> {
    try {
      const validation = await this.validateClient(clientId);

      if (!validation.valid || !validation.client) {
        return false;
      }

      // Check if redirect URI is in the allowed list
      return validation.client.redirect_uris.includes(redirectUri);
    } catch (error) {
      console.error('Error validating redirect URI:', error);
      return false;
    }
  }

  /**
   * Validate grant type against client's allowed grant types
   */
  async validateGrantType(clientId: string, grantType: string): Promise<boolean> {
    try {
      const validation = await this.validateClient(clientId);

      if (!validation.valid || !validation.client) {
        return false;
      }

      // Check if grant type is in the allowed list
      return validation.client.grant_types.includes(grantType);
    } catch (error) {
      console.error('Error validating grant type:', error);
      return false;
    }
  }

  /**
   * Get client by client_id (for internal use)
   */
  async getClient(clientId: string) {
    const client = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.client_id, clientId))
      .limit(1);

    return client.length > 0 ? client[0] : null;
  }
}
