import * as p from '@clack/prompts';

export interface PromptOption<T> {
  value: T;
  label: string;
  hint?: string;
}

interface SelectPromptOptions<T> {
  message: string;
  options: ReadonlyArray<PromptOption<T>>;
  initialValue?: T;
}

interface MultiselectPromptOptions<T> {
  message: string;
  options: ReadonlyArray<PromptOption<T>>;
  required?: boolean;
  initialValues?: ReadonlyArray<T>;
}

interface ConfirmPromptOptions {
  message: string;
  defaultValue?: boolean;
}

interface TextPromptOptions {
  message: string;
  placeholder?: string;
  defaultValue?: string;
}

interface SpinnerTask<T> {
  label: string;
  task: () => Promise<T>;
  successMessage?: string;
  errorMessage?: string;
}

function toClackOption<T>(option: PromptOption<T>): p.Option<T> {
  const mapped = {
    value: option.value,
    label: option.label,
  } as { value: T; label: string; hint?: string };

  if (option.hint !== undefined) {
    mapped.hint = option.hint;
  }

  return mapped as p.Option<T>;
}

function ensureInteractive(): void {
  if (!isInteractiveSession()) {
    throw new Error(
      'Interactive prompts are unavailable in non-interactive mode (TTY/CI). Use CLI flags to run non-interactively.',
    );
  }
}

function isCiEnvironment(): boolean {
  const rawCi = process.env['CI'];
  if (typeof rawCi !== 'string') {
    return false;
  }

  const normalized = rawCi.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }

  return normalized !== '0' && normalized !== 'false';
}

export function isInteractiveSession(): boolean {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY) && !isCiEnvironment();
}

function handleCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Cancelled');
    process.exit(0);
  }

  return value as T;
}

export async function selectPrompt<T>(options: SelectPromptOptions<T>): Promise<T> {
  ensureInteractive();

  const value = await p.select<T>({
    message: options.message,
    initialValue: options.initialValue,
    options: options.options.map((option) => toClackOption(option)),
  });

  return handleCancel(value);
}

export async function multiselectPrompt<T>(
  options: MultiselectPromptOptions<T>,
): Promise<T[]> {
  ensureInteractive();

  const value = await p.multiselect<T>({
    message: options.message,
    required: options.required,
    initialValues: options.initialValues ? [...options.initialValues] : undefined,
    options: options.options.map((option) => toClackOption(option)),
  });

  return handleCancel(value);
}

export async function confirmPrompt(options: ConfirmPromptOptions): Promise<boolean> {
  ensureInteractive();

  const value = await p.confirm({
    message: options.message,
    initialValue: options.defaultValue,
  });

  return handleCancel(value);
}

export async function textPrompt(options: TextPromptOptions): Promise<string> {
  ensureInteractive();

  const value = await p.text({
    message: options.message,
    placeholder: options.placeholder,
    defaultValue: options.defaultValue,
  });

  return handleCancel(value);
}

export function introPrompt(message: string): void {
  if (!isInteractiveSession()) {
    return;
  }

  p.intro(message);
}

export function outroPrompt(message: string): void {
  if (!isInteractiveSession()) {
    return;
  }

  p.outro(message);
}

export function notePrompt(message: string, title?: string): void {
  if (!isInteractiveSession()) {
    return;
  }

  p.note(message, title);
}

export async function spinnerTask<T>(options: SpinnerTask<T>): Promise<T> {
  if (!isInteractiveSession()) {
    return options.task();
  }

  const spinner = p.spinner();
  spinner.start(options.label);

  try {
    const result = await options.task();
    spinner.stop(options.successMessage ?? options.label);
    return result;
  } catch (error) {
    spinner.stop(options.errorMessage ?? options.label);
    throw error;
  }
}
