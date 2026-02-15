import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { authenticate } from '@google-cloud/local-auth';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

export interface AccountConfig {
  email: string;
  addedAt: string;
  lastUsed?: string;
}

export interface AccountsRegistry {
  accounts: Record<string, AccountConfig>;
  defaultAccount?: string;
}

export class AccountManager {
  private readonly ACCOUNTS_DIR = path.join(process.cwd(), 'accounts');
  private readonly CONFIG_PATH = path.join(this.ACCOUNTS_DIR, 'config.json');
  private readonly CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.settings.basic'
  ];

  async ensureAccountsDirectory(): Promise<void> {
    try {
      await fs.access(this.ACCOUNTS_DIR);
    } catch {
      await fs.mkdir(this.ACCOUNTS_DIR, { recursive: true });
    }
  }

  async loadRegistry(): Promise<AccountsRegistry> {
    await this.ensureAccountsDirectory();
    try {
      const content = await fs.readFile(this.CONFIG_PATH, 'utf8');
      return JSON.parse(content);
    } catch {
      return { accounts: {} };
    }
  }

  async saveRegistry(registry: AccountsRegistry): Promise<void> {
    await this.ensureAccountsDirectory();
    await fs.writeFile(this.CONFIG_PATH, JSON.stringify(registry, null, 2));
  }

  async addAccount(email: string): Promise<void> {
    const registry = await this.loadRegistry();
    
    // Create account directory
    const accountDir = path.join(this.ACCOUNTS_DIR, email);
    await fs.mkdir(accountDir, { recursive: true });
    
    // Authenticate and save token
    const client = await authenticate({
      scopes: this.SCOPES,
      keyfilePath: this.CREDENTIALS_PATH,
    });
    
    if (client.credentials) {
      await this.saveAccountToken(email, client);
    }
    
    // Update registry
    registry.accounts[email] = {
      email,
      addedAt: new Date().toISOString()
    };
    
    // Set as default if it's the first account
    if (Object.keys(registry.accounts).length === 1) {
      registry.defaultAccount = email;
    }
    
    await this.saveRegistry(registry);
  }

  async removeAccount(email: string): Promise<void> {
    const registry = await this.loadRegistry();
    
    if (!registry.accounts[email]) {
      throw new Error(`Account ${email} not found`);
    }
    
    // Remove account directory
    const accountDir = path.join(this.ACCOUNTS_DIR, email);
    await fs.rm(accountDir, { recursive: true, force: true });
    
    // Remove from registry
    delete registry.accounts[email];
    
    // Update default if needed
    if (registry.defaultAccount === email) {
      const remainingAccounts = Object.keys(registry.accounts);
      registry.defaultAccount = remainingAccounts.length > 0 ? remainingAccounts[0] : undefined;
    }
    
    await this.saveRegistry(registry);
  }

  async listAccounts(): Promise<AccountConfig[]> {
    const registry = await this.loadRegistry();
    return Object.values(registry.accounts);
  }

  async getDefaultAccount(): Promise<string | undefined> {
    const registry = await this.loadRegistry();
    return registry.defaultAccount;
  }

  async setDefaultAccount(email: string): Promise<void> {
    const registry = await this.loadRegistry();
    
    if (!registry.accounts[email]) {
      throw new Error(`Account ${email} not found`);
    }
    
    registry.defaultAccount = email;
    await this.saveRegistry(registry);
  }

  async getAccountAuth(email: string): Promise<OAuth2Client> {
    const registry = await this.loadRegistry();
    
    if (!registry.accounts[email]) {
      throw new Error(`Account ${email} not found`);
    }
    
    const tokenPath = path.join(this.ACCOUNTS_DIR, email, 'token.json');
    
    try {
      const content = await fs.readFile(tokenPath, 'utf8');
      const credentials = JSON.parse(content);
      const auth = google.auth.fromJSON(credentials) as any;
      
      // Update last used
      registry.accounts[email].lastUsed = new Date().toISOString();
      await this.saveRegistry(registry);
      
      return auth;
    } catch (error) {
      throw new Error(`Failed to load credentials for ${email}. You may need to re-authenticate.`);
    }
  }

  private async saveAccountToken(email: string, client: OAuth2Client): Promise<void> {
    const content = await fs.readFile(this.CREDENTIALS_PATH, 'utf8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    
    const tokenPath = path.join(this.ACCOUNTS_DIR, email, 'token.json');
    await fs.writeFile(tokenPath, payload);
  }

  async accountExists(email: string): Promise<boolean> {
    const registry = await this.loadRegistry();
    return !!registry.accounts[email];
  }
}