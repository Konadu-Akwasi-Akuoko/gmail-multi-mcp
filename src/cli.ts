#!/usr/bin/env bun
import { Command } from 'commander';
import { AccountManager } from './account-manager.js';
import { runInteractive } from './interactive.js';

const program = new Command();

program
  .name('gw-accounts')
  .description('Google Workspace MCP - Account Manager')
  .version('2.0.1');

program
  .command('add')
  .description('Add a Gmail account and authenticate via browser OAuth flow')
  .argument('<email>', 'Gmail address to add')
  .action(async (email: string) => {
    const manager = new AccountManager();
    try {
      if (await manager.accountExists(email)) {
        console.error(`Account ${email} already exists. Use 'reauth' to re-authenticate.`);
        process.exit(1);
      }
      console.log(`Adding account ${email}...`);
      console.log('A browser window will open for Google OAuth consent.');
      await manager.addAccount(email);
      console.log(`Account ${email} added successfully.`);
    } catch (error) {
      console.error(`Failed to add account: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('remove')
  .description('Remove a Gmail account and its stored tokens')
  .argument('<email>', 'Gmail address to remove')
  .action(async (email: string) => {
    const manager = new AccountManager();
    try {
      await manager.removeAccount(email);
      console.log(`Account ${email} removed.`);
    } catch (error) {
      console.error(`Failed to remove account: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all configured Gmail accounts')
  .action(async () => {
    const manager = new AccountManager();
    try {
      const accounts = await manager.listAccounts();
      const defaultEmail = await manager.getDefaultAccount();

      if (accounts.length === 0) {
        console.log('No accounts configured. Run `gmail-accounts add <email>` to add one.');
        return;
      }

      const header = `${'Email'.padEnd(35)} ${'Added'.padEnd(22)} ${'Last Used'.padEnd(22)} Default`;
      const separator = '-'.repeat(header.length);
      console.log(header);
      console.log(separator);

      for (const account of accounts) {
        const isDefault = account.email === defaultEmail ? '*' : '';
        const added = account.addedAt ? new Date(account.addedAt).toLocaleString() : 'N/A';
        const lastUsed = account.lastUsed ? new Date(account.lastUsed).toLocaleString() : 'Never';
        console.log(
          `${account.email.padEnd(35)} ${added.padEnd(22)} ${lastUsed.padEnd(22)} ${isDefault}`
        );
      }
    } catch (error) {
      console.error(`Failed to list accounts: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('default')
  .description('Get or set the default Gmail account')
  .argument('[email]', 'Gmail address to set as default (omit to show current)')
  .action(async (email?: string) => {
    const manager = new AccountManager();
    try {
      if (!email) {
        const current = await manager.getDefaultAccount();
        if (current) {
          console.log(`Default account: ${current}`);
        } else {
          console.log('No default account set.');
        }
        return;
      }
      await manager.setDefaultAccount(email);
      console.log(`Default account set to ${email}.`);
    } catch (error) {
      console.error(`Failed to set default: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('reauth')
  .description('Re-authenticate an existing account (opens browser OAuth flow)')
  .argument('<email>', 'Gmail address to re-authenticate')
  .action(async (email: string) => {
    const manager = new AccountManager();
    try {
      console.log(`Re-authenticating ${email}...`);
      console.log('A browser window will open for Google OAuth consent.');
      await manager.reauthAccount(email);
      console.log(`Account ${email} re-authenticated successfully.`);
    } catch (error) {
      console.error(`Failed to re-authenticate: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('path')
  .description('Show the resolved data directory used for credentials and accounts')
  .action(() => {
    const manager = new AccountManager();
    console.log(manager.getBasePath());
  });

const args = process.argv.slice(2);
if (args.length === 0) {
  await runInteractive();
} else {
  program.parse();
}
