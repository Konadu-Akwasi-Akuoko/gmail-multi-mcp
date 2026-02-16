import * as p from '@clack/prompts';
import pc from 'picocolors';
import { AccountManager } from './account-manager.js';

const VERSION = '2.0.1';

function printHeader(): void {
  console.log();
  console.log(
    `  ${pc.bgCyan(pc.bold(' Google Workspace MCP '))}  ${pc.dim(`v${VERSION}`)}`
  );
  console.log(`  ${pc.dim('Account Manager')}`);
  console.log();
}

async function handleList(manager: AccountManager): Promise<void> {
  const s = p.spinner();
  s.start('Loading accounts');

  try {
    const accounts = await manager.listAccounts();
    const defaultEmail = await manager.getDefaultAccount();
    s.stop('Accounts loaded');

    if (accounts.length === 0) {
      p.log.info(
        'No accounts configured. Select "Add account" to get started.'
      );
      return;
    }

    const lines = accounts.map((account) => {
      const isDefault = account.email === defaultEmail;
      const added = account.addedAt
        ? new Date(account.addedAt).toLocaleString()
        : 'N/A';
      const lastUsed = account.lastUsed
        ? new Date(account.lastUsed).toLocaleString()
        : 'Never';

      const emailStr = isDefault
        ? `${pc.green(pc.bold(account.email))} ${pc.green('(default)')}`
        : account.email;
      const meta = pc.dim(`Added: ${added}  |  Last used: ${lastUsed}`);

      return `${emailStr}\n  ${meta}`;
    });

    p.note(
      lines.join('\n'),
      `${accounts.length} account${accounts.length === 1 ? '' : 's'}`
    );
  } catch (error) {
    s.error('Failed to load accounts');
    p.log.error(error instanceof Error ? error.message : String(error));
  }
}

async function handleAdd(manager: AccountManager): Promise<void> {
  const email = await p.text({
    message: 'Enter Gmail address to add:',
    placeholder: 'user@gmail.com',
    validate(value) {
      if (!value || value.trim().length === 0) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        return 'Invalid email format';
    },
  });

  if (p.isCancel(email)) {
    p.log.warn('Cancelled.');
    return;
  }

  try {
    if (await manager.accountExists(email)) {
      p.log.warn(
        `Account ${email} already exists. Use "Re-authenticate" instead.`
      );
      return;
    }

    const s = p.spinner();
    s.start('Opening browser for OAuth consent');
    await manager.addAccount(email);
    s.stop(pc.green(`Account ${email} added successfully`));
  } catch (error) {
    p.log.error(
      `Failed to add account: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function handleRemove(manager: AccountManager): Promise<void> {
  const accounts = await manager.listAccounts();

  if (accounts.length === 0) {
    p.log.info('No accounts to remove.');
    return;
  }

  const email = await p.select({
    message: 'Select account to remove:',
    options: accounts.map((a) => ({
      value: a.email,
      label: a.email,
    })),
  });

  if (p.isCancel(email)) {
    p.log.warn('Cancelled.');
    return;
  }

  const confirmed = await p.confirm({
    message: `Remove ${email}? This cannot be undone.`,
    initialValue: false,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.log.warn('Cancelled.');
    return;
  }

  const s = p.spinner();
  s.start('Removing account');

  try {
    await manager.removeAccount(email);
    s.stop(pc.green(`Account ${email} removed`));
  } catch (error) {
    s.error('Failed to remove account');
    p.log.error(error instanceof Error ? error.message : String(error));
  }
}

async function handleSetDefault(manager: AccountManager): Promise<void> {
  const accounts = await manager.listAccounts();
  const currentDefault = await manager.getDefaultAccount();

  if (accounts.length === 0) {
    p.log.info('No accounts configured.');
    return;
  }

  if (accounts.length === 1) {
    const only = accounts[0].email;
    if (currentDefault === only) {
      p.log.info(`${only} is already the default (only account).`);
    } else {
      await manager.setDefaultAccount(only);
      p.log.success(`${only} set as default.`);
    }
    return;
  }

  const email = await p.select({
    message: 'Select default account:',
    options: accounts.map((a) => ({
      value: a.email,
      label: a.email,
      hint: a.email === currentDefault ? 'current default' : undefined,
    })),
  });

  if (p.isCancel(email)) {
    p.log.warn('Cancelled.');
    return;
  }

  try {
    await manager.setDefaultAccount(email);
    p.log.success(`Default account set to ${email}`);
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error));
  }
}

async function handleReauth(manager: AccountManager): Promise<void> {
  const accounts = await manager.listAccounts();

  if (accounts.length === 0) {
    p.log.info('No accounts to re-authenticate.');
    return;
  }

  const email = await p.select({
    message: 'Select account to re-authenticate:',
    options: accounts.map((a) => ({
      value: a.email,
      label: a.email,
    })),
  });

  if (p.isCancel(email)) {
    p.log.warn('Cancelled.');
    return;
  }

  const s = p.spinner();
  s.start('Opening browser for OAuth consent');

  try {
    await manager.reauthAccount(email);
    s.stop(pc.green(`Account ${email} re-authenticated successfully`));
  } catch (error) {
    s.error('Failed to re-authenticate');
    p.log.error(error instanceof Error ? error.message : String(error));
  }
}

function handlePath(manager: AccountManager): void {
  p.note(manager.getBasePath(), 'Data directory');
}

export async function runInteractive(): Promise<void> {
  const manager = new AccountManager();

  printHeader();

  while (true) {
    const action = await p.select({
      message: 'What would you like to do?',
      options: [
        {
          value: 'list',
          label: 'List accounts',
          hint: 'view configured accounts',
        },
        {
          value: 'add',
          label: 'Add account',
          hint: 'authenticate a new Gmail account',
        },
        {
          value: 'remove',
          label: 'Remove account',
          hint: 'delete account and tokens',
        },
        {
          value: 'set-default',
          label: 'Set default account',
          hint: 'choose primary account',
        },
        {
          value: 'reauth',
          label: 'Re-authenticate',
          hint: 're-authorize an existing account',
        },
        {
          value: 'path',
          label: 'Show data path',
          hint: 'credential storage location',
        },
        { value: 'exit', label: 'Exit' },
      ],
    });

    if (p.isCancel(action)) {
      p.cancel('Goodbye.');
      process.exit(0);
    }

    switch (action) {
      case 'list':
        await handleList(manager);
        break;
      case 'add':
        await handleAdd(manager);
        break;
      case 'remove':
        await handleRemove(manager);
        break;
      case 'set-default':
        await handleSetDefault(manager);
        break;
      case 'reauth':
        await handleReauth(manager);
        break;
      case 'path':
        handlePath(manager);
        break;
      case 'exit':
        p.outro('Goodbye.');
        return;
    }
  }
}
